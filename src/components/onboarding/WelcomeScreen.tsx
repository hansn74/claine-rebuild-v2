/**
 * WelcomeScreen Component
 *
 * Story 2.12: Empty States & Onboarding UX
 * Task 2.1-2.5: First-launch welcome screen with Claine branding
 *
 * Shows on first launch when no accounts are connected.
 * Provides "Connect Email Account" CTA and feature highlights.
 *
 * Usage:
 *   <WelcomeScreen onConnectAccount={handleConnect} />
 */

import { Mail, WifiOff, Search, Keyboard, Shield } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { Button } from '@shared/components/ui/button'

export interface WelcomeScreenProps {
  /** Called when user clicks to connect an email account */
  onConnectAccount: () => void
  /** Called when user skips the welcome screen */
  onSkip?: () => void
  /** Optional custom className */
  className?: string
  /** Whether connection is in progress */
  isConnecting?: boolean
}

interface FeatureItem {
  icon: typeof Mail
  title: string
  description: string
}

const features: FeatureItem[] = [
  {
    icon: WifiOff,
    title: 'Offline-first',
    description: 'Access emails anytime, even without internet',
  },
  {
    icon: Search,
    title: 'Fast search',
    description: 'Find any email instantly with local search',
  },
  {
    icon: Keyboard,
    title: 'Keyboard shortcuts',
    description: 'Navigate efficiently with power-user shortcuts',
  },
  {
    icon: Shield,
    title: 'Privacy focused',
    description: 'Your data stays on your device',
  },
]

/**
 * WelcomeScreen - First-launch onboarding screen
 *
 * Features:
 * - Clean branding with logo/name
 * - Prominent "Connect Email" CTA
 * - Feature highlights
 * - Accessible design
 */
export function WelcomeScreen({
  onConnectAccount,
  onSkip,
  className,
  isConnecting = false,
}: WelcomeScreenProps) {
  return (
    <div
      className={cn('min-h-screen bg-gradient-to-b from-slate-50 to-white py-16 px-8', className)}
      style={{ width: '100%', display: 'block' }}
      role="main"
      aria-labelledby="welcome-title"
    >
      <div
        className="flex flex-col items-center"
        style={{ maxWidth: '672px', margin: '0 auto', width: '100%' }}
      >
        {/* Logo and branding */}
        <div className="text-center mb-12" style={{ width: '100%' }}>
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shadow-lg">
            <Mail className="w-10 h-10 text-white" strokeWidth={1.5} />
          </div>
          <h1
            id="welcome-title"
            className="text-4xl font-bold text-slate-900 mb-3"
            style={{ whiteSpace: 'normal', wordBreak: 'normal' }}
          >
            Welcome to Claine
          </h1>
          <p
            className="text-lg text-slate-600"
            style={{ whiteSpace: 'normal', wordBreak: 'normal' }}
          >
            Your intelligent, offline-first email client
          </p>
        </div>

        {/* Connect Email CTA */}
        <div className="mb-12 text-center flex flex-col items-center" style={{ width: '100%' }}>
          <Button
            onClick={onConnectAccount}
            disabled={isConnecting}
            size="lg"
            className="bg-cyan-500 hover:bg-cyan-600 text-white px-8 py-6 text-lg font-medium rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
            aria-label="Connect your email account"
          >
            {isConnecting ? (
              <>
                <span className="animate-spin mr-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                </span>
                Connecting...
              </>
            ) : (
              <>
                <Mail className="w-5 h-5 mr-2" />
                Connect Email Account
              </>
            )}
          </Button>

          <p className="text-sm text-slate-500 mt-3" style={{ whiteSpace: 'nowrap' }}>
            Supports Gmail and Outlook
          </p>

          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="mt-4 text-sm text-slate-500 hover:text-slate-700 underline transition-colors"
              style={{ whiteSpace: 'nowrap' }}
            >
              Skip for now
            </button>
          )}
        </div>

        {/* Feature highlights */}
        <div
          className="gap-4 sm:gap-6"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            width: '100%',
          }}
        >
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>

        {/* Footer note */}
        <p className="mt-12 text-sm text-slate-400 text-center w-full">
          By connecting your account, you agree to sync your emails locally for offline access. Your
          data never leaves your device.
        </p>
      </div>
    </div>
  )
}

/**
 * Individual feature card
 */
function FeatureCard({ icon: Icon, title, description }: FeatureItem) {
  return (
    <div
      className="p-4 rounded-xl bg-white border border-slate-100 shadow-sm"
      style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}
    >
      <div
        className="rounded-lg bg-cyan-50"
        style={{
          flexShrink: 0,
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon className="w-5 h-5 text-cyan-600" strokeWidth={1.5} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 className="font-medium text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

export default WelcomeScreen
