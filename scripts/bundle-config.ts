/**
 * Bundle configuration for module boundaries and size budgets.
 * Used by bundle-size.ts to track and validate bundle sizes.
 */

/** Module definition with glob patterns for source files */
export interface ModuleDefinition {
  name: string
  patterns: string[]
  budget: number // gzipped KB
}

/** Module boundaries for bundle tracking */
export const modules: ModuleDefinition[] = [
  {
    name: 'auth',
    patterns: ['src/services/auth/**'],
    budget: 50, // 50KB gzipped
  },
  {
    name: 'database',
    patterns: ['src/services/database/**'],
    budget: 100, // 100KB gzipped (RxDB is large)
  },
  {
    name: 'sync',
    patterns: ['src/services/sync/**', 'src/services/quota/**'],
    budget: 75, // 75KB gzipped
  },
  {
    name: 'ui',
    patterns: ['src/components/**', 'src/hooks/**'],
    budget: 100, // 100KB gzipped
  },
  {
    name: 'store',
    patterns: ['src/store/**'],
    budget: 25, // 25KB gzipped
  },
]

/** Total app bundle budget (excluding RxDB peer deps) */
export const totalBudget = 500 // 500KB gzipped

/** Warning threshold as percentage of budget */
export const warningThreshold = 0.8 // 80%

/** Chunk name to module mapping patterns */
export const chunkPatterns: Record<string, string[]> = {
  'vendor-rxdb': ['rxdb'],
  'vendor-react': ['react', 'react-dom'],
  vendor: ['react', 'react-dom'],
}

/** Get module name from file path */
export function getModuleFromPath(filePath: string): string | null {
  for (const module of modules) {
    for (const pattern of module.patterns) {
      // Simple pattern matching - convert glob to regex
      const regexPattern = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')
      if (new RegExp(`^${regexPattern}`).test(filePath)) {
        return module.name
      }
    }
  }
  return null
}

/** Get budget for a module by name */
export function getModuleBudget(moduleName: string): number | null {
  const module = modules.find((m) => m.name === moduleName)
  return module ? module.budget : null
}
