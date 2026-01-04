#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Bundle history tracking script.
 * Updates the bundle history file with the latest sizes.
 * Run on main branch builds to track size trends over time.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

interface BundleReport {
  timestamp: string
  commitSha: string | null
  modules: Record<
    string,
    {
      rawSize: number
      gzipSize: number
      chunks: string[]
      budget: number
      percentOfBudget: number
      status: string
    }
  >
  total: {
    rawSize: number
    gzipSize: number
    budget: number
    percentOfBudget: number
    status: string
  }
}

interface HistoryEntry {
  timestamp: string
  commitSha: string | null
  commitMessage: string | null
  branch: string
  modules: Record<string, number> // module name -> gzip size
  total: number
}

interface BundleHistory {
  version: 1
  lastUpdated: string
  entries: HistoryEntry[]
}

const REPORTS_DIR = join(process.cwd(), 'reports')
const CURRENT_REPORT = join(REPORTS_DIR, 'bundle-sizes.json')
const HISTORY_FILE = join(REPORTS_DIR, 'bundle-history.json')
const MAX_ENTRIES = 100 // Keep last 100 builds

function getCommitMessage(): string | null {
  try {
    return execSync('git log -1 --format=%s', { encoding: 'utf-8' }).trim()
  } catch {
    return null
  }
}

function getCurrentBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return 'unknown'
  }
}

function loadHistory(): BundleHistory {
  if (existsSync(HISTORY_FILE)) {
    try {
      return JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'))
    } catch {
      console.warn('Warning: Could not parse existing history file, starting fresh.')
    }
  }

  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    entries: [],
  }
}

function saveHistory(history: BundleHistory): void {
  writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2))
}

function main(): void {
  const args = process.argv.slice(2)
  const forceUpdate = args.includes('--force')

  // Check if we're on main branch (unless forced)
  const branch = getCurrentBranch()
  if (branch !== 'main' && !forceUpdate) {
    console.log('ℹ️  Not on main branch. Use --force to update history anyway.')
    process.exit(0)
  }

  // Load current report
  if (!existsSync(CURRENT_REPORT)) {
    console.error('Error: Current bundle report not found. Run "npm run bundle:check" first.')
    process.exit(1)
  }

  const report: BundleReport = JSON.parse(readFileSync(CURRENT_REPORT, 'utf-8'))

  // Create history entry
  const entry: HistoryEntry = {
    timestamp: report.timestamp,
    commitSha: report.commitSha,
    commitMessage: getCommitMessage(),
    branch,
    modules: {},
    total: report.total.gzipSize,
  }

  // Extract module sizes
  for (const [name, sizes] of Object.entries(report.modules)) {
    if (sizes.gzipSize > 0) {
      entry.modules[name] = sizes.gzipSize
    }
  }

  // Load and update history
  const history = loadHistory()

  // Check for duplicate (same commit SHA)
  if (report.commitSha) {
    const existingIndex = history.entries.findIndex((e) => e.commitSha === report.commitSha)
    if (existingIndex !== -1) {
      console.log('ℹ️  Entry for this commit already exists, updating...')
      history.entries[existingIndex] = entry
    } else {
      history.entries.push(entry)
    }
  } else {
    history.entries.push(entry)
  }

  // Trim to max entries
  if (history.entries.length > MAX_ENTRIES) {
    history.entries = history.entries.slice(-MAX_ENTRIES)
  }

  history.lastUpdated = new Date().toISOString()

  // Save
  saveHistory(history)

  console.log('✅ Bundle history updated')
  console.log(`   Entries: ${history.entries.length}`)
  console.log(`   Latest total: ${(entry.total / 1024).toFixed(1)} KB gzipped`)
  console.log(`   File: ${HISTORY_FILE}\n`)
}

main()
