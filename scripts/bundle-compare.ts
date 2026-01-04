#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Bundle size comparison script.
 * Compares current bundle sizes against the main branch or a baseline.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

interface ModuleSizeInfo {
  rawSize: number
  gzipSize: number
  chunks: string[]
  budget: number
  percentOfBudget: number
  status: string
}

interface BundleReport {
  timestamp: string
  commitSha: string | null
  modules: Record<string, ModuleSizeInfo>
  total: {
    rawSize: number
    gzipSize: number
    budget: number
    percentOfBudget: number
    status: string
  }
}

interface SizeChange {
  module: string
  current: number
  baseline: number
  diff: number
  diffPercent: number
}

const REPORTS_DIR = join(process.cwd(), 'reports')
const CURRENT_REPORT = join(REPORTS_DIR, 'bundle-sizes.json')
const HISTORY_FILE = join(REPORTS_DIR, 'bundle-history.json')

function formatBytes(bytes: number): string {
  const sign = bytes >= 0 ? '+' : ''
  const absBytes = Math.abs(bytes)
  if (absBytes < 1024) return `${sign}${bytes} B`
  const kb = bytes / 1024
  if (Math.abs(kb) < 1024) return `${sign}${kb.toFixed(2)} KB`
  const mb = kb / 1024
  return `${sign}${mb.toFixed(2)} MB`
}

function getMainBranchReport(): BundleReport | null {
  try {
    // Try to get the report from main branch
    const mainContent = execSync('git show main:reports/bundle-sizes.json 2>/dev/null', {
      encoding: 'utf-8',
    })
    return JSON.parse(mainContent)
  } catch {
    // Fall back to history file
    if (existsSync(HISTORY_FILE)) {
      const history = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'))
      if (history.entries && history.entries.length > 0) {
        return history.entries[history.entries.length - 1]
      }
    }
    return null
  }
}

function calculateChanges(current: BundleReport, baseline: BundleReport): SizeChange[] {
  const changes: SizeChange[] = []

  // Compare modules
  const allModules = new Set([...Object.keys(current.modules), ...Object.keys(baseline.modules)])

  for (const module of allModules) {
    const currentSize = current.modules[module]?.gzipSize ?? 0
    const baselineSize = baseline.modules[module]?.gzipSize ?? 0

    if (currentSize !== 0 || baselineSize !== 0) {
      const diff = currentSize - baselineSize
      const diffPercent = baselineSize > 0 ? (diff / baselineSize) * 100 : 0

      changes.push({
        module,
        current: currentSize,
        baseline: baselineSize,
        diff,
        diffPercent,
      })
    }
  }

  // Add total
  changes.push({
    module: 'TOTAL',
    current: current.total.gzipSize,
    baseline: baseline.total.gzipSize,
    diff: current.total.gzipSize - baseline.total.gzipSize,
    diffPercent:
      baseline.total.gzipSize > 0
        ? ((current.total.gzipSize - baseline.total.gzipSize) / baseline.total.gzipSize) * 100
        : 0,
  })

  return changes.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
}

function printComparison(changes: SizeChange[], baseline: BundleReport): void {
  console.log('\n📊 Bundle Size Comparison')
  console.log('='.repeat(70))
  console.log(`Comparing against: ${baseline.commitSha?.slice(0, 7) ?? 'baseline'}`)
  console.log(`Baseline date: ${baseline.timestamp}`)
  console.log('-'.repeat(70))

  console.log(
    `${'Module'.padEnd(15)} ${'Current'.padStart(12)} ${'Baseline'.padStart(12)} ${'Change'.padStart(12)} ${'%'.padStart(8)}`
  )
  console.log('-'.repeat(70))

  for (const change of changes) {
    const icon =
      change.diff > 0 ? '📈' : change.diff < 0 ? '📉' : change.module === 'TOTAL' ? '📦' : '➡️'

    const currentKB = (change.current / 1024).toFixed(1)
    const baselineKB = (change.baseline / 1024).toFixed(1)
    const diffStr = formatBytes(change.diff)
    const percentStr =
      change.baseline > 0
        ? `${change.diffPercent >= 0 ? '+' : ''}${change.diffPercent.toFixed(1)}%`
        : 'new'

    if (change.module === 'TOTAL') {
      console.log('-'.repeat(70))
    }

    console.log(
      `${icon} ${change.module.padEnd(13)} ${(currentKB + ' KB').padStart(12)} ${(baselineKB + ' KB').padStart(12)} ${diffStr.padStart(12)} ${percentStr.padStart(8)}`
    )
  }

  console.log('\n')
}

