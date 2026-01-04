/**
 * Quota Monitor Service
 * Monitors IndexedDB storage usage and provides threshold-based status
 *
 * AC 1: StorageManager API used to monitor IndexedDB usage via `navigator.storage.estimate()`
 * AC 2: Current usage and available quota displayed in settings page
 * AC 3: Usage percentage calculated and shown
 * AC 4: Warning banner shown when usage reaches 80% quota
 * AC 5: Cleanup wizard triggered automatically when usage reaches 90% quota
 */

/**
 * Quota threshold status levels
 */
export type QuotaThresholdStatus = 'normal' | 'warning' | 'critical'

/**
 * Storage quota state
 */
export interface QuotaState {
  usage: number // Bytes currently used
  quota: number // Total available bytes
  percentage: number // Usage percentage (0-100)
  status: QuotaThresholdStatus // Threshold status
  lastChecked: number // Unix timestamp of last check
}

/**
 * Quota monitor configuration
 */
export interface QuotaMonitorConfig {
  warningThreshold: number // Percentage (0-100) for warning status (default 80)
  criticalThreshold: number // Percentage (0-100) for critical status (default 90)
  checkIntervalMs: number // Interval for periodic monitoring (default 5 minutes)
}

const DEFAULT_CONFIG: QuotaMonitorConfig = {
  warningThreshold: 80,
  criticalThreshold: 90,
  checkIntervalMs: 5 * 60 * 1000, // 5 minutes
}

/**
 * Quota Monitor Service
 * Manages IndexedDB storage quota monitoring with threshold-based alerts
 */
export class QuotaMonitorService {
  private config: QuotaMonitorConfig
  private currentState: QuotaState | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private listeners: Set<(state: QuotaState) => void> = new Set()

  constructor(config?: Partial<QuotaMonitorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Check storage quota using StorageManager API
   *
   * AC 1: StorageManager API used to monitor IndexedDB usage
   *
   * @returns Current quota state
   */
  async checkStorageQuota(): Promise<QuotaState> {
    // Check if StorageManager API is available
    if (!navigator.storage || !navigator.storage.estimate) {
      // Return fallback state if API not available
      const fallbackState: QuotaState = {
        usage: 0,
        quota: 0,
        percentage: 0,
        status: 'normal',
        lastChecked: Date.now(),
      }
      this.currentState = fallbackState
      return fallbackState
    }

    const estimate = await navigator.storage.estimate()

    const usage = estimate.usage || 0
    const quota = estimate.quota || 0
    const percentage = this.getUsagePercentage(usage, quota)
    const status = this.getThresholdStatus(percentage)

    const state: QuotaState = {
      usage,
      quota,
      percentage,
      status,
      lastChecked: Date.now(),
    }

    this.currentState = state

    // Notify listeners
    this.notifyListeners(state)

    return state
  }

  /**
   * Calculate usage percentage
   *
   * AC 3: Usage percentage calculated
   *
   * @param usage - Bytes currently used
   * @param quota - Total available bytes
   * @returns Percentage 0-100
   */
  getUsagePercentage(usage?: number, quota?: number): number {
    const u = usage ?? this.currentState?.usage ?? 0
    const q = quota ?? this.currentState?.quota ?? 0

    if (q === 0) return 0

    const percentage = (u / q) * 100
    return Math.round(percentage * 100) / 100 // Round to 2 decimal places
  }

  /**
   * Get threshold status based on usage percentage
   *
   * AC 4: Warning at 80%
   * AC 5: Critical at 90%
   *
   * @param percentage - Usage percentage
   * @returns Threshold status
   */
  getThresholdStatus(percentage?: number): QuotaThresholdStatus {
    const p = percentage ?? this.currentState?.percentage ?? 0

    if (p >= this.config.criticalThreshold) {
      return 'critical'
    }

    if (p >= this.config.warningThreshold) {
      return 'warning'
    }

    return 'normal'
  }

  /**
   * Get current quota state without making a new API call
   *
   * @returns Current state or null if never checked
   */
  getCurrentState(): QuotaState | null {
    return this.currentState
  }

  /**
   * Start periodic monitoring
   *
   * @param intervalMs - Optional override for check interval
   */
  startMonitoring(intervalMs?: number): void {
    // Stop any existing monitoring
    this.stopMonitoring()

    const interval = intervalMs ?? this.config.checkIntervalMs

    // Do initial check
    this.checkStorageQuota()

    // Set up periodic checks
    this.intervalId = setInterval(() => {
      this.checkStorageQuota()
    }, interval)
  }

  /**
   * Stop periodic monitoring
   */
  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  /**
   * Subscribe to quota state changes
   *
   * @param listener - Callback function to receive state updates
   * @returns Unsubscribe function
   */
  subscribe(listener: (state: QuotaState) => void): () => void {
    this.listeners.add(listener)

    // Send current state immediately if available
    if (this.currentState) {
      listener(this.currentState)
    }

    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(state: QuotaState): void {
    for (const listener of this.listeners) {
      try {
        listener(state)
      } catch (error) {
        console.error('Error in quota state listener:', error)
      }
    }
  }

  /**
   * Update configuration
   *
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<QuotaMonitorConfig>): void {
    this.config = { ...this.config, ...config }

    // Re-evaluate current state with new thresholds
    if (this.currentState) {
      const newStatus = this.getThresholdStatus(this.currentState.percentage)
      if (newStatus !== this.currentState.status) {
        this.currentState = { ...this.currentState, status: newStatus }
        this.notifyListeners(this.currentState)
      }
    }
  }

  /**
   * Check if storage API is available
   */
  isStorageApiAvailable(): boolean {
    return !!(navigator.storage && navigator.storage.estimate)
  }
}

/**
 * Singleton instance management
 */
let _quotaMonitorService: QuotaMonitorService | null = null

/**
 * Get the singleton quota monitor service instance
 *
 * @param config - Optional configuration for first initialization
 * @returns QuotaMonitorService instance
 */
export function getQuotaMonitorService(config?: Partial<QuotaMonitorConfig>): QuotaMonitorService {
  if (!_quotaMonitorService) {
    _quotaMonitorService = new QuotaMonitorService(config)
  }
  return _quotaMonitorService
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetQuotaMonitorService(): void {
  if (_quotaMonitorService) {
    _quotaMonitorService.stopMonitoring()
  }
  _quotaMonitorService = null
}
