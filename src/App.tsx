import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { PenSquare, Send, Search, FlaskConical } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { initDatabase } from '@/services/database/init'
import { useDatabaseStore } from '@/store/database'
import { useAccountStore } from '@/store/accountStore'
import { useComposeStore } from '@/store/composeStore'
import { useSearchStore } from '@/store/searchStore'
import { useEmailStore } from '@/store/emailStore'
import { EmailList, OutboxView, FolderSidebar } from '@/components/email'
import { AccountSwitcher, AccountSettings } from '@/components/account'
import { ReAuthNotificationContainer } from '@/components/notifications'
import { CircuitBreakerNotification } from '@/components/notifications/CircuitBreakerNotification'
import { BankruptcyNotification } from '@/components/notifications/BankruptcyNotification'
import {
  UndoToast,
  OfflineIndicator,
  QueueStatusBadge,
  SyncButton,
  HealthIndicator,
} from '@/components/ui'
import { ConflictIndicator } from '@/components/conflicts'
import { PerformanceMonitor } from '@/components/dev'
import { ComposeLoadingFallback, SearchLoadingFallback } from '@/components/common'
import { WelcomeScreen } from '@/components/onboarding/WelcomeScreen'
import { useOnboardingState } from '@/hooks/useOnboardingState'
import { initializeReAuthNotifications } from '@/services/auth/notificationIntegration'
import { tokenRefreshService } from '@/services/auth/tokenRefresh'
import { loadAccountsFromStorage } from '@/services/auth/accountLoader'
import { gmailOAuthService } from '@/services/auth/gmailOAuth'
import { outlookOAuthService } from '@/services/auth/outlookOAuth'
import {
  connectGmailAccount,
  connectOutlookAccount,
  getOAuthProvider,
  clearOAuthProvider,
} from '@/services/auth/accountManager'
import { tokenStorageService } from '@/services/auth/tokenStorage'
import { initializeEncryption } from '@/services/auth/encryptionInit'
import {
  initializeSyncOrchestrator,
  syncOrchestratorService,
} from '@/services/sync/syncOrchestrator'
import { healthRegistry } from '@/services/sync/healthRegistry'
import { getDatabase } from '@/services/database/init'
import { logger } from '@/services/logger'
import { QueueProcessorProvider } from '@/hooks/useQueueProcessor'
import { sendQueueService } from '@/services/email/sendQueueService'
import { emailActionsService } from '@/services/email/emailActionsService'
import { emailActionQueue } from '@/services/email/emailActionQueue'
import {
  prepareAttachmentsForSend,
  type ComposeAttachment,
} from '@/components/compose/AttachmentUpload'
import { useFolderCounts } from '@/hooks/useFolderCounts'
import { useLabelSync } from '@/hooks/useLabelSync'
import { useSearchIndex } from '@/hooks/useSearchIndex'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { cn } from '@/utils/cn'
import { loadDemoData, clearDemoData, isDemoDataLoaded } from '@/utils/demoData'
import { initDebugHelpers } from '@/utils/debugHelpers'
import { initModifierSystem } from '@/services/modifiers'
import { buildReplyContext, buildForwardContext } from '@/utils/composeHelpers'
import { ShortcutProvider } from '@/context/ShortcutContext'
import { useEmailShortcut, useFolderNavigationShortcuts } from '@/hooks/useEmailShortcut'
import { useFolderStore } from '@/store/folderStore'
import { useAttributeStore } from '@/store/attributeStore'
import { initializeAttributePresets } from '@/services/attributes/presetInitializer'
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
 * Handles compose, search, actions, and help overlay shortcuts at app level
 *
 * Separate modes:
 * - / opens search mode (email search only)
 * - Cmd+K opens actions mode (quick actions only)
 */
