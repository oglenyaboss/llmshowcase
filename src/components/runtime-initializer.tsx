'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useShowcaseState } from '@/state/showcase-context'
import { ModelManager } from '@/runtime/model-manager'
import type { CapabilityProbeResult, RuntimePhase } from '@/runtime/inference-types'

export function RuntimeInitializer() {
  const { state, dispatch } = useShowcaseState()
  const managerRef = useRef<ModelManager | null>(null)
  const prevModelIdRef = useRef<string>(state.selectedModelId)
  const isLoadingRef = useRef(false)

  const dispatchProbeResult = useCallback((result: CapabilityProbeResult) => {
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
    dispatch({ 
      type: 'LOAD_READY', 
      payload: { modelId, loadDurationMs, warmupDurationMs } 
    })
    isLoadingRef.current = false
  }, [dispatch])

  const dispatchGenerationStart = useCallback(() => {
    dispatch({ type: 'GENERATION_START' })
  }, [dispatch])

  const dispatchStreamDelta = useCallback((_: string, token: string) => {
    dispatch({ type: 'GENERATION_STREAM', payload: { token } })
  }, [dispatch])

  const dispatchGenerationComplete = useCallback(() => {
    dispatch({ 
      type: 'GENERATION_COMPLETE', 
      payload: { tokenCount: 0, durationMs: 0 } 
    })
  }, [dispatch])

  const dispatchGenerationInterrupted = useCallback(() => {
    dispatch({ type: 'GENERATION_INTERRUPTED' })
  }, [dispatch])

  const dispatchRuntimeError = useCallback((_: string, error: string, phase: string) => {
    dispatch({ 
      type: 'RUNTIME_ERROR', 
      payload: { error, phase: phase as RuntimePhase } 
    })
    isLoadingRef.current = false
  }, [dispatch])

  useEffect(() => {
    const manager = new ModelManager({
      onProbeResult: dispatchProbeResult,
      onLoadStarted: dispatchLoadStart,
      onLoadProgress: dispatchLoadProgress,
      onWarmingStarted: dispatchWarmupStart,
      onModelReady: dispatchModelReady,
      onGenerationStarted: dispatchGenerationStart,
      onStreamDelta: dispatchStreamDelta,
      onGenerationComplete: dispatchGenerationComplete,
      onGenerationInterrupted: dispatchGenerationInterrupted,
      onRuntimeError: dispatchRuntimeError,
    })

    managerRef.current = manager
    dispatch({ type: 'PROBE_START' })
    manager.probe()

    return () => {
      manager.dispose()
      managerRef.current = null
    }
  }, [
    dispatch,
    dispatchProbeResult,
    dispatchLoadStart,
    dispatchLoadProgress,
    dispatchWarmupStart,
    dispatchModelReady,
    dispatchGenerationStart,
    dispatchStreamDelta,
    dispatchGenerationComplete,
    dispatchGenerationInterrupted,
    dispatchRuntimeError,
  ])

  useEffect(() => {
    const manager = managerRef.current
    if (!manager) return

    if (state.runtimePhase === 'idle' && !isLoadingRef.current) {
      isLoadingRef.current = true
      manager.loadModel(state.selectedModelId)
    }
  }, [state.runtimePhase, state.selectedModelId])

  useEffect(() => {
    const manager = managerRef.current
    if (!manager) return

    if (prevModelIdRef.current !== state.selectedModelId && state.runtimePhase === 'ready') {
      prevModelIdRef.current = state.selectedModelId
      isLoadingRef.current = true
      manager.switchModel(state.selectedModelId)
    }
  }, [state.selectedModelId, state.runtimePhase])

  return null
}