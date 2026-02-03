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
  /** Called when user clicks to connect Gmail */
  onConnectGmail: () => void
  /** Called when user clicks to connect Outlook */
  onConnectOutlook: () => void
  /** Called when user skips the welcome screen */
  onSkip?: () => void
  /** Optional custom className */
  className?: string
  /** Whether connection is in progress */
  isConnecting?: boolean
  /** @deprecated Use onConnectGmail instead */
  onConnectAccount?: () => void
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
  onConnectGmail,
  onConnectOutlook,
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

        {/* Connect Email CTA - Provider Selection */}
        <div className="mb-12 text-center flex flex-col items-center" style={{ width: '100%' }}>
          <p className="text-sm text-slate-600 mb-4">Choose your email provider</p>

          <div className="flex gap-4">
            {/* Gmail Button */}
            <Button
              onClick={onConnectGmail}
              disabled={isConnecting}
              size="lg"
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-6 py-6 text-lg font-medium rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
              aria-label="Connect your Gmail account"
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
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"
                    />
                    <path
                      fill="#34A853"
                      d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"
                    />
                    <path
                      fill="#4A90E2"
                      d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"
                    />
                  </svg>
                  Gmail
                </>
              )}
            </Button>

            {/* Outlook Button */}
            <Button
              onClick={onConnectOutlook}
              disabled={isConnecting}
              size="lg"
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-6 py-6 text-lg font-medium rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
              aria-label="Connect your Outlook account"
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
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="#0078D4"
                      d="M24 7.387v10.478c0 .23-.08.424-.238.576-.158.154-.352.23-.58.23h-8.547v-6.959l1.6 1.229c.102.086.223.129.36.129.14 0 .263-.043.366-.129l6.8-5.224c.08-.058.16-.087.24-.087Z"
                    />
                    <path
                      fill="#0078D4"
                      d="M15.635 7.17l8.126 6.23V7.387c0-.23-.08-.42-.238-.574-.158-.152-.352-.228-.58-.228h-7.308Z"
                    />
                    <path
                      fill="#0078D4"
                      d="M0 5.61v12.78c0 .4.14.742.42 1.025.28.282.62.423 1.02.423h9.24V4.162H1.44c-.4 0-.74.141-1.02.424-.28.282-.42.623-.42 1.024Z"
                    />
                    <path
                      fill="#0364B8"
                      d="M10.68 4.162V19.84h12.88c.228 0 .422-.076.58-.23.158-.152.238-.345.238-.575V7.387c0-.23-.08-.42-.238-.574-.158-.152-.352-.228-.58-.228H14.635v-.023l-3.955-2.4Z"
                    />
                  </svg>
                  Outlook
                </>
              )}
            </Button>
          </div>

          <p className="text-sm text-slate-500 mt-4" style={{ whiteSpace: 'nowrap' }}>
            Connect Gmail or Outlook to get started
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
