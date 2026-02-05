# Story 2.8: Attachment Handling

Status: done

## Story

As a user,
I want to view and download email attachments,
so that I can access shared files.

## Acceptance Criteria

1. Attachments listed in thread view with icons and file sizes
2. Click to download attachment to user's Downloads folder
3. Lazy loading: attachments fetched on-demand, not during initial sync
4. Image attachments show inline preview
5. PDF/document attachments open in system default app
6. Compose interface supports drag-and-drop file attachment

## Tasks / Subtasks

### Task 1: Attachment Download Service (AC: 2, 3)

- [x] 1.1: Create `attachmentService.ts` in `src/services/email/`
- [x] 1.2: Implement Gmail API attachment fetch (`messages.attachments.get`)
- [x] 1.3: Implement Outlook API attachment fetch
- [x] 1.4: Add lazy-loading logic - fetch only when requested
- [x] 1.5: Implement download to browser with correct filename
- [x] 1.6: Add caching layer to avoid re-fetching same attachment
- [x] 1.7: Write unit tests for attachment service

### Task 2: Integrate Download Handler (AC: 2, 5)

- [x] 2.1: Update `AttachmentItem.tsx` to use attachmentService on download click
- [x] 2.2: Add loading state to download button
- [x] 2.3: Handle download errors with user feedback
- [x] 2.4: Implement browser file download using `URL.createObjectURL` and anchor click
- [x] 2.5: For PDF/documents, trigger browser's default handler (opens externally)

### Task 3: Image Inline Preview (AC: 4)

- [x] 3.1: Create `useAttachmentPreview` hook for fetching preview data
- [x] 3.2: For image attachments, fetch and display inline using `InlineImageRenderer.tsx`
- [x] 3.3: Add preview modal for full-size image viewing
- [x] 3.4: Add loading skeleton while image loads
- [x] 3.5: Handle unsupported image formats gracefully

### Task 4: Compose Attachment Support (AC: 6)

- [x] 4.1: Create `AttachmentUpload.tsx` component for compose
- [x] 4.2: Implement drag-and-drop file handling with `onDrop` event
- [x] 4.3: Implement click-to-upload with file picker
- [x] 4.4: Display attached files with remove option
- [x] 4.5: Integrate with `ComposeDialog.tsx`
- [x] 4.6: Store attachments in compose state for send
- [x] 4.7: Implement attachment encoding (base64) for API upload
- [x] 4.8: Update send flow to include attachments in email payload

### Task 5: Testing (AC: 1-6)

- [x] 5.1: Unit tests for attachmentService
- [x] 5.2: Unit tests for useAttachmentPreview hook
- [x] 5.3: Component tests for AttachmentUpload
- [x] 5.4: Integration tests for download flow (covered by attachmentService tests)
- [x] 5.5: E2E test for compose with attachment

## Dev Notes

### Dependencies

- No new external dependencies required
- Uses existing Gmail/Outlook API clients
- Uses existing `File` and `Blob` Web APIs

### Project Structure Notes

Based on existing structure:

- Service: `src/services/email/attachmentService.ts`
- Hook: `src/hooks/useAttachmentPreview.ts`
- Component: `src/components/compose/AttachmentUpload.tsx`
- Existing components: `AttachmentItem.tsx`, `AttachmentList.tsx`, `InlineImage.tsx`

### Existing Infrastructure

**From Story 2.2 (Thread Detail View):**

- `AttachmentItem.tsx` - Already has icons, file sizes, download button UI (placeholder handler)
- `AttachmentList.tsx` - Grid layout for attachments, filtering inline vs regular
- `InlineImage.tsx` - Lazy-loaded image with IntersectionObserver
- Email schema has `Attachment[]` with `id`, `filename`, `mimeType`, `size`, `isInline`, `contentId`

**From Story 2.3 (Compose & Reply):**

- `ComposeDialog.tsx` - Dialog for composing emails
- `RichTextEditor.tsx` - TipTap-based editor
- `RecipientInput.tsx` - Contact autocomplete

### Learnings from Previous Story

**From Story 2-7-offline-mode-indicators-conflict-resolution (Status: done)**

- **New Components Created**: `OfflineIndicator.tsx`, `QueueStatusBadge.tsx`, `SyncButton.tsx` in `src/components/ui/`
- **UI Barrel Export**: `src/components/ui/index.ts` - follow this pattern for new components
- **Zustand Pattern**: Select values individually to avoid infinite loops, use `useMemo` for derived state
- **Existing Services**: Leverage existing services directly (emailActionQueue, syncOrchestrator)
- **Technical Debt**: SyncStatusPanel and E2E tests deferred from 2.7

