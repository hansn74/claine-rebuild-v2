/**
 * Loading Fallback Components
 *
 * Story 2.10: Performance Optimization & Benchmarking
 * Task 6.5: Create loading fallback components for lazy-loaded routes
 *
 * Provides Suspense fallback components for various lazy-loaded components.
 * Each fallback matches the expected layout of its corresponding component.
 */

import { cn } from '@/utils/cn'

/**
 * Spinner component for loading states
 */
function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-slate-300 border-t-blue-500',
        className
      )}
    />
  )
}

/**
 * Generic loading fallback with centered spinner
 */
export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center p-8', className)}>
      <Spinner className="h-8 w-8" />
    </div>
  )
}

/**
 * Full-page loading fallback
 */
export function PageLoadingFallback() {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-4">
      <Spinner className="h-12 w-12" />
      <p className="text-slate-600">Loading...</p>
    </div>
  )
}

/**
 * Dialog/Modal loading fallback
 * Matches the ComposeDialog layout
 */
export function DialogLoadingFallback() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />
      {/* Loading card */}
      <div className="relative bg-white rounded-lg shadow-xl p-8 flex flex-col items-center gap-4">
        <Spinner className="h-10 w-10" />
        <p className="text-slate-600">Loading...</p>
      </div>
    </div>
  )
}

/**
 * Compose modal loading fallback
 * Skeleton matching ComposeDialog layout
 */
export function ComposeLoadingFallback() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />
      {/* Dialog skeleton */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-8 w-8 bg-slate-200 rounded animate-pulse" />
        </div>
        {/* To/Subject fields */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-4 w-12 bg-slate-200 rounded animate-pulse" />
            <div className="flex-1 h-8 bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-4 w-12 bg-slate-200 rounded animate-pulse" />
            <div className="flex-1 h-8 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
        {/* Body area */}
        <div className="p-4 min-h-[200px]">
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 rounded animate-pulse w-full" />
            <div className="h-4 bg-slate-200 rounded animate-pulse w-4/5" />
            <div className="h-4 bg-slate-200 rounded animate-pulse w-3/5" />
          </div>
        </div>
        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <div className="h-9 w-20 bg-slate-200 rounded animate-pulse" />
          <div className="h-9 w-20 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}

/**
 * Search/Command palette loading fallback
 */
export function SearchLoadingFallback() {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />
      {/* Search skeleton */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-xl mx-4 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 p-4 border-b">
          <div className="h-5 w-5 bg-slate-200 rounded animate-pulse" />
          <div className="flex-1 h-8 bg-slate-200 rounded animate-pulse" />
        </div>
        {/* Results skeleton */}
        <div className="p-2 space-y-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded">
              <div className="h-8 w-8 bg-slate-200 rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-slate-200 rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Thread detail view loading fallback
 */
export function ThreadDetailLoadingFallback() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="h-6 w-3/4 bg-slate-200 rounded animate-pulse mb-2" />
        <div className="h-4 w-1/2 bg-slate-200 rounded animate-pulse" />
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-lg border p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="h-10 w-10 bg-slate-200 rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded animate-pulse w-1/3" />
                <div className="h-3 bg-slate-200 rounded animate-pulse w-1/4" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-slate-200 rounded animate-pulse w-full" />
              <div className="h-4 bg-slate-200 rounded animate-pulse w-5/6" />
              <div className="h-4 bg-slate-200 rounded animate-pulse w-4/6" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Email list loading fallback
 */
export function EmailListLoadingFallback() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-slate-200 bg-slate-50">
        <div className="h-5 w-24 bg-slate-200 rounded animate-pulse mb-1" />
        <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
      </div>
      {/* List items */}
      <div className="flex-1 overflow-auto">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-3 border-b border-slate-100">
            <div className="flex items-start gap-3">
              <div className="h-4 w-4 bg-slate-200 rounded animate-pulse mt-1" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-slate-200 rounded animate-pulse w-1/3" />
                  <div className="h-3 bg-slate-200 rounded animate-pulse w-16" />
                </div>
                <div className="h-4 bg-slate-200 rounded animate-pulse w-2/3" />
                <div className="h-3 bg-slate-200 rounded animate-pulse w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default LoadingSpinner
