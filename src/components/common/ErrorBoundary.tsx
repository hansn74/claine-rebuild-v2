/**
 * Error Boundary Component
 *
 * Catches React component errors and displays a fallback UI.
 * Integrates with logger and Sentry for error tracking.
 *
 * Features:
 * - Catches errors in component tree
 * - Displays user-friendly fallback UI
 * - Logs errors with category 'ui'
 * - Reports to Sentry in production
 * - Provides "Report Issue" button
 *
 * Usage:
 *   import { ErrorBoundary } from '@/components/common/ErrorBoundary'
 *
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 *
 *   // With custom fallback
 *   <ErrorBoundary fallback={<CustomError />}>
 *     <YourComponent />
 *   </ErrorBoundary>
 */

import { Component, type ReactNode, type ErrorInfo } from 'react'
import { Button } from '@shared/components/ui/button'
import { logger, captureException } from '@/services/logger'

interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode
  /** Optional custom fallback UI */
  fallback?: ReactNode
  /** Optional callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorId: string | null
}

/**
 * Error Boundary class component
 * Uses class component because error boundaries require getDerivedStateFromError
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
    }
  }

  /**
   * Update state when error is caught
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }
  }

  /**
   * Log and report error when caught
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error with category
    logger.error('ui', 'React component error caught by ErrorBoundary', {
      errorName: error.name,
      errorMessage: error.message,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
    })

    // Report to Sentry
    captureException(error, {
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
    })

    // Call optional error callback
    this.props.onError?.(error, errorInfo)
  }

  /**
   * Reset error state to try rendering again
   */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
    })
  }

  /**
   * Reload the page
   */
  handleReload = (): void => {
    window.location.reload()
  }

  /**
   * Open GitHub issues page for reporting
   */
  handleReportIssue = (): void => {
    const { error, errorId } = this.state
    const issueTitle = encodeURIComponent(
      `[Bug] ${error?.name ?? 'Error'}: ${error?.message ?? 'Unknown error'}`
    )
    const issueBody = encodeURIComponent(
      `## Error Details\n\n` +
        `- **Error ID:** ${errorId}\n` +
        `- **Error:** ${error?.name ?? 'Unknown'}\n` +
        `- **Message:** ${error?.message ?? 'No message'}\n` +
        `- **Time:** ${new Date().toISOString()}\n` +
        `- **Browser:** ${navigator.userAgent}\n\n` +
        `## Steps to Reproduce\n\n` +
        `1. \n2. \n3. \n\n` +
        `## Expected Behavior\n\n` +
        `\n\n` +
        `## Actual Behavior\n\n` +
        `The application crashed with the above error.\n`
    )

    // Replace with actual repo URL
    const repoUrl = 'https://github.com/your-org/claine-v2'
    window.open(`${repoUrl}/issues/new?title=${issueTitle}&body=${issueBody}`, '_blank')
  }

  render(): ReactNode {
    const { hasError, error, errorId } = this.state
    const { children, fallback } = this.props

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              {/* Error icon */}
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>

              <h2 className="text-xl font-semibold text-slate-900 mb-2">Something went wrong</h2>

              <p className="text-slate-600 mb-4">
                We&apos;re sorry, but something unexpected happened. Please try refreshing the page
                or contact support if the problem persists.
              </p>

              {/* Error details (development only) */}
              {import.meta.env.DEV && error && (
                <div className="bg-slate-100 rounded p-3 mb-4 text-left">
                  <p className="text-sm font-mono text-red-600 break-all">
                    {error.name}: {error.message}
                  </p>
                  {errorId && <p className="text-xs text-slate-500 mt-1">ID: {errorId}</p>}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={this.handleReload} className="flex-1" variant="default">
                  Refresh Page
                </Button>

                <Button onClick={this.handleReset} className="flex-1" variant="outline">
                  Try Again
                </Button>
              </div>

              {/* Report issue link */}
              <button
                onClick={this.handleReportIssue}
                className="mt-4 text-sm text-cyan-600 hover:text-cyan-800 underline"
              >
                Report this issue
              </button>
            </div>
          </div>
        </div>
      )
    }

    return children
  }
}

export default ErrorBoundary
