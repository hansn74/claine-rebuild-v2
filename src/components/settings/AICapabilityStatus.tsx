/**
 * AICapabilityStatus Component
 *
 * Story 3.1: Local LLM Integration (Browser-Based Inference)
 * Task 8: Graceful degradation UI (AC: 10)
 *
 * Displays AI capability status on the settings page.
 * Shows provider status, device tier, and browser compatibility help.
 */

import {
  useAICapabilityStore,
  selectAIAvailable,
  selectEffectiveProvider,
} from '@/store/aiCapabilityStore'
import {
  getCapabilityStatusMessage,
  getBrowserCompatibilityHelpUrl,
} from '@/services/ai/capabilityDetection'

/**
 * Status indicator colors/labels
 */
function getStatusIndicator(
  available: boolean,
  provider: string | null
): { label: string; className: string } {
  if (!available) {
    return { label: 'Unavailable', className: 'ai-status-unavailable' }
  }
  if (provider === 'webgpu') {
    return { label: 'WebGPU', className: 'ai-status-optimal' }
  }
  if (provider === 'wasm') {
    return { label: 'CPU (slower)', className: 'ai-status-degraded' }
  }
  return { label: 'Unknown', className: 'ai-status-unknown' }
}

export function AICapabilityStatus() {
  const capabilities = useAICapabilityStore((s) => s.capabilities)
  const status = useAICapabilityStore((s) => s.status)
  const aiAvailable = useAICapabilityStore(selectAIAvailable)
  const effectiveProvider = useAICapabilityStore(selectEffectiveProvider)

  const statusIndicator = getStatusIndicator(aiAvailable, effectiveProvider)
  const statusMessage = capabilities
    ? getCapabilityStatusMessage(capabilities)
    : 'AI capabilities not yet detected'
  const helpUrl = capabilities ? getBrowserCompatibilityHelpUrl(capabilities) : null

  return (
    <div className="ai-capability-status" data-testid="ai-capability-status">
      <h3>AI Features</h3>

      <div className="ai-status-row">
        <span className="ai-status-label">Status:</span>
        <span className={statusIndicator.className} data-testid="ai-status-indicator">
          {statusIndicator.label}
        </span>
      </div>

      <div className="ai-status-row">
        <span className="ai-status-label">Details:</span>
        <span data-testid="ai-status-message">{statusMessage}</span>
      </div>

      {capabilities && (
        <>
          <div className="ai-status-row">
            <span className="ai-status-label">Device tier:</span>
            <span data-testid="ai-device-tier">{capabilities.deviceTier}</span>
          </div>

          {capabilities.deviceMemoryGB && (
            <div className="ai-status-row">
              <span className="ai-status-label">Memory:</span>
              <span>{capabilities.deviceMemoryGB}GB</span>
            </div>
          )}

          <div className="ai-status-row">
            <span className="ai-status-label">WebGPU:</span>
            <span>{capabilities.webgpuSupported ? 'Supported' : 'Not available'}</span>
          </div>

          <div className="ai-status-row">
            <span className="ai-status-label">WebAssembly:</span>
            <span>{capabilities.wasmSupported ? 'Supported' : 'Not available'}</span>
          </div>
        </>
      )}

      {status === 'loading' && (
        <div className="ai-status-row" data-testid="ai-loading-indicator">
          <span>Loading AI model...</span>
        </div>
      )}

      {helpUrl && (
        <div className="ai-status-row">
          <a href={helpUrl} target="_blank" rel="noopener noreferrer" data-testid="ai-help-link">
            Browser compatibility info
          </a>
        </div>
      )}
    </div>
  )
}
