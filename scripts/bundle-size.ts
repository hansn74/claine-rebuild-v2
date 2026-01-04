#!/usr/bin/env npx tsx
/* eslint-disable no-console */
/**
 * Bundle size tracking script.
 * Analyzes Vite build output, calculates gzipped sizes,
 * groups by module, and validates against budgets.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import { execSync } from 'node:child_process'
import { gzipSizeSync } from 'gzip-size'
import { modules, totalBudget, warningThreshold, getModuleFromPath } from './bundle-config.js'

interface ChunkInfo {
  name: string
  file: string
  rawSize: number
  gzipSize: number
  module: string
}

interface ModuleSizes {
  [moduleName: string]: {
    rawSize: number
    gzipSize: number
    chunks: string[]
    budget: number
    percentOfBudget: number
    status: 'ok' | 'warning' | 'exceeded'
  }
}

interface BundleReport {
  timestamp: string
  commitSha: string | null
  modules: ModuleSizes
  total: {
    rawSize: number
    gzipSize: number
    budget: number
    percentOfBudget: number
    status: 'ok' | 'warning' | 'exceeded'
  }
  chunks: ChunkInfo[]
}

const DIST_DIR = join(process.cwd(), 'dist')
const ASSETS_DIR = join(DIST_DIR, 'assets')
const OUTPUT_FILE = join(process.cwd(), 'reports', 'bundle-sizes.json')

function getCommitSha(): string | null {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    return null
  }
}

function getChunkModule(fileName: string): string {
  // Map chunk names to modules based on content
  if (fileName.includes('vendor') || fileName.includes('node_modules')) {
    return 'vendor'
  }

  // For app chunks, try to determine module from chunk name patterns
  // Vite generates names like index-[hash].js for main bundle
  if (fileName.startsWith('index')) {
    return 'app'
  }

  // Check module patterns from config
  const matchedModule = getModuleFromPath(fileName)
  if (matchedModule) {
    return matchedModule
  }

  return 'other'
}

function analyzeChunks(): ChunkInfo[] {
  if (!existsSync(ASSETS_DIR)) {
    console.error('Error: dist/assets directory not found. Run "npm run build" first.')
    process.exit(1)
  }

  const files = readdirSync(ASSETS_DIR)
  const jsFiles = files.filter((f) => f.endsWith('.js'))
  const cssFiles = files.filter((f) => f.endsWith('.css'))

  const chunks: ChunkInfo[] = []

  // Process JS files
  for (const file of jsFiles) {
    const filePath = join(ASSETS_DIR, file)
    const content = readFileSync(filePath)
    const rawSize = statSync(filePath).size
    const gzipSize = gzipSizeSync(content)

    chunks.push({
      name: basename(file, '.js'),
      file,
      rawSize,
      gzipSize,
      module: getChunkModule(file),
    })
  }

  // Process CSS files
  for (const file of cssFiles) {
    const filePath = join(ASSETS_DIR, file)
    const content = readFileSync(filePath)
    const rawSize = statSync(filePath).size
    const gzipSize = gzipSizeSync(content)

    chunks.push({
      name: basename(file, '.css') + ' (css)',
      file,
      rawSize,
      gzipSize,
      module: 'styles',
    })
  }

  return chunks
}

function calculateModuleSizes(chunks: ChunkInfo[]): ModuleSizes {
  const moduleSizes: ModuleSizes = {}

  // Initialize with defined modules
  for (const mod of modules) {
    moduleSizes[mod.name] = {
      rawSize: 0,
      gzipSize: 0,
      chunks: [],
      budget: mod.budget * 1024, // Convert KB to bytes
      percentOfBudget: 0,
      status: 'ok',
    }
  }

  // Add common module buckets
  const additionalModules = ['vendor', 'app', 'styles', 'other']
  for (const name of additionalModules) {
    if (!moduleSizes[name]) {
      moduleSizes[name] = {
        rawSize: 0,
        gzipSize: 0,
        chunks: [],
        budget: 0, // No specific budget for these
        percentOfBudget: 0,
        status: 'ok',
      }
    }
  }

  // Aggregate chunks by module
  for (const chunk of chunks) {
    const moduleName = chunk.module
    if (!moduleSizes[moduleName]) {
      moduleSizes[moduleName] = {
        rawSize: 0,
        gzipSize: 0,
        chunks: [],
        budget: 0,
        percentOfBudget: 0,
        status: 'ok',
      }
    }

    moduleSizes[moduleName].rawSize += chunk.rawSize
    moduleSizes[moduleName].gzipSize += chunk.gzipSize
    moduleSizes[moduleName].chunks.push(chunk.file)
  }

  // Calculate budget percentages and status
  for (const sizes of Object.values(moduleSizes)) {
    if (sizes.budget > 0) {
      sizes.percentOfBudget = (sizes.gzipSize / sizes.budget) * 100
      if (sizes.percentOfBudget >= 100) {
        sizes.status = 'exceeded'
      } else if (sizes.percentOfBudget >= warningThreshold * 100) {
        sizes.status = 'warning'
      }
    }
  }

  return moduleSizes
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(2)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(2)} MB`
}

function printReport(report: BundleReport): void {
  console.log('\n📦 Bundle Size Report')
  console.log('='.repeat(60))

  // Print module breakdown
  console.log('\nModule Breakdown:')
  console.log('-'.repeat(60))

  const sortedModules = Object.entries(report.modules)
    .filter(([, sizes]) => sizes.gzipSize > 0)
    .sort((a, b) => b[1].gzipSize - a[1].gzipSize)

  for (const [name, sizes] of sortedModules) {
    const statusIcon = sizes.status === 'exceeded' ? '❌' : sizes.status === 'warning' ? '⚠️' : '✅'
    const budgetInfo =
      sizes.budget > 0
        ? ` (${sizes.percentOfBudget.toFixed(1)}% of ${formatBytes(sizes.budget)})`
        : ''

    console.log(
      `${statusIcon} ${name.padEnd(15)} ${formatBytes(sizes.gzipSize).padStart(10)} gzip${budgetInfo}`
    )
  }

  // Print total
  console.log('-'.repeat(60))
  const totalStatusIcon =
    report.total.status === 'exceeded' ? '❌' : report.total.status === 'warning' ? '⚠️' : '✅'
  console.log(
    `${totalStatusIcon} ${'TOTAL'.padEnd(15)} ${formatBytes(report.total.gzipSize).padStart(10)} gzip (${report.total.percentOfBudget.toFixed(1)}% of ${formatBytes(report.total.budget)})`
  )

  console.log('\n')
}

function checkBudgets(report: BundleReport): boolean {
  let hasErrors = false
  let hasWarnings = false

  // Check module budgets
  for (const [name, sizes] of Object.entries(report.modules)) {
    if (sizes.status === 'exceeded') {
      console.error(
        `❌ Module "${name}" exceeds budget: ${formatBytes(sizes.gzipSize)} > ${formatBytes(sizes.budget)}`
      )
      hasErrors = true
    } else if (sizes.status === 'warning') {
      console.warn(
        `⚠️  Module "${name}" approaching budget: ${formatBytes(sizes.gzipSize)} (${sizes.percentOfBudget.toFixed(1)}% of ${formatBytes(sizes.budget)})`
      )
      hasWarnings = true
    }
  }

  // Check total budget
  if (report.total.status === 'exceeded') {
    console.error(
      `❌ Total bundle exceeds budget: ${formatBytes(report.total.gzipSize)} > ${formatBytes(report.total.budget)}`
    )
    hasErrors = true
  } else if (report.total.status === 'warning') {
    console.warn(
      `⚠️  Total bundle approaching budget: ${formatBytes(report.total.gzipSize)} (${report.total.percentOfBudget.toFixed(1)}% of ${formatBytes(report.total.budget)})`
    )
    hasWarnings = true
  }

  if (!hasErrors && !hasWarnings) {
    console.log('✅ All bundle sizes within budget\n')
  }

  return !hasErrors
}

function main(): void {
  const args = process.argv.slice(2)
  const checkOnly = args.includes('--check')
  const jsonOutput = args.includes('--json')

  // Analyze chunks
  const chunks = analyzeChunks()
  const moduleSizes = calculateModuleSizes(chunks)

  // Calculate total
  const totalRawSize = chunks.reduce((sum, c) => sum + c.rawSize, 0)
  const totalGzipSize = chunks.reduce((sum, c) => sum + c.gzipSize, 0)
  const totalBudgetBytes = totalBudget * 1024
  const totalPercentOfBudget = (totalGzipSize / totalBudgetBytes) * 100

  let totalStatus: 'ok' | 'warning' | 'exceeded' = 'ok'
  if (totalPercentOfBudget >= 100) {
    totalStatus = 'exceeded'
  } else if (totalPercentOfBudget >= warningThreshold * 100) {
    totalStatus = 'warning'
  }

  const report: BundleReport = {
    timestamp: new Date().toISOString(),
    commitSha: getCommitSha(),
    modules: moduleSizes,
    total: {
      rawSize: totalRawSize,
      gzipSize: totalGzipSize,
      budget: totalBudgetBytes,
      percentOfBudget: totalPercentOfBudget,
      status: totalStatus,
    },
    chunks,
  }

  // Output
  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printReport(report)
  }

  // Save report
  writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2))
  console.log(`📄 Report saved to: ${OUTPUT_FILE}\n`)

  // Check budgets and exit with appropriate code
  const budgetsOk = checkBudgets(report)

  if (checkOnly && !budgetsOk) {
    process.exit(1)
  }
}

main()
