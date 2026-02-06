/**
 * NudgeToastContainer Component
 *
 * Story 2.23: Keyboard Shortcut Discoverability
 *
 * Global container for nudge toasts rendered at App level.
 * Uses Portal to ensure proper z-index stacking.
 */

import { useEffect, memo } from 'react'
import { createPortal } from 'react-dom'
import { Lightbulb, X } from 'lucide-react'
import { useNudgeStore } from '@/store/nudgeStore'

const AUTO_DISMISS_MS = 5000

/**
 * NudgeToastContainer - Renders active nudge toast
 *
 * Place this component at the App level to ensure nudges
 * survive component unmounts (e.g., when email is deleted).
 */
export const NudgeToastContainer = memo(function NudgeToastContainer() {
  const { activeNudge, dismissNudge } = useNudgeStore()

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    if (!activeNudge) return

    const timer = setTimeout(() => {
      dismissNudge()
    }, AUTO_DISMISS_MS)

    return () => clearTimeout(timer)
  }, [activeNudge, dismissNudge])

  if (!activeNudge) {
    return null
  }

  const tooltipContent = (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 16px',
        backgroundColor: '#1e293b',
        color: 'white',
        borderRadius: '8px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        fontSize: '14px',
        animation: 'nudge-fade-in 200ms ease-out',
      }}
      role="alert"
      aria-live="polite"
    >
      <Lightbulb style={{ width: 16, height: 16, color: '#facc15', flexShrink: 0 }} />
      <span>
        Tip: press{' '}
        <kbd
          style={{
            padding: '2px 6px',
            backgroundColor: '#334155',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'monospace',
          }}
        >
          {activeNudge.shortcutKey}
        </kbd>{' '}
        to {activeNudge.actionName} faster
      </span>
      <button
        type="button"
        onClick={dismissNudge}
        style={{
          marginLeft: '4px',
          padding: '2px',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: '4px',
          color: '#94a3b8',
          cursor: 'pointer',
        }}
        aria-label="Dismiss tip"
      >
        <X style={{ width: 14, height: 14 }} />
      </button>
      {/* Inject animation keyframes */}
      <style>{`
        @keyframes nudge-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )

  return createPortal(tooltipContent, document.body)
})
