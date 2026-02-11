/**
 * FeedbackToastContainer Component
 *
 * Story 3.6: Manual Priority Adjustment & Feedback Loop
 * Task 7: "AI learned" toast notification
 *
 * Portal-based toast following the NudgeToastContainer pattern.
 * Bottom-center position, auto-dismiss after 5 seconds.
 */

import { useEffect, memo } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, X } from 'lucide-react'
import { useFeedbackToastStore } from '@/store/feedbackToastStore'

const AUTO_DISMISS_MS = 5000

export const FeedbackToastContainer = memo(function FeedbackToastContainer() {
  const { activeToast, dismissToast } = useFeedbackToastStore()

  useEffect(() => {
    if (!activeToast) return

    const timer = setTimeout(() => {
      dismissToast()
    }, AUTO_DISMISS_MS)

    return () => clearTimeout(timer)
  }, [activeToast, dismissToast])

  if (!activeToast) {
    return null
  }

  const content = (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
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
        animation: 'feedback-toast-fade-in 200ms ease-out',
      }}
      role="status"
      aria-live="polite"
    >
      <Sparkles style={{ width: 16, height: 16, color: '#a78bfa', flexShrink: 0 }} />
      <span>{activeToast.message}</span>
      <button
        type="button"
        onClick={dismissToast}
        style={{
          marginLeft: '4px',
          padding: '2px',
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: '4px',
          color: '#94a3b8',
          cursor: 'pointer',
        }}
        aria-label="Dismiss"
      >
        <X style={{ width: 14, height: 14 }} />
      </button>
      <style>{`
        @keyframes feedback-toast-fade-in {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )

  return createPortal(content, document.body)
})
