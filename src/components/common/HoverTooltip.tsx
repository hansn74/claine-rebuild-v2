/**
 * HoverTooltip Component
 *
 * Story 2.23: Keyboard Shortcut Discoverability
 *
 * Pure CSS hover tooltip. Works in all major browsers (Safari, Chrome, Firefox).
 * Note: Some Chromium forks (e.g., Comet) may have hover detection issues - this is a browser bug.
 */

import { type ReactNode } from 'react'

export interface HoverTooltipProps {
  /** Tooltip content */
  content: string
  /** Child element to wrap */
  children: ReactNode
  /** Position relative to target */
  position?: 'top' | 'bottom'
}

/**
 * HoverTooltip - Shows tooltip on hover using pure CSS
 */
export function HoverTooltip({ content, children, position = 'bottom' }: HoverTooltipProps) {
  const tooltipPosition =
    position === 'bottom'
      ? { top: '100%', marginTop: '6px' }
      : { bottom: '100%', marginBottom: '6px' }

  return (
    <span className="hover-tooltip-wrapper">
      {children}
      <span className="hover-tooltip-content" style={tooltipPosition}>
        {content}
      </span>
      <style>{`
        .hover-tooltip-wrapper {
          position: relative;
          display: inline-flex;
        }
        .hover-tooltip-content {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          padding: 6px 10px;
          background-color: #1e293b;
          color: white;
          font-size: 12px;
          border-radius: 6px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          visibility: hidden;
          transition: opacity 0.15s, visibility 0.15s;
          z-index: 99999;
        }
        .hover-tooltip-wrapper:hover .hover-tooltip-content {
          opacity: 1;
          visibility: visible;
        }
      `}</style>
    </span>
  )
}
