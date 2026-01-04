/// <reference types="vite/client" />

/**
 * Type definitions for environment variables
 * Extends Vite's ImportMetaEnv interface to provide type safety and autocomplete
 * for custom environment variables.
 *
 * All client-side environment variables must use the VITE_ prefix.
 * These variables are statically replaced at build time and exposed to the browser.
 *
 * @see https://vite.dev/guide/env-and-mode.html
 */
interface ImportMetaEnv {
  /**
   * Application name displayed in the UI
   * Used for branding and window titles
   * @example "Claine" or "Claine (Dev)"
   */
  readonly VITE_APP_NAME: string

  /**
   * Gmail API base URL
   * Development: Use local mock server or Gmail API test endpoint
   * Production: https://gmail.googleapis.com
   * @default "https://gmail.googleapis.com"
   */
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