function generateMarkdownComment(
  changes: SizeChange[],
  current: BundleReport,
  _baseline: BundleReport
): string {
  const totalChange = changes.find((c) => c.module === 'TOTAL')!
  const significantChanges = changes.filter(
    (c) => c.module !== 'TOTAL' && Math.abs(c.diffPercent) >= 5
  )

  let md = '## 📦 Bundle Size Report\n\n'

  // Summary
  const changeIcon = totalChange.diff > 0 ? '📈' : totalChange.diff < 0 ? '📉' : '➡️'
  md += `${changeIcon} **Total change:** ${formatBytes(totalChange.diff)} (${totalChange.diffPercent >= 0 ? '+' : ''}${totalChange.diffPercent.toFixed(1)}%)\n\n`

  // Status
  if (current.total.status === 'exceeded') {
    md += '❌ **Budget exceeded!** Total bundle size is over budget.\n\n'
  } else if (current.total.status === 'warning') {
    md += '⚠️ **Warning:** Total bundle size is approaching budget.\n\n'
  } else {
    md += '✅ All bundle sizes within budget.\n\n'
  }

  // Table
  md += '| Module | Current | Baseline | Change | % |\n'
  md += '|--------|---------|----------|--------|---|\n'

  for (const change of changes) {
    if (change.module === 'TOTAL') continue
    if (change.current === 0 && change.baseline === 0) continue

    const currentKB = `${(change.current / 1024).toFixed(1)} KB`
    const baselineKB = `${(change.baseline / 1024).toFixed(1)} KB`
    const diffStr = formatBytes(change.diff)
    const percentStr =
      change.baseline > 0
        ? `${change.diffPercent >= 0 ? '+' : ''}${change.diffPercent.toFixed(1)}%`
        : 'new'

    md += `| ${change.module} | ${currentKB} | ${baselineKB} | ${diffStr} | ${percentStr} |\n`
  }

  // Total row
  md += `| **TOTAL** | **${(totalChange.current / 1024).toFixed(1)} KB** | **${(totalChange.baseline / 1024).toFixed(1)} KB** | **${formatBytes(totalChange.diff)}** | **${totalChange.diffPercent >= 0 ? '+' : ''}${totalChange.diffPercent.toFixed(1)}%** |\n`

  // Significant changes
  if (significantChanges.length > 0) {
    md += '\n### Notable Changes\n\n'
    for (const change of significantChanges) {
      const icon = change.diff > 0 ? '📈' : '📉'
      md += `- ${icon} **${change.module}**: ${formatBytes(change.diff)} (${change.diffPercent >= 0 ? '+' : ''}${change.diffPercent.toFixed(1)}%)\n`
    }
  }

  return md
}

function main(): void {
  const args = process.argv.slice(2)
  const markdownOutput = args.includes('--markdown')

  // Load current report
  if (!existsSync(CURRENT_REPORT)) {
    console.error('Error: Current bundle report not found. Run "npm run bundle:check" first.')
    process.exit(1)
  }

  const current: BundleReport = JSON.parse(readFileSync(CURRENT_REPORT, 'utf-8'))

  // Get baseline
  const baseline = getMainBranchReport()

  if (!baseline) {
    console.log('ℹ️  No baseline found. This appears to be the first build.')
    console.log('   Bundle sizes will be tracked after this build is merged to main.\n')
    process.exit(0)
  }

  // Calculate and display changes
  const changes = calculateChanges(current, baseline)

  if (markdownOutput) {
    console.log(generateMarkdownComment(changes, current, baseline))
  } else {
    printComparison(changes, baseline)
  }
}

main()
