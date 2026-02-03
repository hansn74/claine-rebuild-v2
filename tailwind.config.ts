import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'
import typography from '@tailwindcss/typography'

/**
 * UX Design System - Theme 3: Technical Calm
 * Based on: docs/ux-design-specification.md
 *
 * Primary: Cyan #06B6D4
 * Typography: Inter Variable
 * Spacing: 4px base, 8px rhythm
 */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      /**
       * Color System - Theme 3: Technical Calm
       * Primary: Cyan, Neutrals: Slate
       * Semantic: Success (Green), Warning (Amber), Error (Red)
       */
      colors: {
        // CSS variable-based colors for shadcn/ui
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Semantic colors for direct usage
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        // Direct color values for utility classes
        cyan: {
          50: '#ECFEFF',
          100: '#CFFAFE',
          200: '#A5F3FC',
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4', // Primary
          600: '#0891B2', // Primary Dark
          700: '#0E7490',
          800: '#155E75',
          900: '#164E63',
          950: '#083344',
        },
        slate: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
      },

      /**
       * Typography - Inter Variable Font
       * H1: 24px, Body: 14px, Caption: 12px
       */
      fontFamily: {
        sans: [
          'Inter Variable',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['Courier New', 'monospace'],
      },
      fontSize: {
        // Type scale from UX spec
        xs: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0em' }], // 12px - Caption
        sm: ['0.8125rem', { lineHeight: '1.5', letterSpacing: '0em' }], // 13px - Monospace
        base: ['0.875rem', { lineHeight: '1.5', letterSpacing: '-0.01em' }], // 14px - Body
        lg: ['1rem', { lineHeight: '1.5', letterSpacing: '-0.01em' }], // 16px - Body Large
        xl: ['1.125rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }], // 18px - H3
        '2xl': ['1.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }], // 20px - H2
        '3xl': ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }], // 24px - H1
      },
      letterSpacing: {
        tighter: '-0.02em', // Headings
        tight: '-0.01em', // Body
        normal: '0em', // Caption
      },

      /**
       * Spacing Scale - 4px base, 8px rhythm
       * xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 24px, 2xl: 32px, 3xl: 48px
       */
      spacing: {
        xs: '0.25rem', // 4px
        sm: '0.5rem', // 8px
        md: '0.75rem', // 12px
        lg: '1rem', // 16px
        xl: '1.5rem', // 24px
        '2xl': '2rem', // 32px
        '3xl': '3rem', // 48px
      },

      /**
       * Border Radius - Design System
       * small: 4px, medium: 6px, large: 8px, extra-large: 12px
       */
      borderRadius: {
        sm: 'var(--radius-sm)', // 4px
        DEFAULT: 'var(--radius)', // 6px
        md: 'var(--radius-md)', // 6px
        lg: 'var(--radius-lg)', // 8px
        xl: 'var(--radius-xl)', // 12px
      },

      /**
       * Shadows - Design System
       * subtle: light elevation, modal: overlay
       */
      boxShadow: {
        subtle: '0 1px 3px rgba(0, 0, 0, 0.1)',
        modal: '0 8px 24px rgba(0, 0, 0, 0.15)',
        'command-palette': '0 24px 48px rgba(0, 0, 0, 0.3)',
      },

      /**
       * Layout widths from UX spec
       */
      width: {
        sidebar: '180px',
        'email-list': '400px',
        'command-palette': '600px',
      },

      /**
       * Email row height from UX spec
       */
      height: {
        'email-row': '48px',
      },
    },
  },
  plugins: [tailwindcssAnimate, typography],
} satisfies Config
