import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { PenSquare, Send, Search, FlaskConical } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { initDatabase } from '@/services/database/init'
import { useDatabaseStore } from '@/store/database'
import { useAccountStore } from '@/store/accountStore'
import { useComposeStore } from '@/store/composeStore'
import { useSearchStore } from '@/store/searchStore'
import { EmailList, OutboxView, FolderSidebar } from '@/components/email'
import { AccountSwitcher } from '@/components/account'
import { ReAuthNotificationContainer } from '@/components/notifications'
import { UndoToast, OfflineIndicator, QueueStatusBadge, SyncButton } from '@/components/ui'
import { ConflictIndicator } from '@/components/conflicts'
import { ComposeLoadingFallback, SearchLoadingFallback } from '@/components/common'
import { WelcomeScreen } from '@/components/onboarding/WelcomeScreen'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import { initializeReAuthNotifications } from '@/services/auth/notificationIntegration'
import { tokenRefreshService } from '@/services/auth/tokenRefresh'
import { loadAccountsFromStorage } from '@/services/auth/accountLoader'
import { gmailOAuthService } from '@/services/auth/gmailOAuth'
import { logger } from '@/services/logger'
import { QueueProcessorProvider } from '@/hooks/useQueueProcessor'
import { sendQueueService } from '@/services/email/sendQueueService'
import { useFolderCounts } from '@/hooks/useFolderCounts'
import { useLabelSync } from '@/hooks/useLabelSync'
import { cn } from '@/utils/cn'
import { loadDemoData, clearDemoData, isDemoDataLoaded } from '@/utils/demoData'
import { ShortcutProvider } from '@/context/ShortcutContext'
import { useEmailShortcut, useFolderNavigationShortcuts } from '@/hooks/useEmailShortcut'
import { useFolderStore } from '@/store/folderStore'
import { useAttributeStore } from '@/store/attributeStore'
// Story 2.11: Task 9 - Accessibility components
import { SkipLinks, ActionAnnouncer } from '@/components/accessibility'

/**
 * Story 2.10: Task 6 - Code Splitting
 * Lazy load heavy components that aren't needed on initial render
 */
import { lazyComponents, preloadCriticalComponents } from '@/utils/lazyPreload'

const ComposeDialog = lazy(lazyComponents.composeDialog)
const CommandPalette = lazy(lazyComponents.commandPalette)
// Story 2.11: Lazy load shortcut overlay
const ShortcutOverlay = lazy(() => import('@/components/ShortcutOverlay/ShortcutOverlay'))

type ViewType = 'emails' | 'outbox'

/**
 * Story 2.11: Global keyboard shortcuts hook
 * Handles compose, search, and help overlay shortcuts at app level
 */
function useGlobalShortcuts({
  onCompose,
  onSearch,
  onShowHelp,
  enabled = true,
}: {
  onCompose: () => void
  onSearch: () => void
  onShowHelp: () => void
  enabled?: boolean
}) {
  // c - Compose new email (global scope, not in compose/search)
  useEmailShortcut({
    keys: 'c',
    handler: onCompose,
    scopes: ['global', 'inbox', 'reading'],
    enabled,
    description: 'Compose new email',
  })

  // / - Focus search (global scope)
  useEmailShortcut({
    keys: '/',
    handler: onSearch,
    scopes: ['global', 'inbox', 'reading'],
    enabled,
    description: 'Focus search',
  })

  // Cmd+K / Ctrl+K - Command palette (works in form tags)
  useEmailShortcut({
    keys: 'meta+k',
    handler: onSearch,
    scopes: ['global'],
    enableOnFormTags: true,
    enabled,
    description: 'Open command palette',
  })

  // ? - Show keyboard shortcuts
  useEmailShortcut({
    keys: 'shift+/',
    handler: onShowHelp,
    scopes: ['global'],
    enabled,
    description: 'Show keyboard shortcuts',
  })
}