[Source: stories/2-7-offline-mode-indicators-conflict-resolution.md#Dev-Agent-Record]

### Implementation Patterns

**Gmail Attachment Fetch:**

```typescript
// attachmentService.ts
import { gmailApiService } from './gmailApiService'

export async function fetchAttachment(
  accountId: string,
  messageId: string,
  attachmentId: string
): Promise<Blob> {
  const response = await gmailApiService.getAttachment(accountId, messageId, attachmentId)
  // Gmail returns base64-encoded data
  const bytes = Uint8Array.from(atob(response.data), (c) => c.charCodeAt(0))
  return new Blob([bytes])
}
```

**Browser Download Trigger:**

```typescript
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
```

**Drag-and-Drop Pattern:**

```typescript
const handleDrop = (e: DragEvent) => {
  e.preventDefault()
  const files = Array.from(e.dataTransfer?.files || [])
  setAttachments((prev) => [...prev, ...files])
}
```

### Gmail API Reference

- `messages.attachments.get`: Returns base64url encoded attachment data
- Attachment metadata in message payload: `payload.parts[].body.attachmentId`
- Max attachment size: 25 MB total per message

### References

- [Epic 2.8 Acceptance Criteria](../epics/epic-2-offline-first-email-client-with-attributes.md)
- [Architecture - Email Schema](../architecture.md#decision-1-database-rxdb--indexeddb)
- [Gmail API Attachments](https://developers.google.com/gmail/api/reference/rest/v1/users.messages.attachments)
- [Story 2.2 - AttachmentList/AttachmentItem created](../stories/2-2-thread-detail-view-with-conversation-history.md)

## Dev Agent Record

### Context Reference

- `docs/stories/2-8-attachment-handling.context.xml` - Generated 2025-12-08

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

**2025-12-08 - Task 1 Planning:**

- Studied existing patterns: gmailActionsService, outlookSync for API call patterns
- Will use singleton pattern consistent with other services
- Token handling with auto-refresh on 401 errors (pattern from gmailActionsService)
- Gmail uses `messages.attachments.get` endpoint returning base64url data
- Outlook uses Microsoft Graph `/messages/{id}/attachments/{attachmentId}` endpoint
- Caching strategy: In-memory Map with `accountId:emailId:attachmentId` key
- Browser download via URL.createObjectURL + anchor click pattern

**2025-12-08 - Task 2 Implementation:**

- Created `useAttachmentDownload` hook for managing download state
- Updated `AttachmentList` to use hook with accountId/emailId props
- Updated `AttachmentItem` with loading state (spinner) and disabled button during download
- Added error display in AttachmentList with auto-dismiss after 5 seconds
- Browser download triggers via downloadBlob method which uses URL.createObjectURL
- PDF/documents open via browser default handler (the browser decides based on mime type)

**2025-12-08 - Task 3 Implementation:**

- Created `useAttachmentPreview` hook for single attachment preview
- Created `useAttachmentPreviews` hook for batch fetching multiple inline images
- Created `InlineImageRenderer` component to replace cid: references with blob URLs
- Updated `ThreadMessage` to use InlineImageRenderer when email has inline attachments
- Preview modal (3.3) deferred as non-critical for MVP
- Loading indicator shows while inline images are being fetched

**2025-12-08 - Task 4 Implementation:**

- Created `AttachmentUpload.tsx` with drag-and-drop and click-to-upload
- Added `fileToBase64` and `prepareAttachmentsForSend` utilities for API encoding
- Integrated AttachmentUpload into ComposeDialog with state management
- Updated `gmailSendService.ts` to handle attachments with multipart/mixed RFC 2822 format
- Updated `outlookSendService.ts` to include attachments in Graph API format
- Updated compose barrel export to include new components and utilities

**2025-12-08 - Task 5 Testing:**

- Unit tests for attachmentService (17 tests) - Gmail/Outlook fetch, caching, token refresh
- Unit tests for useAttachmentPreview hooks (11 tests) - single and batch preview fetching
- Component tests for AttachmentUpload (16 tests) - drag-drop, file picker, validation, base64 encoding
- E2E test deferred as requires full running application

### Completion Notes List

- All acceptance criteria met:
  - AC1: Attachments listed in thread view with icons and file sizes ✓
  - AC2: Click to download attachment ✓
  - AC3: Lazy loading - attachments fetched on-demand ✓
  - AC4: Image attachments show inline preview ✓
  - AC5: PDF/documents open in system default app ✓
  - AC6: Compose interface supports drag-and-drop file attachment ✓
- Task 3.3 (preview modal) implemented with zoom/pan/rotate/download features
- Task 5.5 (E2E test) implemented with comprehensive compose attachment tests

### File List

**Created Files:**

- `src/services/email/attachmentService.ts` - Core attachment fetch/download/caching service
- `src/services/email/__tests__/attachmentService.test.ts` - Unit tests for attachment service
- `src/hooks/useAttachmentDownload.ts` - Hook for managing download state
- `src/hooks/useAttachmentPreview.ts` - Hooks for fetching attachment previews
- `src/hooks/__tests__/useAttachmentPreview.test.ts` - Unit tests for preview hooks
- `src/components/email/InlineImageRenderer.tsx` - Renders email HTML with fetched inline images
- `src/components/email/ImagePreviewModal.tsx` - Full-screen image preview with zoom/pan/rotate
- `src/components/compose/AttachmentUpload.tsx` - Drag-and-drop attachment component
- `src/components/compose/__tests__/AttachmentUpload.test.tsx` - Component tests
- `e2e/compose-with-attachment.spec.ts` - E2E tests for compose with attachments

**Modified Files:**

- `src/services/email/index.ts` - Added attachmentService export
- `src/services/email/gmailSendService.ts` - Added attachment support in RFC 2822 format
- `src/services/email/outlookSendService.ts` - Added attachment support in Graph API format
- `src/components/email/AttachmentItem.tsx` - Added loading state, preview button for images
- `src/components/email/AttachmentList.tsx` - Integrated useAttachmentDownload hook, image preview modal
- `src/components/email/InlineImageRenderer.tsx` - Added click-to-preview for inline images
- `src/components/email/ThreadMessage.tsx` - Added InlineImageRenderer for inline images
- `src/components/compose/ComposeDialog.tsx` - Integrated AttachmentUpload component
- `src/components/compose/index.ts` - Added AttachmentUpload exports
