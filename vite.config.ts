import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { visualizer } from 'rollup-plugin-visualizer'
import { cspHeadersPlugin } from './vite-plugin-csp'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cspHeadersPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@db': fileURLToPath(new URL('./src/db', import.meta.url)),
      '@workers': fileURLToPath(new URL('./src/workers', import.meta.url)),
    },
  },
  optimizeDeps: {
    entries: ['index.html', 'benchmark.html'],
  },
  server: {
    port: 5154,
    strictPort: true, // Fail if port is already in use instead of auto-incrementing
  },
  build: {
    // Set chunk size warning limit to 500 KB
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // Manual chunk configuration for code splitting
        // Story 2.16: Lazy Loading for Performance
        manualChunks: (id: string) => {
          // React core - small, critical for initial render
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react'
          }

          // React utilities - needed with React
          if (
            id.includes('node_modules/scheduler') ||
            id.includes('node_modules/react-is') ||
            id.includes('node_modules/use-sync-external-store') ||
            id.includes('node_modules/hoist-non-react-statics')
          ) {
            return 'vendor-react'
          }

          // RxDB and all its dependencies - database layer, can be deferred
          if (
            id.includes('node_modules/rxdb') ||
            id.includes('node_modules/rxjs') ||
            id.includes('node_modules/dexie') ||
            id.includes('node_modules/mingo') ||
            id.includes('node_modules/ajv') ||
            id.includes('node_modules/fast-deep-equal') ||
            id.includes('node_modules/fast-uri') ||
            id.includes('node_modules/binary-decision-diagram') ||
            id.includes('node_modules/broadcast-channel') ||
            id.includes('node_modules/custom-idle-queue') ||
            id.includes('node_modules/event-reduce-js') ||
            id.includes('node_modules/oblivious-set') ||
            id.includes('node_modules/array-push-at-sort-position') ||
            id.includes('node_modules/unload')
          ) {
            return 'vendor-database'
          }

          // TipTap and ProseMirror - rich text editor, only needed for compose
          if (
            id.includes('node_modules/@tiptap') ||
            id.includes('node_modules/prosemirror') ||
            id.includes('node_modules/orderedmap') ||
            id.includes('node_modules/rope-sequence') ||
            id.includes('node_modules/w3c-keyname') ||
            id.includes('node_modules/linkifyjs')
          ) {
            return 'vendor-editor'
          }

          // Sentry - error tracking, can load after initial render
          if (id.includes('node_modules/@sentry')) {
            return 'vendor-monitoring'
          }

          // Microsoft/Azure auth - only for Outlook accounts
          if (id.includes('node_modules/@azure') || id.includes('node_modules/@microsoft')) {
            return 'vendor-outlook'
          }

          // Lunr search - can be deferred
          if (id.includes('node_modules/lunr')) {
            return 'vendor-search'
          }

          // UI utilities - small, keep with main bundle
          if (
            id.includes('node_modules/zustand') ||
            id.includes('node_modules/react-hotkeys-hook') ||
            id.includes('node_modules/@tanstack/react-virtual') ||
            id.includes('node_modules/class-variance-authority') ||
            id.includes('node_modules/clsx') ||
            id.includes('node_modules/tailwind-merge')
          ) {
            return 'vendor-ui'
          }

          // Radix UI components - UI library
          if (id.includes('node_modules/@radix-ui')) {
            return 'vendor-radix'
          }

          // Lucide icons
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons'
          }

          // Security utilities
          if (
            id.includes('node_modules/dompurify') ||
            id.includes('node_modules/nanoid') ||
            id.includes('node_modules/js-base64')
          ) {
            return 'vendor-security'
          }

          // Other node_modules
          if (id.includes('node_modules')) {
            return 'vendor-misc'
          }

          // Application code chunks based on directory structure
          // Compose feature - lazy loaded
          if (id.includes('/components/compose/')) {
            return 'feature-compose'
          }

          // Search feature - lazy loaded
          if (id.includes('/components/search/') || id.includes('/services/search/')) {
            return 'feature-search'
          }

          // Sync services - can be deferred
          if (id.includes('/services/sync/')) {
            return 'feature-sync'
          }

          // Database services - deferred loading
          if (id.includes('/services/database/')) {
            return 'feature-database'
          }

          // Auth services
          if (id.includes('/services/auth/')) {
            return 'feature-auth'
          }
        },
      },
      plugins: [
        // Bundle analysis visualization
        visualizer({
          filename: 'reports/bundle-analysis.html',
          template: 'treemap',
          open: false, // Don't auto-open on build, only on 'npm run bundle:analyze'
          gzipSize: true,
          brotliSize: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any, // Type assertion needed for Vite plugin compatibility
      ],
    },
  },
})
