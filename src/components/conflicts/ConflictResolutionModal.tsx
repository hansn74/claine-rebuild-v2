/**
 * ConflictResolutionModal Component
 * Modal for manually resolving sync conflicts
 *
 * AC6: User prompted with diff view for body/subject conflicts
 * AC7: User can choose: Keep Local, Keep Server, or Merge manually
 * AC8: Conflict resolution UI shows local/server versions with diff highlighting
 */

import { useState, useMemo, useCallback } from 'react'
import { Button } from '@shared/components/ui/button'
import type { PendingConflict, ConflictEmailData } from '@/services/sync/conflictDetection'
import type { Resolution } from '@/store/conflictStore'

export interface ConflictResolutionModalProps {
  /** The conflict to resolve */
  conflict: PendingConflict
  /** Called when a resolution is chosen */
  onResolve: (resolution: Resolution, mergedData?: ConflictEmailData) => void
  /** Called when modal is dismissed without resolution */
  onCancel: () => void
}

/**
 * ConflictResolutionModal component
 * Shows side-by-side diff and resolution options
 */
export function ConflictResolutionModal({
  conflict,
  onResolve,
  onCancel,
}: ConflictResolutionModalProps) {
  const [showMergeEditor, setShowMergeEditor] = useState(false)
  const [mergedSubject, setMergedSubject] = useState(conflict.localVersion.subject)
  const [mergedBodyText, setMergedBodyText] = useState(conflict.localVersion.body.text || '')

  const formatDate = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

  const handleKeepLocal = useCallback(() => {
    onResolve('local')
  }, [onResolve])

  const handleKeepServer = useCallback(() => {
    onResolve('server')
  }, [onResolve])

  const handleMerge = useCallback(() => {
    const mergedData: ConflictEmailData = {
      ...conflict.localVersion,
      subject: mergedSubject,
      body: {
        ...conflict.localVersion.body,
        text: mergedBodyText,
      },
    }
    onResolve('merged', mergedData)
  }, [conflict.localVersion, mergedSubject, mergedBodyText, onResolve])

  // Calculate diff highlights
  const diffs = useMemo(() => {
    return computeDiffs(conflict.localVersion, conflict.serverVersion)
  }, [conflict.localVersion, conflict.serverVersion])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} aria-hidden="true" />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Resolve Sync Conflict</h2>
            <p className="text-sm text-slate-500 mt-1">
              Conflict detected: {conflict.conflictingFields.join(', ')}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {!showMergeEditor ? (
            // Side-by-side comparison view
            <div className="grid grid-cols-2 gap-6">
              {/* Local Version */}
              <div className="border border-cyan-200 rounded-lg overflow-hidden">
                <div className="bg-cyan-50 px-4 py-2 border-b border-cyan-200">
                  <h3 className="font-medium text-cyan-900">Your Local Version</h3>
                  <p className="text-xs text-cyan-700">
                    Modified:{' '}
                    {formatDate(
                      conflict.localVersion.localModifiedAt || conflict.localVersion.timestamp
                    )}
                  </p>
                </div>
                <div className="p-4 space-y-4">
                  <VersionField
                    label="Subject"
                    value={conflict.localVersion.subject}
                    isDiff={diffs.subject}
                    highlightClass="bg-cyan-100"
                  />
                  <VersionField
                    label="Body"
                    value={conflict.localVersion.body.text || '(no text content)'}
                    isDiff={diffs.body}
                    highlightClass="bg-cyan-100"
                    isLong
                  />
                  {diffs.read && (
                    <VersionField
                      label="Read Status"
                      value={conflict.localVersion.read ? 'Read' : 'Unread'}
                      isDiff
                      highlightClass="bg-cyan-100"
                    />
                  )}
                  {diffs.starred && (
                    <VersionField
                      label="Starred"
                      value={conflict.localVersion.starred ? 'Yes' : 'No'}
                      isDiff
                      highlightClass="bg-cyan-100"
                    />
                  )}
                  {diffs.labels && (
                    <VersionField
                      label="Labels"
                      value={conflict.localVersion.labels.join(', ') || '(none)'}
                      isDiff
                      highlightClass="bg-cyan-100"
                    />
                  )}
                </div>
              </div>

              {/* Server Version */}
              <div className="border border-green-200 rounded-lg overflow-hidden">
                <div className="bg-green-50 px-4 py-2 border-b border-green-200">
                  <h3 className="font-medium text-green-900">Server Version</h3>
                  <p className="text-xs text-green-700">
                    Timestamp: {formatDate(conflict.serverVersion.timestamp)}
                  </p>
                </div>
                <div className="p-4 space-y-4">
                  <VersionField
                    label="Subject"
                    value={conflict.serverVersion.subject}
                    isDiff={diffs.subject}
                    highlightClass="bg-green-100"
                  />
                  <VersionField
                    label="Body"
                    value={conflict.serverVersion.body.text || '(no text content)'}
                    isDiff={diffs.body}
                    highlightClass="bg-green-100"
                    isLong
                  />
                  {diffs.read && (
                    <VersionField
                      label="Read Status"
                      value={conflict.serverVersion.read ? 'Read' : 'Unread'}
                      isDiff
                      highlightClass="bg-green-100"
                    />
                  )}
                  {diffs.starred && (
                    <VersionField
                      label="Starred"
                      value={conflict.serverVersion.starred ? 'Yes' : 'No'}
                      isDiff
                      highlightClass="bg-green-100"
                    />
                  )}
                  {diffs.labels && (
                    <VersionField
                      label="Labels"
                      value={conflict.serverVersion.labels.join(', ') || '(none)'}
                      isDiff
                      highlightClass="bg-green-100"
                    />
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Merge editor view
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="merge-subject"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Subject
                </label>
                <input
                  id="merge-subject"
                  type="text"
                  value={mergedSubject}
                  onChange={(e) => setMergedSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                />
              </div>
              <div>
                <label
                  htmlFor="merge-body"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Body
                </label>
                <textarea
                  id="merge-body"
                  value={mergedBodyText}
                  onChange={(e) => setMergedBodyText(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 font-mono text-sm"
                />
              </div>
              <div className="bg-slate-50 p-3 rounded-md">
                <p className="text-sm text-slate-600">
                  <strong>Reference:</strong> Edit the fields above to create your merged version.
                  You can copy content from either the local or server version.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          {!showMergeEditor ? (
            <>
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowMergeEditor(true)}>
                  <MergeIcon />
                  Merge Manually
                </Button>
                <Button
                  variant="outline"
                  onClick={handleKeepServer}
                  className="border-green-500 text-green-700 hover:bg-green-50"
                >
                  <ServerIcon />
                  Keep Server
                </Button>
                <Button onClick={handleKeepLocal} className="bg-cyan-600 hover:bg-cyan-700">
                  <LocalIcon />
                  Keep Local
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setShowMergeEditor(false)}>
                Back to Comparison
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button onClick={handleMerge}>
                  <CheckIcon />
                  Apply Merged Version
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Helper to compute which fields differ
 */
function computeDiffs(
  local: ConflictEmailData,
  server: ConflictEmailData
): {
  subject: boolean
  body: boolean
  read: boolean
  starred: boolean
  labels: boolean
} {
  return {
    subject: local.subject !== server.subject,
    body: local.body.text !== server.body.text || local.body.html !== server.body.html,
    read: local.read !== server.read,
    starred: local.starred !== server.starred,
    labels:
      local.labels.length !== server.labels.length ||
      local.labels.some((l) => !server.labels.includes(l)),
  }
}

/**
 * Field display component
 */
interface VersionFieldProps {
  label: string
  value: string
  isDiff?: boolean
  highlightClass?: string
  isLong?: boolean
}

function VersionField({ label, value, isDiff, highlightClass, isLong }: VersionFieldProps) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
        {label}
        {isDiff && <span className="ml-2 text-amber-600 normal-case">(changed)</span>}
      </div>
      <div
        className={`text-sm text-slate-900 ${isDiff ? highlightClass : ''} ${
          isLong
            ? 'max-h-40 overflow-y-auto p-2 rounded border border-slate-200 whitespace-pre-wrap font-mono text-xs'
            : 'p-1 rounded'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

// Icons

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function MergeIcon() {
  return (
    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M8 7h8"
      />
    </svg>
  )
}

function ServerIcon() {
  return (
    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
      />
    </svg>
  )
}

function LocalIcon() {
  return (
    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}