function useGlobalShortcuts({
  onCompose,
  onOpenSearch,
  onOpenActions,
  onShowHelp,
  enabled = true,
}: {
  onCompose: () => void
  onOpenSearch: () => void
  onOpenActions: () => void
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

  // / - Open search (email search only)
  useEmailShortcut({
    keys: '/',
    handler: onOpenSearch,
    scopes: ['global', 'inbox', 'reading'],
    enabled,
    description: 'Search emails',
  })

  // Cmd+K / Ctrl+K - Open actions (quick actions only)
  useEmailShortcut({
    keys: 'meta+k',
    handler: onOpenActions,
    scopes: ['global'],
    enableOnFormTags: true,
    enabled,
    description: 'Open quick actions',
  })

  // ? - Show keyboard shortcuts (use both shift+/ and ? for compatibility)
  useEmailShortcut({
    keys: '?',
    handler: onShowHelp,
    scopes: ['global', 'inbox', 'reading'],
    enabled,
    description: 'Show keyboard shortcuts',
  })

  // Direct event listener for ? shortcut (react-hotkeys-hook workaround)
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger in form fields
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // ? key (shift + /)
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        onShowHelp()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onShowHelp])
}

function App() {
  const { initialized, loading, error, setInitialized, setLoading, setError } = useDatabaseStore()
  const activeAccountId = useAccountStore((state) => state.activeAccountId)
  const accounts = useAccountStore((state) => state.accounts)
  const setAccounts = useAccountStore((state) => state.setAccounts)
  const {
    isOpen: composeOpen,
    context: composeContext,
    draftId: composeDraftId,
    closeCompose,
    openCompose,
    openComposeWithContext,
  } = useComposeStore()
  const { isOpen: searchOpen, mode: searchMode, openSearch, closeSearch } = useSearchStore()
  const selectedEmailId = useEmailStore((state) => state.selectedEmailId)
  const setSelectedEmail = useEmailStore((state) => state.setSelectedEmail)
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
  // Account settings modal state
  const [showAccountSettings, setShowAccountSettings] = useState(false)

  // Subscribe to folder unread counts (Story 2.9)
  useFolderCounts()

  // Sync labels from email providers (Story 2.9)
  useLabelSync()

  // Build and maintain search index for full-text search (Story 2.5)
  useSearchIndex()

  // Story 1.20: Bridge network status to health registry
  const { isOnline: networkIsOnline } = useNetworkStatus()
  useEffect(() => {
    healthRegistry.connectNetworkStatus(networkIsOnline)
  }, [networkIsOnline])

  useEffect(() => {
    // Initialize database and encryption on app launch
    const init = async () => {
      setLoading(true)
      setError(null)

      try {
        const db = await initDatabase()
        // Initialize encryption before any token operations
        await initializeEncryption()

        // Restore auth tokens if coming from a fullReset
        const resetTokensJson = sessionStorage.getItem('__reset_tokens__')
        if (resetTokensJson) {
          logger.info('app', 'Restoring auth tokens from reset...')
          try {
            const tokens = JSON.parse(resetTokensJson)
            // Add authTokens collection if needed
            if (!db.authTokens) {
              const { authTokenSchema } = await import(
                '@/services/database/schemas/authToken.schema'
              )
              await db.addCollections({ authTokens: { schema: authTokenSchema } })
            }
            // Restore each token
            for (const token of tokens) {
              await db.authTokens.upsert(token)
            }
            logger.info('app', `Restored ${tokens.length} auth tokens`)
            sessionStorage.removeItem('__reset_tokens__')
          } catch (e) {
            logger.error('app', 'Failed to restore auth tokens', { error: e })
          }
        }

        // Story 1.20: Database health signal
        healthRegistry.setDatabaseHealth(true)

        // Initialize sync orchestrator with database
        const orchestrator = initializeSyncOrchestrator(db)
        // Story 1.20: Connect sync progress for health monitoring
        healthRegistry.connectSyncProgress(orchestrator.getProgressService())
        // Initialize attribute presets (Status, Priority, Context) for filtering
        logger.info('app', 'Initializing attribute presets...')
        const presetsCreated = await initializeAttributePresets()
        logger.info('app', 'Attribute presets initialized', { presetsCreated })
        // Initialize modifier system for offline-first architecture (Epic 3)
        // This registers all modifier classes and initializes the processor
        await initModifierSystem()
        logger.info('app', 'Modifier system initialized')

        // Story 1.20: Connect queue health signals
        healthRegistry.connectActionQueue(emailActionQueue)
        healthRegistry.connectSendQueue(sendQueueService)

        // Story 1.15: Subscribe orchestrator to action events for adaptive interval (AC 5)
        orchestrator.subscribeToActionEvents(emailActionsService.getEvents$())
        orchestrator.subscribeToActionEvents(sendQueueService.getEvents$())

        // Initialize debug helpers for development testing
        initDebugHelpers()
        setInitialized(true)
      } catch (err) {
        // Story 1.20: Database health signal on failure
        healthRegistry.setDatabaseHealth(
          false,
          err instanceof Error ? err.message : 'Unknown error'
        )
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [setInitialized, setLoading, setError])

  // Handle OAuth callback when redirected back from provider (Gmail or Outlook)
  useEffect(() => {
    if (!initialized) return

    const handleOAuthCallback = async () => {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')

      // Not an OAuth callback
      if (!code || !state) return

      // Determine which provider this callback is for
      const provider = getOAuthProvider()
      logger.info('auth', 'OAuth callback detected', { provider })

      try {
        let accountId: string

        if (provider === 'outlook') {
          // Handle Outlook OAuth callback
          const { code: authCode, state: authState } = outlookOAuthService.handleCallback(
            window.location.href
          )
          const tokens = await outlookOAuthService.exchangeCodeForTokens(authCode, authState)

          // Fetch user info from Microsoft Graph to get email
          const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          })

          if (!userInfoResponse.ok) {
            throw new Error('Failed to fetch user info from Microsoft')
          }

          const userInfo = await userInfoResponse.json()
          accountId = userInfo.mail || userInfo.userPrincipalName

          if (!accountId) {
            throw new Error('No email returned from Microsoft userinfo')
          }

          // Store tokens
          await tokenStorageService.storeTokens(accountId, tokens)
        } else {
          // Default to Gmail OAuth callback
          const { code: authCode, state: authState } = gmailOAuthService.handleCallback(
            window.location.href
          )
          const tokens = await gmailOAuthService.exchangeCodeForTokens(authCode, authState)

          // Fetch user info from Google to get email
          const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          })

          if (!userInfoResponse.ok) {
            throw new Error('Failed to fetch user info from Google')
          }

          const userInfo = await userInfoResponse.json()
          accountId = userInfo.email

          if (!accountId) {
            throw new Error('No email returned from Google userinfo')
          }

          // Store tokens
          await tokenStorageService.storeTokens(accountId, tokens)
        }

        logger.info('auth', 'OAuth flow completed successfully', { accountId, provider })

        // Clear provider tracking
        clearOAuthProvider()

        // Clear URL parameters and redirect to root
        window.history.replaceState({}, document.title, '/')

        // Reload accounts from storage
        const loadedAccounts = await loadAccountsFromStorage()
        setAccounts(loadedAccounts)

        // Initialize sync state and start syncing for the new account
        if (syncOrchestratorService) {
          await syncOrchestratorService.addAccount(accountId, provider || 'gmail')
          // Start orchestrator if not already started
          await syncOrchestratorService.start()
          logger.info('sync', 'Account registered with sync orchestrator', { accountId, provider })
        }
      } catch (err) {
        logger.error('auth', 'OAuth callback failed', {
          error: err instanceof Error ? err.message : String(err),
          provider,
        })
        // Clear provider tracking
        clearOAuthProvider()
        // Clear URL parameters even on error and redirect to root
        window.history.replaceState({}, document.title, '/')
      }
    }

    handleOAuthCallback()
  }, [initialized, setAccounts])

  // Initialize token refresh and re-auth notification system
  useEffect(() => {
    if (!initialized) return

    // Start token refresh scheduler
    tokenRefreshService.startScheduler()

    // Initialize re-auth notification integration
    const cleanupNotifications = initializeReAuthNotifications()

    // Load accounts from token storage and initialize sync orchestrator
    const initializeAccounts = async () => {
      const loadedAccounts = await loadAccountsFromStorage()
      setAccounts(loadedAccounts)

      // Ensure active account is set (fix for sync button being disabled)
      if (loadedAccounts.length > 0 && !useAccountStore.getState().activeAccountId) {
        useAccountStore.getState().setActiveAccount(loadedAccounts[0].id)
        logger.info('auth', 'Set active account', { accountId: loadedAccounts[0].id })
      }

      // Register all loaded accounts with sync orchestrator and start it
      if (syncOrchestratorService && loadedAccounts.length > 0) {
        for (const account of loadedAccounts) {
          await syncOrchestratorService.addAccount(account.id, account.provider)
        }
        await syncOrchestratorService.start()
        logger.info('sync', 'Sync orchestrator started with loaded accounts', {
          accountCount: loadedAccounts.length,
        })
      }
    }

    initializeAccounts()

    return () => {
      tokenRefreshService.stopScheduler()
      cleanupNotifications()
      // Stop sync orchestrator on unmount
      syncOrchestratorService?.stop()
    }
  }, [initialized, setAccounts])

  // Story 1.15: Trigger immediate sync on account switch (AC 8)
  const prevAccountIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!initialized || !activeAccountId || !syncOrchestratorService) return
    // Only trigger on actual switch, not initial load
    if (prevAccountIdRef.current !== null && prevAccountIdRef.current !== activeAccountId) {
      syncOrchestratorService.onAccountSwitch(activeAccountId)
    }
    prevAccountIdRef.current = activeAccountId
  }, [activeAccountId, initialized])

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

  // Handle connect Gmail account click - initiate Gmail OAuth flow
  const handleConnectGmail = useCallback(async () => {
    try {
      // Dismiss welcome screen on connect action
      if (!hasSeenWelcome) {
        dismissWelcome()
      }
      // Use accountManager to track provider and initiate OAuth
      await connectGmailAccount()
    } catch (err) {
      logger.error('auth', 'Failed to initiate Gmail OAuth', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }, [hasSeenWelcome, dismissWelcome])

  // Handle connect Outlook account click - initiate Microsoft OAuth flow
  const handleConnectOutlook = useCallback(async () => {
    try {
      // Dismiss welcome screen on connect action
      if (!hasSeenWelcome) {
        dismissWelcome()
      }
      // Use accountManager to track provider and initiate OAuth
      await connectOutlookAccount()
    } catch (err) {
      logger.error('auth', 'Failed to initiate Outlook OAuth', {
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

  // Handle email selection from search results
  const handleSearchSelectEmail = useCallback(
    async (emailId: string) => {
      try {
        const db = getDatabase()
        const email = await db.emails.findOne(emailId).exec()
        if (email) {
          const emailDoc = email.toJSON()
          // Switch to the email's folder so it's visible in the list
          if (emailDoc.folder) {
            setSelectedFolder(emailDoc.folder)
          }
          setSelectedEmail(emailDoc.id, emailDoc.threadId)
          setActiveView('emails')
          logger.info('search', 'Email selected from search', {
            emailId,
            threadId: emailDoc.threadId,
            folder: emailDoc.folder,
          })
        }
      } catch (err) {
        logger.error('search', 'Failed to select email from search', { emailId, error: err })
      }
    },
    [setSelectedEmail, setSelectedFolder]
  )

  // Handle folder navigation (Story 2.11: Task 3.5)
  const handleNavigateToFolder = useCallback(
    (folder: string) => {
      setSelectedFolder(folder)
      setActiveView('emails')
      logger.info('navigation', 'Folder navigation via shortcut', { folder })
    },
    [setSelectedFolder]
  )

  // Email action handlers for CommandPalette
  const handleArchive = useCallback(async () => {
    if (!selectedEmailId) {
      logger.warn('actions', 'No email selected for archive')
      return
    }
    try {
      await emailActionsService.archiveEmail(selectedEmailId)
      logger.info('actions', 'Email archived via command palette', { emailId: selectedEmailId })
    } catch (err) {
      logger.error('actions', 'Failed to archive email', { error: err })
    }
  }, [selectedEmailId])

  const handleDelete = useCallback(async () => {
    if (!selectedEmailId) {
      logger.warn('actions', 'No email selected for delete')
      return
    }
    try {
      await emailActionsService.deleteEmail(selectedEmailId)
      logger.info('actions', 'Email deleted via command palette', { emailId: selectedEmailId })
    } catch (err) {
      logger.error('actions', 'Failed to delete email', { error: err })
    }
  }, [selectedEmailId])

  const handleStar = useCallback(async () => {
    if (!selectedEmailId) {
      logger.warn('actions', 'No email selected for star')
      return
    }
    try {
      const db = getDatabase()
      const emailDoc = await db.emails.findOne(selectedEmailId).exec()
      if (emailDoc) {
        const email = emailDoc.toJSON()
        const newStarred = !email.starred
        const newLabels = newStarred
          ? [...email.labels.filter((l: string) => l !== 'STARRED'), 'STARRED']
          : email.labels.filter((l: string) => l !== 'STARRED')
        await emailDoc.update({
          $set: { starred: newStarred, labels: newLabels },
        })
        logger.info(
          'actions',
          `Email ${newStarred ? 'starred' : 'unstarred'} via command palette`,
          { emailId: selectedEmailId }
        )
      }
    } catch (err) {
      logger.error('actions', 'Failed to toggle star', { error: err })
    }
  }, [selectedEmailId])

  const handleReply = useCallback(async () => {
    if (!selectedEmailId) {
      logger.warn('actions', 'No email selected for reply')
      return
    }
    try {
      const db = getDatabase()
      const emailDoc = await db.emails.findOne(selectedEmailId).exec()
      if (emailDoc) {
        const email = emailDoc.toJSON()
        const context = buildReplyContext(email)
        openComposeWithContext(context)
        logger.info('actions', 'Reply initiated via keyboard shortcut', {
          emailId: selectedEmailId,
        })
      }
    } catch (err) {
      logger.error('actions', 'Failed to initiate reply', { error: err })
    }
  }, [selectedEmailId, openComposeWithContext])

  const handleForward = useCallback(async () => {
    if (!selectedEmailId) {
      logger.warn('actions', 'No email selected for forward')
      return
    }
    try {
      const db = getDatabase()
      const emailDoc = await db.emails.findOne(selectedEmailId).exec()
      if (emailDoc) {
        const email = emailDoc.toJSON()
        const context = buildForwardContext(email)
        openComposeWithContext(context)
        logger.info('actions', 'Forward initiated via keyboard shortcut', {
          emailId: selectedEmailId,
        })
      }
    } catch (err) {
      logger.error('actions', 'Failed to initiate forward', { error: err })
    }
  }, [selectedEmailId, openComposeWithContext])

  // Handle sending email via send queue
  // Matches ComposeDialog onSend prop type
  const handleSendEmail = useCallback(
    async (data: {
      to: { name: string; email: string }[]
      cc: { name: string; email: string }[]
      bcc: { name: string; email: string }[]
      subject: string
      body: { html: string; text: string }
      attachments: ComposeAttachment[]
    }) => {
      try {
        // Get the active account to construct proper provider:email format
        const activeAccount = accounts.find((a) => a.id === activeAccountId)
        if (!activeAccount) {
          throw new Error('No account selected for sending')
        }

        // Construct accountId in format expected by sendQueueService (provider:email)
        const sendAccountId = `${activeAccount.provider}:${activeAccount.email}`

        // Get reply context from compose context (set when opening reply/forward)
        const replyToEmailId = composeContext?.replyToEmailId
        const threadId = composeContext?.threadId
        const isReply = composeContext?.type === 'reply' || composeContext?.type === 'reply-all'
        const isForward = composeContext?.type === 'forward'

        // Prepare attachments with base64 content
        const preparedAttachments =
          data.attachments.length > 0 ? await prepareAttachmentsForSend(data.attachments) : []

        // Create draft document for send queue
        const draftType = isReply ? 'reply' : isForward ? 'forward' : 'new'
        const draft = {
          id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          accountId: sendAccountId,
          type: draftType as 'new' | 'reply' | 'forward',
          to: data.to,
          cc: data.cc,
          bcc: data.bcc,
          subject: data.subject,
          body: data.body,
          attachments: preparedAttachments,
          replyToEmailId,
          threadId,
          createdAt: Date.now(),
          lastSaved: Date.now(),
        }

        // Queue for sending
        await sendQueueService.queueEmail(draft)
        logger.info('compose', 'Email queued for sending', {
          to: data.to.length,
          subject: data.subject.slice(0, 50),
          attachmentCount: preparedAttachments.length,
        })
      } catch (err) {
        logger.error('compose', 'Failed to queue email', { error: err })
        throw err // Re-throw so ComposeDialog can show error
      }
    },
    [accounts, activeAccountId, composeContext]
  )

  // Story 2.11: Global keyboard shortcuts using react-hotkeys-hook
  // Shortcuts only active when not in compose or search modes
  const shortcutsEnabled = initialized && !composeOpen && !searchOpen

  // Separate handlers for search (/) and actions (Cmd+K)
  const handleOpenSearch = useCallback(() => {
    openSearch('search')
  }, [openSearch])

  const handleOpenActions = useCallback(() => {
    openSearch('actions')
  }, [openSearch])

  useGlobalShortcuts({
    onCompose: openCompose,
    onOpenSearch: handleOpenSearch,
    onOpenActions: handleOpenActions,
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
    return (
      <WelcomeScreen
        onConnectGmail={handleConnectGmail}
        onConnectOutlook={handleConnectOutlook}
        onSkip={dismissWelcome}
      />
    )
  }

  // Show email client UI once database is initialized
  return (
    <ShortcutProvider initialScope="inbox">
      <ActionAnnouncer>
        <QueueProcessorProvider>
          {/* Story 2.11: Task 9.4 - Skip links for keyboard-only users */}
          <SkipLinks />

          {/* Undo toast (fixed position, bottom-right) - outside main container for proper fixed positioning */}
          <UndoToast />

          <div className="h-screen flex flex-col">
            {/* Re-auth notifications (fixed position, top-right) */}
            <ReAuthNotificationContainer />

            {/* Circuit breaker notifications (fixed position, top-center) - Story 1.19 */}
            <CircuitBreakerNotification />

            {/* Bankruptcy notification (fixed position, below circuit breaker) - Story 1.16 */}
            <BankruptcyNotification />

            {/* Compose Dialog - Lazy loaded (Story 2.10: Task 6) */}
            {composeOpen && (
              <Suspense fallback={<ComposeLoadingFallback />}>
                <ComposeDialog
                  open={composeOpen}
                  onClose={closeCompose}
                  initialContext={composeContext ?? undefined}
                  draftId={composeDraftId ?? undefined}
                  accountId={activeAccountId ?? ''}
                  onSend={handleSendEmail}
                />
              </Suspense>
            )}

            {/* Account Settings Modal */}
            {showAccountSettings && (
              // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
              <div
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                role="dialog"
                aria-modal="true"
                aria-label="Account settings"
                onClick={(e) => {
                  // Close on backdrop click
                  if (e.target === e.currentTarget) {
                    setShowAccountSettings(false)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowAccountSettings(false)
                  }
                }}
              >
                <div style={{ width: '400px', maxHeight: '90vh' }} className="overflow-y-auto">
                  <AccountSettings
                    onClose={() => setShowAccountSettings(false)}
                    onConnectGmail={handleConnectGmail}
                    onConnectOutlook={handleConnectOutlook}
                  />
                </div>
              </div>
            )}

            {/* Command Palette / Search - Lazy loaded (Story 2.10: Task 6) */}
            {/* / opens search mode, Cmd+K opens actions mode */}
            {searchOpen && (
              <Suspense fallback={<SearchLoadingFallback />}>
                <CommandPalette
                  open={searchOpen}
                  onClose={closeSearch}
                  mode={searchMode}
                  onSelectEmail={handleSearchSelectEmail}
                  onCompose={openCompose}
                  onNavigate={handleNavigateToFolder}
                  onArchive={handleArchive}
                  onDelete={handleDelete}
                  onReply={handleReply}
                  onForward={handleForward}
                  onStar={handleStar}
                  onShowShortcuts={handleShowShortcutOverlay}
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
                  onClick={handleOpenSearch}
                  onMouseEnter={() => lazyComponents.commandPalette.preload()}
                  className="flex items-center gap-2 text-slate-500"
                >
                  <Search className="w-4 h-4" />
                  <span className="hidden sm:inline">Search</span>
                  <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 rounded">
                    /
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

                {/* Subsystem health indicator - Story 1.20 */}
                <HealthIndicator />

                {/* Sync status indicators */}
                <div className="flex items-center gap-2">
                  <QueueStatusBadge />
                  <ConflictIndicator />
                  <SyncButton />
                </div>

                {/* Account switcher */}
                <AccountSwitcher
                  onConnectGmail={handleConnectGmail}
                  onConnectOutlook={handleConnectOutlook}
                  onManageAccounts={() => setShowAccountSettings(true)}
                />
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

          {/* Dev-only performance monitor with health debug panel */}
          {import.meta.env.DEV && <PerformanceMonitor />}
        </QueueProcessorProvider>
      </ActionAnnouncer>
    </ShortcutProvider>
  )
}

export default App