function App() {
  const { initialized, loading, error, setInitialized, setLoading, setError } = useDatabaseStore()
  const activeAccountId = useAccountStore((state) => state.activeAccountId)
  const accounts = useAccountStore((state) => state.accounts)
  const setAccounts = useAccountStore((state) => state.setAccounts)
  const {
    isOpen: composeOpen,
    context: composeContext,
    closeCompose,
    openCompose,
  } = useComposeStore()
  const { isOpen: searchOpen, openSearch, closeSearch } = useSearchStore()
  const setSelectedFolder = useFolderStore((state) => state.setSelectedFolder)

  // Story 2.12: Onboarding state for first-time users
  const { isFirstLaunch, hasSeenWelcome, dismissWelcome, completeOnboarding } = useOnboardingState()

  // View state for navigation (emails vs outbox)
  const [activeView, setActiveView] = useState<ViewType>('emails')
  const [outboxCount, setOutboxCount] = useState(0)
  // Story 2.11: Shortcut overlay state
  const [showShortcutOverlay, setShowShortcutOverlay] = useState(false)
  // Demo mode state for visual testing
  const [demoMode, setDemoMode] = useState(false)

  // Subscribe to folder unread counts (Story 2.9)
  useFolderCounts()

  // Sync labels from email providers (Story 2.9)
  useLabelSync()

  useEffect(() => {
    // Initialize database on app launch
    const init = async () => {
      setLoading(true)
      setError(null)

      try {
        await initDatabase()
        setInitialized(true)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [setInitialized, setLoading, setError])

  // Initialize token refresh and re-auth notification system
  useEffect(() => {
    if (!initialized) return

    // Start token refresh scheduler
    tokenRefreshService.startScheduler()

    // Initialize re-auth notification integration
    const cleanupNotifications = initializeReAuthNotifications()

    // Load accounts from token storage
    loadAccountsFromStorage().then(setAccounts)

    return () => {
      tokenRefreshService.stopScheduler()
      cleanupNotifications()
    }
  }, [initialized, setAccounts])

  // Update outbox count periodically
  useEffect(() => {
    if (!initialized) return

    const updateOutboxCount = async () => {
      const pending = await sendQueueService.getPendingCount()
      const failed = await sendQueueService.getFailedCount()
      setOutboxCount(pending + failed)
    }

    updateOutboxCount()
    const interval = setInterval(updateOutboxCount, 5000)
    return () => clearInterval(interval)
  }, [initialized])

  // Story 2.10: Task 6.6 - Preload lazy components after initial render
  useEffect(() => {
    if (!initialized) return
    // Preload compose and search dialogs during idle time
    preloadCriticalComponents()
  }, [initialized])

  // Check if demo data is loaded on init
  useEffect(() => {
    if (!initialized) return
    isDemoDataLoaded().then(setDemoMode)
  }, [initialized])

  // Toggle demo mode
  const handleToggleDemoMode = useCallback(async () => {
    if (demoMode) {
      await clearDemoData()
      setDemoMode(false)
      // Refresh attributes after clearing demo data
      useAttributeStore.getState().fetchAttributes()
    } else {
      await loadDemoData()
      setDemoMode(true)
      // Force re-subscription by briefly changing folder and back
      // This triggers useEmails to re-run its subscription setup
      const currentFolder = useFolderStore.getState().selectedFolder
      setSelectedFolder('__refresh__')
      setTimeout(() => setSelectedFolder(currentFolder), 0)
      // Refresh attributes after loading demo data (Story 2.15)
      useAttributeStore.getState().fetchAttributes()
    }
  }, [demoMode, setSelectedFolder])

  // Story 2.12: Mark onboarding complete when first account is connected
  useEffect(() => {
    if (accounts.length > 0 && isFirstLaunch) {
      completeOnboarding()
    }
  }, [accounts.length, isFirstLaunch, completeOnboarding])

  // Handle connect account click - initiate Gmail OAuth flow
  const handleConnectAccount = useCallback(async () => {
    try {
      // Dismiss welcome screen on connect action
      if (!hasSeenWelcome) {
        dismissWelcome()
      }
      await gmailOAuthService.initiateAuth()
    } catch (err) {
      logger.error('auth', 'Failed to initiate OAuth', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }, [hasSeenWelcome, dismissWelcome])

  // Handle compose button click
  const handleCompose = useCallback(() => {
    openCompose()
  }, [openCompose])

  // Handle showing shortcut overlay
  const handleShowShortcutOverlay = useCallback(() => {
    setShowShortcutOverlay(true)
  }, [])

  // Handle closing shortcut overlay
  const handleCloseShortcutOverlay = useCallback(() => {
    setShowShortcutOverlay(false)
  }, [])

  // Handle folder navigation (Story 2.11: Task 3.5)
  const handleNavigateToFolder = useCallback(
    (folder: string) => {
      setSelectedFolder(folder)
      setActiveView('emails')
      logger.info('navigation', 'Folder navigation via shortcut', { folder })
    },
    [setSelectedFolder]
  )

  // Story 2.11: Global keyboard shortcuts using react-hotkeys-hook
  // Shortcuts only active when not in compose or search modes
  const shortcutsEnabled = initialized && !composeOpen && !searchOpen
  useGlobalShortcuts({
    onCompose: openCompose,
    onSearch: openSearch,
    onShowHelp: handleShowShortcutOverlay,
    enabled: shortcutsEnabled,
  })

  // Story 2.11: Folder navigation shortcuts (g+i, g+s, g+t, g+d)
  useFolderNavigationShortcuts({
    onNavigateToFolder: handleNavigateToFolder,
    enabled: shortcutsEnabled,
  })

  // Show loading state during database initialization
  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500" />
        <p className="text-lg text-slate-600">Initializing database...</p>
      </div>
    )
  }

  // Show error state if initialization failed
  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 p-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg max-w-md">
          <h2 className="text-xl font-bold mb-2">Database Initialization Failed</h2>
          <p className="mb-4">{error.message}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  // Story 2.12 (AC1): Show welcome screen on first launch with no accounts connected
  // Only show if user hasn't dismissed welcome and has no accounts
  const showWelcomeScreen = initialized && accounts.length === 0 && !hasSeenWelcome

  if (showWelcomeScreen) {
    return <WelcomeScreen onConnectAccount={handleConnectAccount} onSkip={dismissWelcome} />
  }

  // Show email client UI once database is initialized
  return (
    <ShortcutProvider initialScope="inbox">
      <ActionAnnouncer>
        <QueueProcessorProvider>
          {/* Story 2.11: Task 9.4 - Skip links for keyboard-only users */}
          <SkipLinks />

          <div className="h-screen flex flex-col">
            {/* Re-auth notifications (fixed position, top-right) */}
            <ReAuthNotificationContainer />

            {/* Undo toast (fixed position, bottom-right) */}
            <UndoToast />

            {/* Compose Dialog - Lazy loaded (Story 2.10: Task 6) */}
            {composeOpen && (
              <Suspense fallback={<ComposeLoadingFallback />}>
                <ComposeDialog
                  open={composeOpen}
                  onClose={closeCompose}
                  initialContext={composeContext ?? undefined}
                  accountId={activeAccountId ?? ''}
                />
              </Suspense>
            )}

            {/* Command Palette / Search - Lazy loaded (Story 2.10: Task 6) */}
            {searchOpen && (
              <Suspense fallback={<SearchLoadingFallback />}>
                <CommandPalette
                  open={searchOpen}
                  onClose={closeSearch}
                  onSelectEmail={(emailId) => {
                    logger.info('search', 'Email selected from search', { emailId })
                    // TODO: Navigate to email detail view
                  }}
                />
              </Suspense>
            )}

            {/* Header */}
            <header className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold text-slate-800">Claine</h1>

                {/* Compose button - preloads compose dialog on hover */}
                <Button
                  onClick={handleCompose}
                  onMouseEnter={() => lazyComponents.composeDialog.preload()}
                  className="flex items-center gap-2"
                >
                  <PenSquare className="w-4 h-4" />
                  Compose
                </Button>

                {/* Search button - preloads search dialog on hover */}
                <Button
                  variant="outline"
                  onClick={openSearch}
                  onMouseEnter={() => lazyComponents.commandPalette.preload()}
                  className="flex items-center gap-2 text-slate-500"
                >
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">Search</span>
                  <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 rounded">
                    <span className="text-xs">&#8984;</span>K
                  </kbd>
                </Button>

                {/* Demo mode toggle - for visual testing */}
                {import.meta.env.DEV && (
                  <Button
                    variant={demoMode ? 'default' : 'outline'}
                    onClick={handleToggleDemoMode}
                    className="flex items-center gap-2"
                    title={
                      demoMode
                        ? 'Demo mode ON - Click to disable'
                        : 'Enable demo mode with sample emails'
                    }
                  >
                    <FlaskConical className="w-4 h-4" />
                    <span className="hidden sm:inline">{demoMode ? 'Demo ON' : 'Demo'}</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-4">
                {/* Offline indicator */}
                <OfflineIndicator />

                {/* Sync status indicators */}
                <div className="flex items-center gap-2">
                  <QueueStatusBadge />
                  <ConflictIndicator />
                  <SyncButton />
                </div>

                {/* Account switcher */}
                <AccountSwitcher onConnectAccount={handleConnectAccount} />
              </div>
            </header>

            {/* Main content with sidebar */}
            <div className="flex-1 flex overflow-hidden">
              {/* Folder sidebar - Story 2.9 */}
              <div className="w-48 border-r border-slate-200 flex flex-col">
                <FolderSidebar className="flex-1" />

                {/* Outbox button at bottom */}
                <div className="p-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setActiveView(activeView === 'outbox' ? 'emails' : 'outbox')}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      activeView === 'outbox'
                        ? 'bg-cyan-100 text-cyan-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    <Send className="w-4 h-4" />
                    Outbox
                    {outboxCount > 0 && (
                      <span className="ml-auto px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                        {outboxCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Main content area - Task 9.4: id for skip link target */}
              <main id="main-content" className="flex-1 overflow-hidden min-w-0">
                {activeView === 'outbox' ? (
                  <OutboxView />
                ) : (
                  <EmailList accountId={activeAccountId ?? undefined} />
                )}
              </main>
            </div>

            {/* Story 2.11: Shortcut overlay - Lazy loaded */}
            {showShortcutOverlay && (
              <Suspense fallback={null}>
                <ShortcutOverlay open={showShortcutOverlay} onClose={handleCloseShortcutOverlay} />
              </Suspense>
            )}
          </div>
        </QueueProcessorProvider>
      </ActionAnnouncer>
    </ShortcutProvider>
  )
}

export default App
