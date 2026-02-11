/**
 * useInitializeAI Hook
 *
 * Story 3.2b: AI Capability Detection & Graceful Degradation
 * Task 1: Initialize AI subsystem on app startup
 *
 * Runs after database init to:
 * 1. Check cached capabilities (24h TTL)
 * 2. Detect capabilities if cache expired
 * 3. Initialize inference service when requirements met
 * 4. Wire analysis orchestrator dependencies
 * 5. Update health registry throughout
 *
 * AI init failure never crashes the app.
 */

import { useState, useEffect } from 'react'
import { logger } from '@/services/logger'
import { detectCapabilities } from '@/services/ai/capabilityDetection'
import { aiInferenceService } from '@/services/ai/aiInferenceService'
import { analysisOrchestrator } from '@/services/ai/analysisOrchestrator'
import { createAnalysisDependencies } from '@/services/ai/analysisResultStore'
import { useAICapabilityStore } from '@/store/aiCapabilityStore'
import { healthRegistry } from '@/services/sync/healthRegistry'

export interface UseInitializeAIReturn {
  aiAvailable: boolean
  detecting: boolean
}

export function useInitializeAI(): UseInitializeAIReturn {
  const [detecting, setDetecting] = useState(false)
  const [aiAvailable, setAiAvailable] = useState(false)

  const isCapabilitiesCacheValid = useAICapabilityStore((s) => s.isCapabilitiesCacheValid)
  const capabilities = useAICapabilityStore((s) => s.capabilities)
  const setCapabilities = useAICapabilityStore((s) => s.setCapabilities)
  const setStatus = useAICapabilityStore((s) => s.setStatus)
  const setDetectionError = useAICapabilityStore((s) => s.setDetectionError)

  useEffect(() => {
    let cancelled = false

    const initializeAI = async () => {
      try {
        setDetecting(true)
        setStatus('loading')
        logger.info('ai', 'Starting AI initialization')

        // Step 1: Check cached capabilities
        let caps = capabilities
        if (isCapabilitiesCacheValid()) {
          logger.info('ai', 'Using cached AI capabilities', {
            deviceTier: caps?.deviceTier,
            bestProvider: caps?.bestProvider,
          })
        } else {
          // Step 2: Run capability detection
          logger.info('ai', 'Cache expired or missing, running capability detection')
          caps = await detectCapabilities()
          if (cancelled) return
          setCapabilities(caps)
        }

        if (!caps) {
          setStatus('unavailable')
          healthRegistry.setAIHealth('unavailable', 'No capabilities detected')
          return
        }

        // Step 3: Initialize inference service if requirements met
        if (caps.meetsMinimumRequirements) {
          await aiInferenceService.initialize()
          aiInferenceService.setCapabilities(caps)
          if (cancelled) return
          await aiInferenceService.loadModel()
          if (cancelled) return
          setAiAvailable(true)
          setStatus('ready')
          healthRegistry.setAIHealth('healthy', `AI ready (${caps.bestProvider})`)
        } else {
          setStatus('unavailable')
          setAiAvailable(false)
          healthRegistry.setAIHealth('unavailable', 'Device does not meet minimum requirements')
        }

        // Step 4: Wire analysis orchestrator dependencies
        const deps = createAnalysisDependencies()
        analysisOrchestrator.setDependencies(deps)

        logger.info('ai', 'AI initialization complete', {
          available: caps.meetsMinimumRequirements,
          provider: caps.bestProvider,
        })
      } catch (error) {
        // Step 5: Errors must never crash the app
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Unknown AI init error'
        logger.error('ai', 'AI initialization failed', { error: message })
        setDetectionError(message)
        setStatus('unavailable')
        setAiAvailable(false)
        healthRegistry.setAIHealth('unavailable', `AI init failed: ${message}`)
      } finally {
        if (!cancelled) {
          setDetecting(false)
        }
      }
    }

    initializeAI()

    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- Run once on mount

  return { aiAvailable, detecting }
}
