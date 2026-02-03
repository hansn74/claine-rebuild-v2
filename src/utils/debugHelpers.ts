/**
 * Debug Helpers for Development and Testing
 *
 * Exposes internal services to the browser console for debugging.
 * Only active in development mode.
 *
 * Usage in browser console:
 * - window.modifierQueue.getAllPendingModifiers()
 * - window.modifierProcessor.isOnline()
 * - window.debug.getModifierState()
 * - window.debug.fullReset() - Complete app reset for testing
 * - window.emailActionsService.archiveEmail(id, accountId)
 * - window.moveService.moveEmail(id, folder, accountId, provider)
 */

/* eslint-disable no-console */

import { modifierQueue, modifierProcessor } from '@/services/modifiers'
import { emailActionsService } from '@/services/email/emailActionsService'
import { moveService } from '@/services/email/moveService'
import { getDatabase, isDatabaseInitialized } from '@/services/database/init'
import { circuitBreaker } from '@/services/sync/circuitBreaker'
import type { CircuitBreaker } from '@/services/sync/circuitBreaker'

/**
 * Extended debug interface with helper methods
 */
interface DebugHelpers {
  getModifierState: () => {
    pending: ReturnType<typeof modifierQueue.getAllPendingModifiers>
    isOnline: boolean
    isProcessing: boolean
  }
  forceProcessQueue: () => Promise<void>
  clearAllModifiers: () => Promise<void>
  getModifiersForEmail: (emailId: string) => ReturnType<typeof modifierQueue.getModifiersForEntity>
  fullReset: () => Promise<void>
}

declare global {
  interface Window {
    modifierQueue: typeof modifierQueue
    modifierProcessor: typeof modifierProcessor
    emailActionsService: typeof emailActionsService
    moveService: typeof moveService
    debug: DebugHelpers
    __TEST_CIRCUIT_BREAKER__: CircuitBreaker
  }
}

/**
 * Initialize debug helpers (only in development)
 */
