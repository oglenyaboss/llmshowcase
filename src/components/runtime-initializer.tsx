'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useShowcaseState } from '@/state/showcase-context'
import {
  ModelManager,
  isModelManagerCancellationError,
} from '@/runtime/model-manager'
import { createModelManager } from '@/runtime/runtime-factory'
import type { MockModelManager } from '@/runtime/mock-model-manager'
import type { CapabilityProbeResult, RuntimePhase } from '@/runtime/inference-types'
import {
  selectActiveChatModelId,
  selectActiveGenerationInput,
  selectIsHydrated,
  selectActiveChatSystemPrompt,
} from '@/state/showcase-selectors'
import { buildInferenceMessages } from '@/runtime/chat-request'

export function RuntimeInitializer() {
  const { state, dispatch } = useShowcaseState()
  const managerRef = useRef<ModelManager | MockModelManager | null>(null)
  const prevModelIdRef = useRef<string>(selectActiveChatModelId(state))
  const isLoadingRef = useRef(false)
  const activeGenerationKeyRef = useRef<string | null>(null)
  const stopRequestedRef = useRef(false)
  const hasCompletedProbeRef = useRef(false)

  const dispatchProbeResult = useCallback((result: CapabilityProbeResult) => {
    hasCompletedProbeRef.current = true
    dispatch({ type: 'PROBE_SUCCESS', payload: result })
  }, [dispatch])

  const dispatchLoadStart = useCallback((modelId: string) => {
    dispatch({ type: 'LOAD_START', payload: { modelId } })
  }, [dispatch])

  const dispatchLoadProgress = useCallback((_: string, progress: number, status: string) => {
    dispatch({ type: 'LOAD_PROGRESS', payload: { progress, status } })
  }, [dispatch])

  const dispatchWarmupStart = useCallback(() => {
    dispatch({ type: 'WARMUP_START' })
  }, [dispatch])

  const dispatchModelReady = useCallback((modelId: string, loadDurationMs: number, warmupDurationMs: number) => {
    prevModelIdRef.current = modelId
    dispatch({ 
      type: 'LOAD_READY', 
      payload: { modelId, loadDurationMs, warmupDurationMs } 
    })
    isLoadingRef.current = false
  }, [dispatch])

  const dispatchStreamDelta = useCallback((_: string, token: string) => {
    dispatch({ type: 'GENERATION_STREAM', payload: { token } })
  }, [dispatch])

  const dispatchGenerationComplete = useCallback((_: string, tokenCount: number, durationMs: number) => {
    dispatch({ 
      type: 'GENERATION_COMPLETE', 
      payload: { tokenCount, durationMs } 
    })
  }, [dispatch])

  const dispatchGenerationInterrupted = useCallback((_: string, _tokenCount: number, _durationMs: number) => {
    dispatch({ type: 'GENERATION_INTERRUPTED' })
  }, [dispatch])

  const dispatchRuntimeError = useCallback((_: string, error: string, phase: string) => {
    dispatch({ 
      type: 'RUNTIME_ERROR', 
      payload: { error, phase: phase as RuntimePhase } 
    })
    isLoadingRef.current = false
  }, [dispatch])

  const handleAsyncFailure = useCallback((error: unknown, phase: RuntimePhase) => {
    if (isModelManagerCancellationError(error)) {
      return
    }

    const message = error instanceof Error ? error.message : 'Unknown runtime error'

    if (phase === 'probing') {
      hasCompletedProbeRef.current = false
      dispatch({ type: 'PROBE_FAILURE', payload: message })
      isLoadingRef.current = false
      return
    }

    dispatch({
      type: 'RUNTIME_ERROR',
      payload: { error: message, phase },
    })
    isLoadingRef.current = false
  }, [dispatch])

  // Probe on mount
useEffect(() => {
    const manager = createModelManager({
      onProbeResult: dispatchProbeResult,
      onLoadStarted: dispatchLoadStart,
      onLoadProgress: dispatchLoadProgress,
      onWarmingStarted: dispatchWarmupStart,
      onModelReady: dispatchModelReady,
      onGenerationStarted: () => {},
      onStreamDelta: dispatchStreamDelta,
      onGenerationComplete: dispatchGenerationComplete,
      onGenerationInterrupted: dispatchGenerationInterrupted,
      onRuntimeError: dispatchRuntimeError,
    })

    managerRef.current = manager
    dispatch({ type: 'PROBE_START' })
    void manager.probe().catch((error) => {
      if (managerRef.current !== manager) {
        return
      }

      handleAsyncFailure(error, 'probing')
    })

    return () => {
      manager.dispose()
      if (managerRef.current === manager) {
        managerRef.current = null
      }
      isLoadingRef.current = false
      activeGenerationKeyRef.current = null
      stopRequestedRef.current = false
      hasCompletedProbeRef.current = false
    }
  }, [
    dispatch,
    dispatchProbeResult,
    dispatchLoadStart,
    dispatchLoadProgress,
    dispatchWarmupStart,
    dispatchModelReady,
    dispatchStreamDelta,
    dispatchGenerationComplete,
    dispatchGenerationInterrupted,
    dispatchRuntimeError,
    handleAsyncFailure,
  ])

  const currentModelId = selectActiveChatModelId(state)
  const isHydrated = selectIsHydrated(state)

  // Initial model load after probe and hydration
  useEffect(() => {
    const manager = managerRef.current
    if (!manager || !isHydrated) return

    if (
      state.runtimePhase === 'idle' &&
      hasCompletedProbeRef.current &&
      !isLoadingRef.current &&
      manager.getActiveModelId() !== currentModelId
    ) {
      isLoadingRef.current = true
      void manager.loadModel(currentModelId)
        .then((result) => {
          if (!result.success) {
            handleAsyncFailure(
              new Error(result.error ?? 'Failed to load model'),
              'loading_model'
            )
          }
        })
        .catch((error) => {
          if (managerRef.current !== manager) {
            return
          }

          handleAsyncFailure(error, 'loading_model')
        })
    }
  }, [state.runtimePhase, currentModelId, isHydrated, handleAsyncFailure])

  // Model switch when model changes while ready
  useEffect(() => {
    const manager = managerRef.current
    if (!manager) return

    if (prevModelIdRef.current !== currentModelId && state.runtimePhase === 'ready') {
      prevModelIdRef.current = currentModelId
      isLoadingRef.current = true
      void manager.switchModel(currentModelId).catch((error) => {
        if (managerRef.current !== manager) {
          return
        }

        handleAsyncFailure(error, 'loading_model')
      })
    }
  }, [currentModelId, state.runtimePhase, handleAsyncFailure])

  // Generation - triggered by GENERATION_ENQUEUE from UI
  useEffect(() => {
    const manager = managerRef.current
    if (!manager) return

    if (state.runtimePhase !== 'generating') {
      activeGenerationKeyRef.current = null
      return
    }

    const generationInput = selectActiveGenerationInput(state)
    if (!generationInput) return

    const generationKey = `${currentModelId}:${generationInput.messages.length}`
    if (activeGenerationKeyRef.current === generationKey) {
      return
    }

    activeGenerationKeyRef.current = generationKey

    const systemPrompt = selectActiveChatSystemPrompt(state)
    const newUserMessage = generationInput.messages[generationInput.messages.length - 1]
    const chatMessages = generationInput.messages.slice(0, -1)

    const messages = buildInferenceMessages(
      systemPrompt,
      chatMessages,
      newUserMessage?.content ?? ''
    )

    void manager.generate(currentModelId, messages, generationInput.settings)
      .then((result) => {
        if (!result.success) {
          handleAsyncFailure(
            new Error(result.error ?? 'Failed to generate output'),
            'generating'
          )
        }
      })
      .catch((error) => {
        if (managerRef.current !== manager) {
          return
        }

        handleAsyncFailure(error, 'generating')
      })
  }, [state.runtimePhase, currentModelId, state, handleAsyncFailure])

  // Stop/interrupt generation
  useEffect(() => {
    const manager = managerRef.current
    if (!manager) return

    if (state.runtimePhase !== 'stopping') {
      stopRequestedRef.current = false
      return
    }

    if (stopRequestedRef.current) {
      return
    }

    stopRequestedRef.current = true
    manager.interrupt()
  }, [state.runtimePhase])

  return null
}
