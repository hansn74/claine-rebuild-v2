/**
 * EmailDetail Component
 * Displays full email content when selected
 *
 * AC4: Shows basic detail view of email
 */

import type { EmailDocument } from '@/services/database/schemas/email.schema'

interface EmailDetailProps {
  email: EmailDocument | null
}

/**
 * Format full date for email header
 */
function formatFullDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format email address for display
 */
function formatAddress(addr: { name: string; email: string }): string {
  if (addr.name && addr.name.trim()) {
    return `${addr.name} <${addr.email}>`
  }
  return addr.email
}

export function EmailDetail({ email }: EmailDetailProps) {
  // No email selected state
  if (!email) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-500">
        <div className="text-center">
          <div className="text-4xl mb-2">&#128231;</div>
          <p>Select an email to read</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white">
      {/* Email Header */}
      <div className="p-4 border-b border-slate-200">
        {/* Subject */}
        <h2 className="text-xl font-semibold text-slate-900 mb-3">
          {email.subject || '(No subject)'}
        </h2>

        {/* From */}
        <div className="flex items-start gap-3 mb-2">
          {/* Avatar placeholder */}
          <div className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center text-white font-medium flex-shrink-0">
            {email.from.name?.charAt(0)?.toUpperCase() || email.from.email.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-medium text-slate-900">{email.from.name || email.from.email}</div>
            <div className="text-sm text-slate-500">{email.from.email}</div>
          </div>

          <div className="text-sm text-slate-500 flex-shrink-0">
            {formatFullDate(email.timestamp)}
          </div>
        </div>

        {/* To */}
        <div className="text-sm text-slate-600">
          <span className="text-slate-500">To: </span>
          {email.to.map((addr, i) => (
            <span key={addr.email}>
              {i > 0 && ', '}
              {formatAddress(addr)}
            </span>
          ))}
        </div>

        {/* CC */}
        {email.cc && email.cc.length > 0 && (
          <div className="text-sm text-slate-600">
            <span className="text-slate-500">Cc: </span>
            {email.cc.map((addr, i) => (
              <span key={addr.email}>
                {i > 0 && ', '}
                {formatAddress(addr)}
              </span>
            ))}
          </div>
        )}

        {/* Attachments */}
        {email.attachments && email.attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {email.attachments.map((att) => (
              <div
                key={att.id}
                className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-sm text-slate-700"
              >
                <span>&#128206;</span>
                <span className="truncate max-w-[150px]">{att.filename}</span>
                <span className="text-slate-400 text-xs">({Math.round(att.size / 1024)}KB)</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Email Body */}
      <div className="flex-1 overflow-auto p-4">
        {email.body.html ? (
          // Render HTML body (sanitized in production)
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: email.body.html }} />
        ) : email.body.text ? (
          // Render plain text
          <pre className="whitespace-pre-wrap font-sans text-slate-800">{email.body.text}</pre>
        ) : (
          // No body
          <p className="text-slate-500 italic">No content</p>
        )}
      </div>
    </div>
  )
}