export function initDebugHelpers(): void {
  if (import.meta.env.DEV) {
    // Expose modifier services
    window.modifierQueue = modifierQueue
    window.modifierProcessor = modifierProcessor

    // Expose email services for testing
    window.emailActionsService = emailActionsService
    window.moveService = moveService

    // Expose circuit breaker for E2E testing (Story 1.19)
    window.__TEST_CIRCUIT_BREAKER__ = circuitBreaker

    // Add helper methods
    window.debug = {
      getModifierState: () => ({
        pending: modifierQueue.getAllPendingModifiers(),
        isOnline: modifierProcessor.isOnline(),
        isProcessing: modifierProcessor.isProcessing(),
      }),

      forceProcessQueue: async () => {
        await modifierProcessor.processQueue()
      },

      clearAllModifiers: async () => {
        const pending = modifierQueue.getAllPendingModifiers()
        for (const mod of pending) {
          await modifierQueue.remove(mod.id)
        }
        console.log(`Cleared ${pending.length} modifiers`)
      },

      getModifiersForEmail: (emailId: string) => {
        return modifierQueue.getModifiersForEntity(emailId)
      },

      fullReset: async () => {
        console.log('%c[Reset] Starting full app reset...', 'color: #ef4444; font-weight: bold')

        // 1. Shutdown modifier processor to stop any pending operations
        console.log('[Reset] Shutting down modifier processor...')
        modifierProcessor.shutdown()

        // 2. Export auth tokens before destroying database
        interface ExportedToken {
          id: string
          account_id: string
          ciphertext: string
          iv: string
          tag: string
          encrypted_at: string
          updated_at: string
          expires_at: string
        }
        let exportedTokens: ExportedToken[] = []
        if (isDatabaseInitialized()) {
          const db = getDatabase()
          if (db.authTokens) {
            console.log('[Reset] Exporting auth tokens...')
            const tokenDocs = await db.authTokens.find().exec()
            exportedTokens = tokenDocs.map((doc) => ({
              id: doc.id,
              account_id: doc.account_id,
              ciphertext: doc.ciphertext,
              iv: doc.iv,
              tag: doc.tag,
              encrypted_at: doc.encrypted_at,
              updated_at: doc.updated_at,
              expires_at: doc.expires_at,
            }))
            console.log(`[Reset] Exported ${exportedTokens.length} auth tokens`)
          }
        }

        // 3. Store tokens temporarily in sessionStorage
        if (exportedTokens.length > 0) {
          sessionStorage.setItem('__reset_tokens__', JSON.stringify(exportedTokens))
        }

        // 4. Destroy RxDB database
        if (isDatabaseInitialized()) {
          const db = getDatabase()
          console.log('[Reset] Destroying RxDB database...')
          try {
            await db.destroy()
            console.log('[Reset] RxDB database destroyed')
          } catch (e) {
            console.warn('[Reset] Error destroying database:', e)
          }
        }

        // 5. Delete all IndexedDB databases
        console.log('[Reset] Deleting IndexedDB databases...')
        const databases = await indexedDB.databases()
        for (const dbInfo of databases) {
          if (dbInfo.name) {
            console.log(`[Reset] Deleting IndexedDB: ${dbInfo.name}`)
            indexedDB.deleteDatabase(dbInfo.name)
          }
        }

        // 6. Clear localStorage (but keep encryption key)
        console.log('[Reset] Clearing localStorage (keeping encryption)...')
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && !key.includes('encryption')) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key))
        console.log(`[Reset] Removed ${keysToRemove.length} localStorage keys`)

        console.log('%c[Reset] Complete! Reloading page...', 'color: #22c55e; font-weight: bold')
        console.log('[Reset] Auth tokens will be restored on reload')

        // 7. Reload the page
        setTimeout(() => {
          window.location.reload()
        }, 500)
      },
    }

    console.log(
      '%c[Debug] Epic 3 Modifier System - Debug Mode Enabled',
      'color: #22c55e; font-weight: bold'
    )
    console.log('%cModifier Queue & Processor:', 'color: #3b82f6; font-weight: bold')
    console.log('  window.modifierQueue.getAllPendingModifiers()')
    console.log('  window.modifierProcessor.isOnline()')
    console.log('  window.modifierProcessor.isProcessing()')
    console.log('%cDebug Helpers:', 'color: #3b82f6; font-weight: bold')
    console.log('  window.debug.getModifierState()')
    console.log('  window.debug.forceProcessQueue()')
    console.log('  window.debug.clearAllModifiers()')
    console.log('  window.debug.getModifiersForEmail(emailId)')
    console.log('%c  window.debug.fullReset() - FULL APP RESET', 'color: #ef4444')
    console.log('%cServices:', 'color: #3b82f6; font-weight: bold')
    console.log('  window.emailActionsService.archiveEmail(emailId, accountId)')
    console.log('  window.emailActionsService.deleteEmail(emailId, accountId)')
    console.log(
      '  window.emailActionsService.toggleReadStatus(emailId, accountId, currentReadState)'
    )
    console.log('  window.moveService.moveEmail(emailId, targetFolder, accountId, provider)')
    console.log('%cCircuit Breaker (Story 1.19):', 'color: #3b82f6; font-weight: bold')
    console.log('  window.__TEST_CIRCUIT_BREAKER__.recordFailure("gmail")  // trip breaker')
    console.log('  window.__TEST_CIRCUIT_BREAKER__.getState("gmail")       // check state')
    console.log('  window.__TEST_CIRCUIT_BREAKER__.forceProbe("gmail")     // force retry')
    console.log('  window.__TEST_CIRCUIT_BREAKER__.resetAll()              // reset all')
    console.log('%cEvent Monitoring:', 'color: #3b82f6; font-weight: bold')
    console.log('  window.modifierQueue.getEvents$().subscribe(e => console.log(e))')
    console.log('  window.modifierProcessor.getEvents$().subscribe(e => console.log(e))')
  }
}
