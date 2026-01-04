/**
 * Conflict Resolution Strategies
 * Implements automatic conflict resolution for different conflict types
 *
 * Resolution Strategy Priority:
 * 1. Metadata (read, starred, archived): Last-write-wins (AC4)
 * 2. Labels: Union merge - combine both sets (AC5)
 * 3. Attributes: Per-key last-write-wins
 * 4. Content (body, subject): Manual - user decides (AC6)
 */

import type { ConflictEmailData } from './conflictDetection'

/**
 * Resolution result containing the merged email data
 */
export interface ResolutionResult {
  resolvedData: ConflictEmailData
  strategy: 'auto-lww' | 'auto-merge' | 'local' | 'server' | 'merged'
  changesApplied: string[]
}

/**
 * Resolve metadata conflict using last-write-wins strategy
 * AC4: Last-write-wins applied for metadata (read status, starred, archived)
 *
 * @param local - Local email data
 * @param server - Server email data
 * @returns Resolved email data with newer values
 */
export function resolveMetadataConflict(
  local: ConflictEmailData,
  server: ConflictEmailData
): ResolutionResult {
  const changesApplied: string[] = []

  // Determine which version is newer
  const localIsNewer = (local.localModifiedAt ?? local.timestamp) > server.timestamp

  // Start with the base data from server (as it's the sync source)
  const resolved: ConflictEmailData = {
    ...server,
    // Preserve local tracking data
    localModifiedAt: undefined, // Clear as conflict is resolved
  }

  // Apply last-write-wins for each metadata field
  if (local.read !== server.read) {
    resolved.read = localIsNewer ? local.read : server.read
    changesApplied.push(`read: ${resolved.read}`)
  }

  if (local.starred !== server.starred) {
    resolved.starred = localIsNewer ? local.starred : server.starred
    changesApplied.push(`starred: ${resolved.starred}`)
  }

  if (local.importance !== server.importance) {
    resolved.importance = localIsNewer ? local.importance : server.importance
    changesApplied.push(`importance: ${resolved.importance}`)
  }

  return {
    resolvedData: resolved,
    strategy: 'auto-lww',
    changesApplied,
  }
}

/**
 * Resolve label conflict using union merge strategy
 * AC5: Merge strategy applied for labels/attributes (union of both sets)
 *
 * @param local - Local email data
 * @param server - Server email data
 * @returns Resolved email data with merged labels
 */
export function resolveLabelConflict(
  local: ConflictEmailData,
  server: ConflictEmailData
): ResolutionResult {
  const changesApplied: string[] = []

  // Union of both label sets - no data loss
  const localLabels = new Set(local.labels)
  const serverLabels = new Set(server.labels)
  const mergedLabels = new Set([...localLabels, ...serverLabels])

  // Track what was added
  const addedFromLocal = local.labels.filter((l) => !serverLabels.has(l))
  const addedFromServer = server.labels.filter((l) => !localLabels.has(l))

  if (addedFromLocal.length > 0) {
    changesApplied.push(`added from local: ${addedFromLocal.join(', ')}`)
  }
  if (addedFromServer.length > 0) {
    changesApplied.push(`added from server: ${addedFromServer.join(', ')}`)
  }

  const resolved: ConflictEmailData = {
    ...server,
    labels: Array.from(mergedLabels),
    localModifiedAt: undefined,
  }

  return {
    resolvedData: resolved,
    strategy: 'auto-merge',
    changesApplied,
  }
}

/**
 * Resolve attribute conflict using per-key last-write-wins
 * Each attribute key is resolved independently based on which side modified it more recently
 *
 * @param local - Local email data
 * @param server - Server email data
 * @returns Resolved email data with merged attributes
 */
export function resolveAttributeConflict(
  local: ConflictEmailData,
  server: ConflictEmailData
): ResolutionResult {
  const changesApplied: string[] = []

  const localIsNewer = (local.localModifiedAt ?? local.timestamp) > server.timestamp

  // Merge attributes with per-key last-write-wins
  const mergedAttributes: Record<string, string | number | boolean | null> = {}

  // Start with server attributes as base
  const allKeys = new Set([...Object.keys(local.attributes), ...Object.keys(server.attributes)])

  for (const key of allKeys) {
    const localValue = local.attributes[key]
    const serverValue = server.attributes[key]

    if (localValue === serverValue) {
      // Same value, no conflict
      mergedAttributes[key] = serverValue
    } else if (localValue !== undefined && serverValue === undefined) {
      // Key only in local
      mergedAttributes[key] = localValue
      changesApplied.push(`kept local: ${key}`)
    } else if (localValue === undefined && serverValue !== undefined) {
      // Key only in server
      mergedAttributes[key] = serverValue
      changesApplied.push(`kept server: ${key}`)
    } else {
      // Both have different values - use last-write-wins
      mergedAttributes[key] = localIsNewer ? localValue : serverValue
      changesApplied.push(
        `${key}: ${localIsNewer ? 'local' : 'server'} wins (${mergedAttributes[key]})`
      )
    }
  }

  const resolved: ConflictEmailData = {
    ...server,
    attributes: mergedAttributes,
    localModifiedAt: undefined,
  }

  return {
    resolvedData: resolved,
    strategy: 'auto-merge',
    changesApplied,
  }
}

/**
 * Resolve conflict by keeping local version
 * Used when user chooses "Keep Local" for content conflicts
 *
 * @param local - Local email data
 * @returns Resolution result with local data
 */
export function resolveKeepLocal(local: ConflictEmailData): ResolutionResult {
  return {
    resolvedData: {
      ...local,
      localModifiedAt: undefined,
    },
    strategy: 'local',
    changesApplied: ['kept all local changes'],
  }
}

/**
 * Resolve conflict by keeping server version
 * Used when user chooses "Keep Server" for content conflicts
 *
 * @param server - Server email data
 * @returns Resolution result with server data
 */
export function resolveKeepServer(server: ConflictEmailData): ResolutionResult {
  return {
    resolvedData: {
      ...server,
      localModifiedAt: undefined,
    },
    strategy: 'server',
    changesApplied: ['accepted all server changes'],
  }
}

/**
 * Resolve conflict with manually merged data
 * Used when user provides custom merged content
 *
 * @param mergedData - User-provided merged data
 * @param changesDescription - Description of changes made
 * @returns Resolution result with merged data
 */
export function resolveMerged(
  mergedData: ConflictEmailData,
  changesDescription: string[] = ['manually merged by user']
): ResolutionResult {
  return {
    resolvedData: {
      ...mergedData,
      localModifiedAt: undefined,
    },
    strategy: 'merged',
    changesApplied: changesDescription,
  }
}

/**
 * Auto-resolve a conflict based on its type
 * Applies the appropriate strategy automatically
 *
 * @param type - Type of conflict
 * @param local - Local email data
 * @param server - Server email data
 * @returns Resolution result or null if manual resolution required
 */
export function autoResolve(
  type: 'metadata' | 'labels' | 'content',
  local: ConflictEmailData,
  server: ConflictEmailData
): ResolutionResult | null {
  switch (type) {
    case 'metadata':
      return resolveMetadataConflict(local, server)
    case 'labels':
      return resolveLabelConflict(local, server)
    case 'content':
      // Content conflicts require manual resolution
      return null
    default:
      return null
  }
}
