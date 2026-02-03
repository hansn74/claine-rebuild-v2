/**
 * Vite Plugin: Content Security Policy Headers
 * Adds CSP headers to development server responses
 *
 * Security Headers Configuration:
 * - Content-Security-Policy: Restricts resource loading sources
 * - Strict-Transport-Security: Enforces HTTPS
 * - X-Content-Type-Options: Prevents MIME sniffing
 * - X-Frame-Options: Prevents clickjacking
 *
 * Production: These headers should be configured in deployment platform (Vercel, Netlify, etc.)
 * This plugin is for development/preview only
 */

import type { Plugin } from 'vite'

export function cspHeadersPlugin(): Plugin {
  return {
    name: 'csp-headers',
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        // Content Security Policy
        // Allow self, Google OAuth endpoints, Microsoft OAuth endpoints, and email APIs
        res.setHeader(
          'Content-Security-Policy',
          [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed for development HMR
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // unsafe-inline for Tailwind, Google Fonts stylesheets
            "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://gmail.googleapis.com https://login.microsoftonline.com https://graph.microsoft.com",
            "img-src 'self' data: https:",
            "font-src 'self' data: https://fonts.gstatic.com", // Google Fonts font files
            "frame-src 'self' https://accounts.google.com https://login.microsoftonline.com https://rxdb.info", // Allow Google/Microsoft OAuth iframes and RxDB dev iframe
            "worker-src 'self' blob:",
            "manifest-src 'self'",
          ].join('; ')
        )

        // Strict-Transport-Security (HTTPS only)
        // Note: Only applies in production with HTTPS
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

        // Prevent MIME sniffing
        res.setHeader('X-Content-Type-Options', 'nosniff')

        // Prevent clickjacking
        res.setHeader('X-Frame-Options', 'DENY')

        // Referrer Policy
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

        // Permissions Policy (formerly Feature-Policy)
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()')

        next()
      })
    },
  }
}
