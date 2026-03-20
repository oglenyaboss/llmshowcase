'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'

import { RuntimeInitializer } from '@/components/runtime-initializer'
import { modelList } from '@/config/models'
import { applyPresetTemplate, presetList } from '@/config/presets'
import { parseAssistantContent } from '@/lib/assistant-content'
import { formatDuration } from '@/lib/format'
import { estimateContextWindowUsage } from '@/state/context-window'
import { ShowcaseProvider, useShowcaseState } from '@/state/showcase-context'
import {
  selectActiveAssistantMessageId,
  selectActiveChatDraft,
  selectActiveChatInferenceSettings,
  selectActiveChatMessages,
  selectActiveChatModelId,
  selectActiveChatSystemPrompt,
  selectActiveChatTitle,
  selectActiveChatId,
  selectCanGenerate,
  selectCanClearError,
  selectCanStop,
  selectChatsSortedByUpdated,
  selectCurrentError,
  selectHydrationStatus,
  selectIsBusy,
  selectIsGenerating,
  selectIsLoading,
  selectLoadProgress,
  selectLoadStatus,
  selectRuntimePhase,
  selectStatusMessage,
  selectTelemetry,
  selectWarmState,
} from '@/state/showcase-selectors'
import type { GenerationDefaults, RuntimePhase } from '@/runtime/inference-types'

const PROTOTYPE_PRESETS = [
  { id: 'summarize', label: 'Summarize' },
  { id: 'explain-code', label: 'Code' },
  { id: 'rewrite-text', label: 'Rewrite' },
  { id: 'extract-json', label: 'JSON' },
] as const

const INFERENCE_SLIDERS: Array<{
  label: string
  key: keyof Pick<
    GenerationDefaults,
    'temperature' | 'topP' | 'presencePenalty' | 'repetitionPenalty' | 'maxNewTokens'
  >
  min: number
  max: number
  step: number
  format: (value: number) => string
}> = [
  {
    label: 'Temperature',
    key: 'temperature',
    min: 0,
    max: 2,
    step: 0.05,
    format: (value) => value.toFixed(2),
  },
  {
    label: 'Top P',
    key: 'topP',
    min: 0,
    max: 1,
    step: 0.05,
    format: (value) => value.toFixed(2),
  },
  {
    label: 'Presence',
    key: 'presencePenalty',
    min: 0,
    max: 2,
    step: 0.1,
    format: (value) => value.toFixed(1),
  },
  {
    label: 'Rep. Penalty',
    key: 'repetitionPenalty',
    min: 1,
    max: 2,
    step: 0.05,
    format: (value) => value.toFixed(2),
  },
  {
    label: 'Max Tokens',
    key: 'maxNewTokens',
    min: 16,
    max: 2000,
    step: 10,
    format: (value) => Math.round(value).toString(),
  },
]

const ADVANCED_INFERENCE_SLIDERS: Array<{
  label: string
  key: keyof Pick<GenerationDefaults, 'topK' | 'minP'>
  min: number
  max: number
  step: number
  format: (value: number) => string
}> = [
  {
    label: 'Top K',
    key: 'topK',
    min: 1,
    max: 100,
    step: 1,
    format: (value) => Math.round(value).toString(),
  },
  {
    label: 'Min P',
    key: 'minP',
    min: 0,
    max: 1,
    step: 0.05,
    format: (value) => value.toFixed(2),
  },
]

const QWEN_MODE_PRESETS = {
  direct: {
    label: 'Direct',
    settings: {
      doSample: true,
      enableThinking: false,
      temperature: 0.7,
      topP: 0.8,
      topK: 20,
      minP: 0,
      presencePenalty: 1.5,
      repetitionPenalty: 1,
    },
  },
  thinking: {
    label: 'Thinking',
    settings: {
      doSample: true,
      enableThinking: true,
      temperature: 1,
      topP: 0.95,
      topK: 20,
      minP: 0,
      presencePenalty: 1.5,
      repetitionPenalty: 1,
    },
  },
} as const

function isPresetActive(settings: GenerationDefaults, preset: keyof typeof QWEN_MODE_PRESETS): boolean {
  const target = QWEN_MODE_PRESETS[preset].settings

  return (
    settings.doSample === target.doSample &&
    settings.enableThinking === target.enableThinking &&
    settings.temperature === target.temperature &&
    settings.topP === target.topP &&
    settings.topK === target.topK &&
    settings.minP === target.minP &&
    settings.presencePenalty === target.presencePenalty &&
    settings.repetitionPenalty === target.repetitionPenalty
  )
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
}

function formatConversationDate(timestamp: number): string {
  const target = new Date(timestamp)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  )
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfTarget.getTime()) / 86_400_000
  )

  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(target)
}

function formatRuntimeLabel(phase: RuntimePhase): string {
  switch (phase) {
    case 'idle':
      return 'Idle'
    case 'probing':
      return 'Probing'
    case 'unsupported':
      return 'Unsupported'
    case 'loading_model':
      return 'Loading'
    case 'warming_model':
      return 'Warming'
    case 'ready':
      return 'Ready'
    case 'generating':
      return 'Generating'
    case 'stopping':
      return 'Stopping'
    case 'error':
      return 'Error'
  }
}

function formatTokensPerSecond(value: number | null): string {
  if (value === null) return 'N/A'
  return `${value.toFixed(1)} t/s`
}

function formatTokenCount(value: number): string {
  if (value < 1000) return value.toString()

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: value >= 100_000 ? 0 : 1,
  }).format(value)
}

function getContextTone(usageRatio: number): {
  stroke: string
  accent: string
  glow: string
} {
  if (usageRatio >= 0.8) {
    return {
      stroke: 'var(--p3-accent)',
      accent: 'var(--p3-accent)',
      glow: 'rgba(191, 74, 43, 0.18)',
    }
  }

  if (usageRatio >= 0.5) {
    return {
      stroke: 'var(--p3-gold)',
      accent: 'var(--p3-gold)',
      glow: 'rgba(166, 139, 91, 0.16)',
    }
  }

  return {
    stroke: 'var(--p3-accent2)',
    accent: 'var(--p3-accent2)',
    glow: 'rgba(42, 94, 76, 0.14)',
  }
}

function getStatusTone(status: 'ok' | 'pending' | 'error'): {
  background: string
  shadow: string
} {
  switch (status) {
    case 'ok':
      return {
        background: 'var(--p3-accent2)',
        shadow: '0 0 6px rgba(42, 94, 76, 0.3)',
      }
    case 'pending':
      return {
        background: 'var(--p3-gold)',
        shadow: '0 0 6px rgba(166, 139, 91, 0.3)',
      }
    case 'error':
      return {
        background: 'var(--p3-accent)',
        shadow: '0 0 6px rgba(191, 74, 43, 0.3)',
      }
  }
}

function ShowcaseShell() {
  const { state, dispatch } = useShowcaseState()
  const chats = selectChatsSortedByUpdated(state)
  const activeChatId = selectActiveChatId(state)
  const activeChatTitle = selectActiveChatTitle(state)
  const messages = selectActiveChatMessages(state)
  const draft = selectActiveChatDraft(state)
  const selectedModelId = selectActiveChatModelId(state)
  const systemPrompt = selectActiveChatSystemPrompt(state)
  const inferenceSettings = selectActiveChatInferenceSettings(state)
  const runtimePhase = selectRuntimePhase(state)
  const warmState = selectWarmState(state)
  const telemetry = selectTelemetry(state)
  const canGenerate = selectCanGenerate(state)
  const canClearError = selectCanClearError(state)
  const canStop = selectCanStop(state)
  const isGenerating = selectIsGenerating(state)
  const isLoading = selectIsLoading(state)
  const isBusy = selectIsBusy(state)
  const hydrationStatus = selectHydrationStatus(state)
  const loadProgress = selectLoadProgress(state)
  const loadStatus = selectLoadStatus(state)
  const statusMessage = selectStatusMessage(state)
  const currentError = selectCurrentError(state)
  const activeAssistantMessageId = selectActiveAssistantMessageId(state)

  const bottomRef = useRef<HTMLDivElement>(null)
  const draftTextareaRef = useRef<HTMLTextAreaElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const isHydrated = hydrationStatus === 'ready'
  const controlsLocked = isBusy || !isHydrated
  const wordCount = countWords(draft)
  const autoScrollKey = `${messages.length}:${activeAssistantMessageId ?? ''}:${isGenerating ? '1' : '0'}`
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [openThinkBlocks, setOpenThinkBlocks] = useState<Record<string, boolean>>({})
  const [advancedInferenceOpen, setAdvancedInferenceOpen] = useState(false)
  const [contextDetailsOpen, setContextDetailsOpen] = useState(false)
  const [telemetryDetailsOpen, setTelemetryDetailsOpen] = useState(false)

  useEffect(() => {
    if (!autoScrollKey) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [autoScrollKey])

  useEffect(() => {
    if (!editingChatId) return
    requestAnimationFrame(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    })
  }, [editingChatId])

  const systemStatuses = useMemo(
    (): Array<{
      key: string
      testId: string
      value: string
      status: 'ok' | 'pending' | 'error'
    }> => [
      {
        key: 'WebGPU',
        testId: 'status-webgpu',
        value:
          runtimePhase === 'unsupported' || runtimePhase === 'error'
            ? 'Unavailable'
            : runtimePhase === 'probing' || !isHydrated
              ? 'Checking'
              : 'Available',
        status:
          runtimePhase === 'unsupported' || runtimePhase === 'error'
            ? 'error'
            : runtimePhase === 'probing' || !isHydrated
              ? 'pending'
              : 'ok',
      },
      {
        key: 'Runtime',
        testId: 'status-runtime',
        value: formatRuntimeLabel(runtimePhase),
        status:
          runtimePhase === 'error'
            ? 'error'
            : runtimePhase === 'probing' || runtimePhase === 'loading_model'
              ? 'pending'
              : runtimePhase === 'unsupported'
                ? 'error'
                : 'ok',
      },
      {
        key: 'Model',
        testId: 'status-model',
        value:
          runtimePhase === 'error' || runtimePhase === 'unsupported'
            ? 'Unavailable'
            : warmState === 'warm'
              ? 'Loaded'
              : 'Preparing',
        status:
          runtimePhase === 'error' || runtimePhase === 'unsupported'
            ? 'error'
            : warmState === 'warm'
              ? 'ok'
              : 'pending',
      },
      {
        key: 'Cache',
        testId: 'status-warm',
        value: warmState === 'warm' ? 'Warm' : 'Cold',
        status: warmState === 'warm' ? 'ok' : 'pending',
      },
    ],
    [isHydrated, runtimePhase, warmState]
  )

  const selectedModel = useMemo(
    () => modelList.find((model) => model.id === selectedModelId) ?? modelList[0],
    [selectedModelId]
  )

  const contextEstimate = estimateContextWindowUsage({
    systemPrompt,
    messages,
    draft,
    reserveTokens: inferenceSettings.maxNewTokens,
    limitTokens: selectedModel.contextWindowTokens,
  })

  const contextTone = getContextTone(contextEstimate.usageRatio)
  const contextUsagePercent = Math.max(1, Math.round(contextEstimate.usageRatio * 100))
  const contextRingRadius = 48
  const contextRingCircumference = 2 * Math.PI * contextRingRadius
  const contextRingOffset =
    contextRingCircumference * (1 - Math.min(contextEstimate.usageRatio, 1))
  const directPresetActive = isPresetActive(inferenceSettings, 'direct')
  const thinkingPresetActive = isPresetActive(inferenceSettings, 'thinking')
  const thinkingSupported = selectedModel.supportsThinking
  const inferenceModeLabel = thinkingPresetActive
    ? 'Thinking'
    : directPresetActive
      ? 'Direct'
      : 'Custom'
  const contextSummaryRows = [
    {
      key: 'Recent Messages',
      value: `${formatTokenCount(contextEstimate.messageTokens)} · ${contextEstimate.historyMessageCount}/16`,
    },
    {
      key: 'Reply Reserve',
      value: formatTokenCount(contextEstimate.reserveTokens),
    },
    {
      key: 'Remaining',
      value: formatTokenCount(contextEstimate.remainingTokens),
    },
  ]
  const contextDetailRows = [
    {
      key: 'System Prompt',
      value: formatTokenCount(contextEstimate.systemPromptTokens),
    },
    {
      key: 'Draft',
      value: formatTokenCount(contextEstimate.draftTokens),
    },
  ]
  const telemetrySummaryRows = [
    { key: 'Model', value: telemetry.selectedModelLabel },
    {
      key: 'Phase',
      value: formatRuntimeLabel(runtimePhase),
      testId: 'telemetry-runtime',
    },
    {
      key: 'Speed',
      value: formatTokensPerSecond(telemetry.approxTokensPerSecond),
    },
    {
      key: 'Memory',
      value: telemetry.heuristicMemoryNote,
    },
  ]
  const telemetryDetailRows = [
    { key: 'Repository', value: telemetry.selectedModelRepoId },
    { key: 'Support Tier', value: telemetry.supportTier },
    { key: 'Runtime', value: telemetry.runtimeLibrary },
    { key: 'Backend', value: telemetry.backend },
    {
      key: 'Warm State',
      value: warmState === 'warm' ? 'Warm' : 'Cold',
    },
    {
      key: 'shader-f16',
      value: telemetry.shaderF16Support ? 'Supported' : 'Unavailable',
    },
    {
      key: 'Max Buffer',
      value: telemetry.maxBufferSize,
    },
    {
      key: 'Max Storage Buffer',
      value: telemetry.maxStorageBufferBindingSize,
    },
    {
      key: 'Load',
      value:
        isLoading && loadProgress > 0
          ? `${Math.round(loadProgress)}%`
          : formatDuration(telemetry.loadDurationMs),
    },
    {
      key: 'Warmup',
      value: formatDuration(telemetry.warmupDurationMs),
    },
    {
      key: 'Generation Duration',
      value: formatDuration(telemetry.generationDurationMs),
    },
    {
      key: 'Tokens',
      value: telemetry.approxTokenCount.toString(),
    },
  ]

  const liveStatusMessage =
    currentError ??
    (isLoading
      ? `${loadStatus || 'Preparing model'} · ${Math.round(loadProgress)}%`
      : isGenerating
        ? 'Generating response…'
        : statusMessage)

  const handleNewChat = () => {
    if (controlsLocked) return
    dispatch({ type: 'CREATE_CHAT' })
    requestAnimationFrame(() => {
      draftTextareaRef.current?.focus()
    })
  }

  const handleSelectChat = (chatId: string) => {
    if (controlsLocked || chatId === activeChatId) return
    dispatch({ type: 'SELECT_CHAT', payload: chatId })
  }

  const handleModelSelect = (modelId: string) => {
    if (controlsLocked) return
    if (modelId === selectedModelId) {
      if (canClearError) {
        dispatch({ type: 'CLEAR_ERROR' })
      }
      return
    }
    dispatch({ type: 'SET_ACTIVE_CHAT_MODEL', payload: modelId })
  }

  const handleClearError = () => {
    if (!canClearError) return
    dispatch({ type: 'CLEAR_ERROR' })
  }

  const startRenamingChat = (chatId: string, title: string) => {
    if (controlsLocked) return
    setEditingChatId(chatId)
    setEditingTitle(title)
  }

  const cancelRenamingChat = () => {
    setEditingChatId(null)
    setEditingTitle('')
  }

  const confirmRenamingChat = () => {
    if (controlsLocked || !editingChatId) return

    const nextTitle = editingTitle.trim()
    if (nextTitle) {
      dispatch({
        type: 'RENAME_CHAT',
        payload: { chatId: editingChatId, title: nextTitle },
      })
    }

    cancelRenamingChat()
  }

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      confirmRenamingChat()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      cancelRenamingChat()
    }
  }

  const handleDeleteChat = (chatId: string) => {
    if (controlsLocked) return
    dispatch({ type: 'DELETE_CHAT', payload: chatId })
    if (editingChatId === chatId) {
      cancelRenamingChat()
    }
  }

  const updateSetting = (payload: Partial<GenerationDefaults>) => {
    if (controlsLocked) return
    dispatch({ type: 'UPDATE_ACTIVE_CHAT_SETTINGS', payload })
  }

  const applyModePreset = (preset: keyof typeof QWEN_MODE_PRESETS) => {
    if (controlsLocked) return
    updateSetting(QWEN_MODE_PRESETS[preset].settings)
  }

  const toggleThinkBlock = (id: string) => {
    setOpenThinkBlocks((current) => ({
      ...current,
      [id]: !current[id],
    }))
  }

  const handlePresetApply = (presetId: string) => {
    if (controlsLocked) return
    const preset = presetList.find((item) => item.id === presetId)
    if (!preset) return

    dispatch({
      type: 'APPLY_PROMPT_STARTER',
      payload: applyPresetTemplate(preset.template, draft),
    })
  }

  const handleDraftSubmit = () => {
    if (canStop) {
      dispatch({ type: 'STOP_REQUEST' })
      return
    }

    if (!canGenerate) return
    dispatch({ type: 'GENERATION_ENQUEUE', payload: { draftText: draft } })
  }

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleDraftSubmit()
    }
  }

  const handleChatNavKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    const list = event.currentTarget.closest('[data-chat-nav-list]')
    if (!(list instanceof HTMLElement)) return

    let targetIndex: number | null = null

    switch (event.key) {
      case 'ArrowDown':
        targetIndex = Math.min(index + 1, chats.length - 1)
        break
      case 'ArrowUp':
        targetIndex = Math.max(index - 1, 0)
        break
      case 'Home':
        targetIndex = 0
        break
      case 'End':
        targetIndex = chats.length - 1
        break
      default:
        return
    }

    event.preventDefault()
    list
      .querySelector<HTMLButtonElement>(`[data-chat-nav-index="${targetIndex}"]`)
      ?.focus()
  }

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600;1,700&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,500;0,8..60,600;1,8..60,300;1,8..60,400;1,8..60,500&family=Instrument+Sans:wght@400;500;600;700&display=swap');

        .proto3 {
          --p3-bg: #f5f0e8;
          --p3-surface: #ede7db;
          --p3-fg: #1c1915;
          --p3-dim: #7d756a;
          --p3-accent: #bf4a2b;
          --p3-accent-warm: #d4603e;
          --p3-accent2: #2a5e4c;
          --p3-accent2-light: #3a7d66;
          --p3-border: #d4cbbf;
          --p3-border-strong: #b8ad9e;
          --p3-paper: #faf6ef;
          --p3-paper-warm: #f8f2e7;
          --p3-ink: #2a2623;
          --p3-gold: #a68b5b;
          --p3-gold-light: #c9a96e;
          font-family: 'Source Serif 4', Georgia, 'Times New Roman', serif;
        }

        .proto3 .paper-grain {
          position: relative;
        }
        .proto3 .paper-grain::before {
          content: '';
          position: absolute;
          inset: 0;
          opacity: 0.35;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          background-size: 200px 200px;
          mix-blend-mode: multiply;
          z-index: 0;
        }
        .proto3 .paper-grain > * {
          position: relative;
          z-index: 1;
        }

        .proto3 .editorial-header {
          font-family: 'Playfair Display', 'Georgia', serif;
        }
        .proto3 .sans {
          font-family: 'Instrument Sans', -apple-system, 'Helvetica Neue', sans-serif;
        }

        .proto3 .rule-top {
          border-top: 2px solid var(--p3-fg);
          padding-top: 10px;
        }
        .proto3 .rule-thin {
          border-top: 1px solid var(--p3-border);
        }
        .proto3 .rule-accent {
          border-top: 1px solid var(--p3-gold);
        }

        .proto3 .drop-cap::first-letter {
          float: left;
          font-family: 'Playfair Display', serif;
          font-size: 3.6em;
          line-height: 0.78;
          padding-right: 10px;
          padding-top: 5px;
          color: var(--p3-accent);
          font-weight: 800;
          font-style: italic;
        }

        .proto3 .ornament {
          display: flex;
          align-items: center;
          gap: 16px;
          color: #7f6541;
          font-family: 'Playfair Display', serif;
          font-size: 11px;
          font-style: italic;
          letter-spacing: 0.2em;
        }
        .proto3 .ornament::before,
        .proto3 .ornament::after {
          content: '';
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--p3-gold), transparent);
        }

        .proto3 .chat-nav-item {
          padding: 12px 18px;
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          border-left: 3px solid transparent;
          position: relative;
        }
        .proto3 .chat-nav-item::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 18px;
          right: 18px;
          height: 1px;
          background: var(--p3-border);
          opacity: 0.5;
        }
        .proto3 .chat-nav-item:last-child::after {
          display: none;
        }
        .proto3 .chat-nav-item:hover {
          background: linear-gradient(90deg, rgba(191, 74, 43, 0.04), transparent);
          border-left-color: var(--p3-border-strong);
        }
        .proto3 .chat-nav-item.active {
          border-left-color: var(--p3-accent);
          background: linear-gradient(90deg, rgba(191, 74, 43, 0.07), transparent);
        }

        .proto3 .chat-nav-trigger {
          width: 100%;
          padding: 0;
          border: none;
          background: transparent;
          text-align: left;
          cursor: pointer;
          font-family: 'Instrument Sans', sans-serif;
        }

        .proto3 .chat-nav-trigger:focus-visible,
        .proto3 .chat-nav-action:focus-visible,
        .proto3 .chat-nav-inline-action:focus-visible,
        .proto3 .chat-rename-input:focus-visible,
        .proto3 .new-conv-btn:focus-visible,
        .proto3 .model-tab:focus-visible,
        .proto3 .preset-tag:focus-visible,
        .proto3 .slider-editorial:focus-visible,
        .proto3 .mini-btn:focus-visible,
        .proto3 .details-toggle:focus-visible,
        .proto3 .send-editorial:focus-visible,
        .proto3 textarea:focus-visible {
          outline: 2px solid var(--p3-accent);
          outline-offset: 2px;
        }

        .proto3 .chat-nav-item-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .proto3 .chat-nav-meta {
          min-width: 0;
          flex: 1;
        }

        .proto3 .chat-nav-actions {
          display: flex;
          gap: 6px;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .proto3 .chat-nav-item:hover .chat-nav-actions,
        .proto3 .chat-nav-item:focus-visible .chat-nav-actions,
        .proto3 .chat-nav-item:focus-within .chat-nav-actions,
        .proto3 .chat-nav-item.active .chat-nav-actions {
          opacity: 1;
        }

        .proto3 .chat-nav-action,
        .proto3 .chat-nav-inline-action {
          border: 1px solid var(--p3-border);
          background: rgba(250, 246, 239, 0.75);
          color: var(--p3-dim);
          cursor: pointer;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          transition: all 0.2s ease;
        }

        .proto3 .chat-nav-action {
          padding: 5px 8px;
        }

        .proto3 .chat-nav-inline-action {
          padding: 7px 10px;
        }

        .proto3 .chat-nav-action:hover:not(:disabled),
        .proto3 .chat-nav-inline-action:hover:not(:disabled) {
          border-color: var(--p3-accent);
          color: var(--p3-accent);
          background: rgba(191, 74, 43, 0.05);
        }

        .proto3 .chat-nav-action.delete:hover:not(:disabled) {
          border-color: var(--p3-accent);
          color: var(--p3-accent);
        }

        .proto3 .chat-rename-wrap {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .proto3 .chat-rename-input {
          width: 100%;
          border: 1px solid var(--p3-border-strong);
          background: rgba(250, 246, 239, 0.9);
          padding: 10px 12px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 12px;
          line-height: 1.5;
          color: var(--p3-fg);
          outline: none;
        }

        .proto3 .chat-rename-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .proto3 .msg-editorial {
          position: relative;
          opacity: 0;
          transform: translateY(12px);
          animation: msgFadeIn 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        .proto3 .msg-editorial:nth-child(1) { animation-delay: 0.1s; }
        .proto3 .msg-editorial:nth-child(2) { animation-delay: 0.25s; }
        .proto3 .msg-editorial:nth-child(3) { animation-delay: 0.4s; }
        .proto3 .msg-editorial:nth-child(4) { animation-delay: 0.55s; }
        .proto3 .msg-editorial:nth-child(5) { animation-delay: 0.7s; }

        .proto3 .msg-editorial.user-msg {
          padding-left: 24px;
          border-left: 3px solid var(--p3-accent);
        }
        .proto3 .msg-editorial.user-msg::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 80px;
          background: linear-gradient(90deg, rgba(191, 74, 43, 0.03), transparent);
          pointer-events: none;
        }

        .proto3 .msg-editorial.assistant-msg {
          padding-left: 24px;
          border-left: 3px solid var(--p3-accent2);
        }
        .proto3 .msg-editorial.assistant-msg::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 80px;
          background: linear-gradient(90deg, rgba(42, 94, 76, 0.03), transparent);
          pointer-events: none;
        }

        .proto3 .assistant-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .proto3 .assistant-text,
        .proto3 .assistant-think {
          white-space: pre-wrap;
          font-size: 15.5px;
          line-height: 1.8;
          letter-spacing: 0.005em;
          color: var(--p3-ink);
        }

        .proto3 .assistant-think {
          border: 1px solid rgba(166, 139, 91, 0.24);
          background: linear-gradient(90deg, rgba(166, 139, 91, 0.08), rgba(166, 139, 91, 0.02));
          font-size: 14px;
          color: color-mix(in srgb, var(--p3-ink) 88%, white);
          overflow: hidden;
        }

        .proto3 .assistant-think-toggle {
          width: 100%;
          border: none;
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 14px;
          text-align: left;
        }

        .proto3 .assistant-think-toggle:hover {
          background: rgba(166, 139, 91, 0.05);
        }

        .proto3 .assistant-think-header {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--p3-gold);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .proto3 .assistant-think-open {
          color: var(--p3-accent);
        }

        .proto3 .assistant-think-chevron {
          color: var(--p3-gold);
          font-size: 12px;
          line-height: 1;
          transition: transform 0.2s ease;
        }

        .proto3 .assistant-think[data-open='true'] .assistant-think-chevron {
          transform: rotate(180deg);
        }

        .proto3 .assistant-think-content {
          padding: 0 14px 14px;
        }

        @keyframes msgFadeIn {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .proto3 .model-tab {
          padding: 10px 22px;
          border: none;
          background: transparent;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 11.5px;
          font-weight: 500;
          color: var(--p3-dim);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          position: relative;
        }
        .proto3 .model-tab::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 50%;
          width: 0;
          height: 2px;
          background: var(--p3-accent);
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          transform: translateX(-50%);
        }
        .proto3 .model-tab:hover:not(:disabled) {
          color: var(--p3-fg);
        }
        .proto3 .model-tab:hover:not(:disabled)::after {
          width: 60%;
        }
        .proto3 .model-tab.active {
          color: var(--p3-accent);
          font-weight: 600;
        }
        .proto3 .model-tab.active::after {
          width: 100%;
        }

        .proto3 .preset-tag {
          font-family: 'Instrument Sans', sans-serif;
          padding: 5px 14px;
          font-size: 10px;
          font-weight: 600;
          color: var(--p3-dim);
          border: 1px solid var(--p3-border);
          background: transparent;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .proto3 .preset-tag:hover:not(:disabled) {
          border-color: var(--p3-accent);
          color: var(--p3-accent);
          background: rgba(191, 74, 43, 0.04);
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(191, 74, 43, 0.08);
        }

        .proto3 .compose-area {
          border: 1px solid var(--p3-border);
          background: var(--p3-paper);
          padding: 20px;
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          position: relative;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        }
        .proto3 .compose-area::before {
          content: '';
          position: absolute;
          top: -1px;
          left: 30px;
          right: 30px;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--p3-gold-light), transparent);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .proto3 .compose-area:focus-within {
          border-color: var(--p3-accent);
          box-shadow: 0 2px 16px rgba(191, 74, 43, 0.06), 0 1px 3px rgba(0, 0, 0, 0.03);
        }
        .proto3 .compose-area:focus-within::before {
          opacity: 1;
        }

        .proto3 textarea {
          font-family: 'Source Serif 4', Georgia, serif !important;
          color: var(--p3-ink);
          background: transparent !important;
          border: none !important;
          outline: none !important;
          resize: none;
          width: 100%;
          font-size: 15px;
          line-height: 1.8;
        }
        .proto3 textarea::placeholder {
          color: var(--p3-border-strong);
          font-style: italic;
        }

        .proto3 .sys-prompt-input {
          min-height: 132px;
          font-size: 13.5px !important;
          line-height: 1.75 !important;
          color: var(--p3-dim) !important;
          font-style: italic;
        }

        .proto3 .send-editorial {
          font-family: 'Instrument Sans', sans-serif;
          padding: 10px 28px;
          background: var(--p3-accent);
          color: #faf6ef;
          border: none;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          position: relative;
          overflow: hidden;
        }
        .proto3 .send-editorial::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .proto3 .send-editorial:hover:not(:disabled) {
          background: #a83f24;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(191, 74, 43, 0.2);
        }
        .proto3 .send-editorial:hover:not(:disabled)::before {
          opacity: 1;
        }
        .proto3 .send-editorial:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 1px 4px rgba(191, 74, 43, 0.15);
        }

        .proto3 .settings-label {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: var(--p3-dim);
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .proto3 .settings-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--p3-border);
        }

        .proto3 .slider-editorial {
          -webkit-appearance: none;
          appearance: none;
          height: 1px;
          background: linear-gradient(90deg, var(--p3-accent), var(--p3-border));
          outline: none;
          width: 100%;
          transition: background 0.3s;
        }
        .proto3 .slider-editorial::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--p3-accent);
          cursor: pointer;
          border: 2.5px solid var(--p3-paper);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(191, 74, 43, 0.15);
          transition: all 0.2s;
        }
        .proto3 .slider-editorial::-webkit-slider-thumb:hover {
          transform: scale(1.2);
          box-shadow: 0 2px 8px rgba(191, 74, 43, 0.25), 0 0 0 1px rgba(191, 74, 43, 0.2);
        }

        .proto3 ::-webkit-scrollbar { width: 5px; }
        .proto3 ::-webkit-scrollbar-track { background: transparent; }
        .proto3 ::-webkit-scrollbar-thumb {
          background: var(--p3-border);
          border-radius: 3px;
        }
        .proto3 ::-webkit-scrollbar-thumb:hover {
          background: var(--p3-border-strong);
        }

        .proto3 .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
          animation: dotPulse 3s ease-in-out infinite;
        }
        @keyframes dotPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .proto3 .sidebar-enter {
          animation: sideSlide 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        @keyframes sideSlide {
          from { opacity: 0; transform: translateX(-16px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .proto3 .main-enter {
          animation: mainFade 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.15s both;
        }
        @keyframes mainFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .proto3 .right-enter {
          animation: sideSlide 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.25s both;
          transform-origin: right;
        }
        @keyframes rightSlide {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .proto3 .telem-row {
          display: flex;
          justify-content: space-between;
          padding: 7px 0;
          border-bottom: 1px solid var(--p3-border);
          font-size: 11px;
          transition: all 0.2s;
        }
        .proto3 .telem-row:hover {
          padding-left: 4px;
          border-bottom-color: var(--p3-gold);
        }
        .proto3 .telem-row:last-child {
          border-bottom: none;
        }

        .proto3 .new-conv-btn {
          width: 100%;
          padding: 10px;
          border: 1px dashed var(--p3-border);
          background: transparent;
          color: var(--p3-dim);
          font-family: 'Instrument Sans', sans-serif;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .proto3 .new-conv-btn:hover:not(:disabled) {
          border-color: var(--p3-accent);
          color: var(--p3-accent);
          border-style: solid;
          background: rgba(191, 74, 43, 0.03);
        }

        .proto3 .sys-prompt {
          font-size: 13.5px;
          line-height: 1.75;
          color: var(--p3-dim);
          font-style: italic;
          padding: 14px 16px;
          border-left: 2px solid var(--p3-gold);
          background: linear-gradient(90deg, rgba(166, 139, 91, 0.04), transparent);
          position: relative;
        }
        .proto3 .sys-prompt::before {
          content: '"';
          position: absolute;
          top: 4px;
          left: 6px;
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          color: var(--p3-gold-light);
          opacity: 0.5;
          line-height: 1;
        }

        .proto3 .typing-caret {
          display: inline-block;
          width: 2px;
          height: 1em;
          margin-left: 6px;
          background: currentColor;
          vertical-align: middle;
          animation: dotPulse 1s ease-in-out infinite;
        }

        .proto3 .empty-state-note {
          border: 1px dashed var(--p3-border);
          padding: 28px 24px;
          text-align: center;
          background: rgba(250, 246, 239, 0.55);
        }

        .proto3 .status-note {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid var(--p3-border);
        }

        .proto3 .control-cluster {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .proto3 .mini-btn {
          font-family: 'Instrument Sans', sans-serif;
          padding: 7px 12px;
          border: 1px solid var(--p3-border);
          background: transparent;
          color: var(--p3-dim);
          font-size: 9.5px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        .proto3 .mini-btn:hover:not(:disabled) {
          border-color: var(--p3-accent);
          color: var(--p3-accent);
          background: rgba(191, 74, 43, 0.04);
        }

        .proto3 .mini-btn.active {
          border-color: var(--p3-accent2);
          color: var(--p3-accent2);
          background: rgba(42, 94, 76, 0.05);
        }

        .proto3 .mini-btn.wide {
          flex: 1;
        }

        .proto3 .details-toggle {
          width: 100%;
          margin-top: 8px;
          padding: 0;
          border: none;
          background: transparent;
          color: var(--p3-accent2);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .proto3 .details-toggle:hover {
          color: var(--p3-accent);
        }

        .proto3 .details-toggle-chevron {
          font-size: 11px;
          line-height: 1;
          transition: transform 0.2s ease;
        }

        .proto3 .details-toggle[data-open='true'] .details-toggle-chevron {
          transform: rotate(180deg);
        }

        .proto3 .details-panel {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px dashed var(--p3-border);
        }

        .proto3 .details-note {
          margin-top: 10px;
          font-size: 10px;
          line-height: 1.7;
          color: var(--p3-dim);
        }

        .proto3 .support-note {
          margin-top: 10px;
          font-size: 10px;
          line-height: 1.7;
          color: var(--p3-dim);
        }

        .proto3 .status-action {
          margin-top: 10px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .proto3 .showcase-layout {
          display: flex;
          height: 100vh;
        }

        .proto3 .showcase-sidebar,
        .proto3 .showcase-rail {
          flex-shrink: 0;
        }

        .proto3 .showcase-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .proto3 .showcase-topbar {
          gap: 18px;
          flex-wrap: wrap;
        }

        .proto3 .showcase-model-tabs,
        .proto3 .showcase-preset-row,
        .proto3 .showcase-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .proto3 .showcase-model-note {
          margin: 20px auto 0;
          max-width: 700px;
          border: 1px solid var(--p3-border);
          background: rgba(250, 246, 239, 0.72);
          padding: 18px 20px;
        }

        .proto3 .showcase-composer-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-top: 12px;
        }

        @media (prefers-reduced-motion: reduce) {
          .proto3 *,
          .proto3 *::before,
          .proto3 *::after {
            animation: none !important;
            transition: none !important;
            scroll-behavior: auto !important;
          }
        }

        @media (max-width: 1280px) {
          .proto3 .showcase-layout {
            flex-direction: column;
            height: auto;
            min-height: 100vh;
          }

          .proto3 .showcase-main {
            order: 1;
            min-height: 60vh;
          }

          .proto3 .showcase-sidebar {
            order: 2;
            width: auto !important;
            border-right: none !important;
            border-top: 1px solid var(--p3-border);
          }

          .proto3 .showcase-rail {
            order: 3;
            width: auto !important;
            border-left: none !important;
            border-top: 1px solid var(--p3-border);
            animation: none !important;
          }

          .proto3 .sidebar-enter,
          .proto3 .main-enter,
          .proto3 .right-enter {
            animation: none !important;
          }
        }

        @media (max-width: 900px) {
          .proto3 .showcase-topbar {
            padding: 16px 20px !important;
          }

          .proto3 .showcase-content {
            padding: 28px 20px !important;
          }

          .proto3 .showcase-composer-wrap {
            padding: 18px 20px !important;
          }

          .proto3 .showcase-model-tabs,
          .proto3 .showcase-preset-row {
            width: 100%;
            flex-wrap: nowrap;
            overflow-x: auto;
            padding-bottom: 4px;
          }

          .proto3 .showcase-model-note {
            margin-top: 16px;
            padding: 16px;
          }

          .proto3 .showcase-meta {
            gap: 12px;
          }

          .proto3 .model-tab,
          .proto3 .preset-tag {
            white-space: nowrap;
          }

          .proto3 .compose-area {
            padding: 16px;
          }
        }

        .proto3 .new-conv-btn:disabled,
        .proto3 .chat-nav-trigger:disabled,
        .proto3 .model-tab:disabled,
        .proto3 .preset-tag:disabled,
        .proto3 .mini-btn:disabled,
        .proto3 .send-editorial:disabled,
        .proto3 textarea:disabled,
        .proto3 input:disabled {
          opacity: 0.52;
          cursor: not-allowed;
        }
      `}</style>

      <div
        className="proto3"
        data-testid="showcase-page"
        style={{
          background: 'var(--p3-bg)',
          color: 'var(--p3-fg)',
          minHeight: '100vh',
        }}
      >
        <div className="showcase-layout">
          <aside
            className="showcase-sidebar sidebar-enter paper-grain"
            data-testid="chat-sidebar"
            aria-label="Conversation history"
            style={{
              width: '272px',
              borderRight: '1px solid var(--p3-border)',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--p3-paper)',
            }}
          >
            <div style={{ padding: '28px 22px 18px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '6px',
                  marginBottom: '2px',
                }}
              >
                <h1
                  className="editorial-header"
                  style={{
                    fontSize: '26px',
                    fontWeight: 800,
                    lineHeight: 1,
                    color: 'var(--p3-fg)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  LLM
                </h1>
                <span
                  className="editorial-header"
                  style={{
                    fontSize: '26px',
                    fontWeight: 400,
                    fontStyle: 'italic',
                    color: 'var(--p3-accent)',
                    lineHeight: 1,
                  }}
                >
                  Showcase
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '2px',
                  marginTop: '10px',
                  background: 'var(--p3-fg)',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '6px',
                }}
              >
                <span
                  className="sans"
                  style={{
                    fontSize: '8.5px',
                    color: 'var(--p3-dim)',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  Local WebGPU Chat
                </span>
                <span
                  className="sans"
                  style={{
                    fontSize: '8.5px',
                    color: 'var(--p3-gold)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  Browser Native
                </span>
              </div>
            </div>

            <div style={{ padding: '0 16px 14px' }}>
              <button
                type="button"
                className="new-conv-btn"
                onClick={handleNewChat}
                disabled={controlsLocked}
                data-testid="new-chat-button"
                aria-label="Create new conversation"
              >
                + New Conversation
              </button>
            </div>

            <nav
              style={{
                borderTop: '1px solid var(--p3-border)',
                flex: 1,
                overflow: 'auto',
              }}
              data-chat-nav-list
              aria-label="Conversations"
            >
              <div
                className="sans"
                style={{
                  padding: '14px 22px 8px',
                  fontSize: '8.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                  color: 'var(--p3-dim)',
                }}
              >
                Conversations
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {chats.map((chat, index) => {
                  const isActive = chat.id === activeChatId
                  return (
                    <li
                      key={chat.id}
                      className={`chat-nav-item ${isActive ? 'active' : ''}`}
                      style={{ animationDelay: `${0.1 + index * 0.06}s` }}
                      data-testid={`chat-item-${chat.id}`}
                    >
                      {editingChatId === chat.id ? (
                        <div className="chat-rename-wrap">
                          <input
                            ref={renameInputRef}
                            className="chat-rename-input"
                            value={editingTitle}
                            onChange={(event) => setEditingTitle(event.target.value)}
                            onKeyDown={handleRenameKeyDown}
                            onBlur={confirmRenamingChat}
                            aria-label="Rename conversation"
                            placeholder="Conversation title"
                          />
                          <div className="chat-rename-actions">
                            <button
                              type="button"
                              className="chat-nav-inline-action"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={confirmRenamingChat}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="chat-nav-inline-action"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={cancelRenamingChat}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="chat-nav-item-row">
                          <button
                            type="button"
                            className="chat-nav-trigger"
                            onClick={() => handleSelectChat(chat.id)}
                            onKeyDown={(event) => handleChatNavKeyDown(event, index)}
                            disabled={controlsLocked}
                            data-chat-nav-index={index}
                            aria-current={isActive ? 'page' : undefined}
                          >
                            <div className="chat-nav-meta">
                              <div
                                style={{
                                  fontSize: '13px',
                                  fontWeight: isActive ? 600 : 400,
                                  color: isActive ? 'var(--p3-fg)' : 'var(--p3-dim)',
                                  fontFamily: isActive
                                    ? "'Source Serif 4', serif"
                                    : "'Instrument Sans', sans-serif",
                                }}
                              >
                                {chat.title}
                              </div>
                              <div
                                className="sans"
                                style={{
                                  fontSize: '9.5px',
                                  color: 'var(--p3-dim)',
                                  marginTop: '3px',
                                  letterSpacing: '0.03em',
                                }}
                              >
                                {formatConversationDate(chat.updatedAt)}
                              </div>
                            </div>
                          </button>
                          <div className="chat-nav-actions">
                            <button
                              type="button"
                              className="chat-nav-action"
                              onClick={() => startRenamingChat(chat.id, chat.title)}
                              disabled={controlsLocked}
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              className="chat-nav-action delete"
                              onClick={() => handleDeleteChat(chat.id)}
                              disabled={controlsLocked}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </nav>

            <div
              style={{
                borderTop: '1px solid var(--p3-border)',
                padding: '16px 22px',
              }}
            >
              <div
                className="sans"
                style={{
                  fontSize: '8.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                  color: 'var(--p3-dim)',
                  marginBottom: '10px',
                }}
              >
                System Status
              </div>
              <div
                className="sans"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '6px',
                  fontSize: '10px',
                }}
              >
                {systemStatuses.map((item, index) => {
                  const tone = getStatusTone(item.status)
                  return (
                    <div
                      key={item.key}
                      data-testid={item.testId}
                      aria-live="polite"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: 'var(--p3-dim)',
                      }}
                    >
                      <span
                        className="status-dot"
                        style={{
                          background: tone.background,
                          boxShadow: tone.shadow,
                          animationDelay: `${index * 0.35}s`,
                        }}
                      />
                      <span style={{ letterSpacing: '0.02em' }}>{item.key}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '9px' }}>{item.value}</span>
                    </div>
                  )
                })}
              </div>
              <div className="status-note sans" aria-live={currentError ? 'assertive' : 'polite'}>
                <div
                  style={{
                    fontSize: '10px',
                    color: currentError ? 'var(--p3-accent)' : 'var(--p3-dim)',
                    lineHeight: 1.6,
                    letterSpacing: '0.02em',
                  }}
                >
                  {liveStatusMessage}
                </div>
                {isLoading && (
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '9px',
                      color: 'var(--p3-gold)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {loadStatus || 'Loading'} · {Math.round(loadProgress)}%
                  </div>
                )}
                {canClearError && (
                  <div className="status-action">
                    <button
                      type="button"
                      className="mini-btn"
                      onClick={handleClearError}
                    >
                      Clear Error
                    </button>
                  </div>
                )}
              </div>
            </div>
          </aside>

          <main
            className="showcase-main main-enter"
            data-testid="chat-main"
            style={{
              background: 'var(--p3-bg)',
            }}
          >
            <div
              className="showcase-topbar"
              style={{
                borderBottom: '2px solid var(--p3-fg)',
                padding: '0 36px',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                background:
                  'linear-gradient(180deg, var(--p3-paper-warm), var(--p3-bg))',
              }}
            >
              <div
                className="showcase-model-tabs"
                role="tablist"
                aria-label="Model selection"
              >
                {modelList.map((model) => (
                  <button
                    type="button"
                    key={model.id}
                    className={`model-tab ${selectedModelId === model.id ? 'active' : ''}`}
                    onClick={() => handleModelSelect(model.id)}
                    disabled={controlsLocked}
                    role="tab"
                    aria-selected={selectedModelId === model.id}
                    data-testid={`model-card-${model.id.replaceAll('.', '_')}`}
                  >
                    {model.label.replace('Qwen 3.5 ', '')}
                  </button>
                ))}
              </div>
              <div className="showcase-preset-row" style={{ paddingBottom: '10px' }}>
                {PROTOTYPE_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.id}
                    className="preset-tag"
                    onClick={() => handlePresetApply(preset.id)}
                    disabled={controlsLocked}
                    data-testid={`preset-${preset.id}`}
                    aria-label={`Apply ${preset.label} prompt preset`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="showcase-model-note paper-grain" data-testid="selected-model-card">
              <div
                className="sans"
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.16em',
                  color: 'var(--p3-dim)',
                  marginBottom: '10px',
                }}
              >
                Selected model
              </div>
              <div
                className="editorial-header"
                style={{ fontSize: '20px', fontStyle: 'italic', color: 'var(--p3-fg)' }}
              >
                {selectedModel.label}
              </div>
              <div style={{ marginTop: '8px', fontSize: '14px', lineHeight: 1.75, color: 'var(--p3-ink)' }}>
                {selectedModel.description}
              </div>
              <div className="showcase-meta sans" style={{ marginTop: '12px', fontSize: '10px', color: 'var(--p3-dim)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                <span>{selectedModel.recommendedFor}</span>
                <span>{selectedModel.memoryNote}</span>
              </div>
              {selectedModel.warning && (
                <div
                  data-testid="model-warning"
                  style={{
                    marginTop: '12px',
                    borderLeft: '2px solid var(--p3-accent)',
                    paddingLeft: '12px',
                    fontSize: '12px',
                    lineHeight: 1.7,
                    color: 'var(--p3-accent)',
                  }}
                >
                  {selectedModel.warning}
                </div>
              )}
            </div>

            <div
              className="showcase-content"
              data-testid="chat-thread"
              aria-live="polite"
              style={{ flex: 1, overflow: 'auto', padding: '40px 36px' }}
            >
              <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                <div className="ornament" style={{ marginBottom: '36px' }}>
                  {activeChatTitle || 'Conversation'}
                </div>

                {messages.length === 0 ? (
                  <div className="empty-state-note" data-testid="chat-empty-state">
                    <div
                      className="editorial-header"
                      style={{
                        fontSize: '24px',
                        fontStyle: 'italic',
                        color: 'var(--p3-accent)',
                        marginBottom: '10px',
                      }}
                    >
                      Start a local conversation.
                    </div>
                    <div
                      style={{
                        fontSize: '15px',
                        lineHeight: 1.8,
                        color: 'var(--p3-ink)',
                      }}
                    >
                      Choose a model, tune the inference settings, and begin writing below. Everything stays in your browser.
                    </div>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const isUser = message.role === 'user'
                    const isStreaming =
                      message.id === activeAssistantMessageId && isGenerating
                    const isInterrupted =
                      message.role === 'assistant' && message.status === 'interrupted'
                    const showDropCap = !isUser && index === 1
                    const content =
                      isStreaming && message.content.length === 0
                        ? 'Generating…'
                        : message.content
                    const assistantSegments = isUser ? [] : parseAssistantContent(content)

                    return (
                      <div
                        key={message.id}
                        className={`msg-editorial ${isUser ? 'user-msg' : 'assistant-msg'}`}
                        style={{ marginBottom: '32px' }}
                        data-testid={isUser ? 'message-user' : 'message-assistant'}
                      >
                        <div
                          className="sans"
                          style={{
                            fontSize: '8.5px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.18em',
                            color: isUser
                              ? 'var(--p3-accent)'
                              : 'var(--p3-accent2)',
                            marginBottom: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <span>{isUser ? 'You' : 'Assistant'}</span>
                          <span
                            style={{
                              width: '16px',
                              height: '1px',
                              background: isUser
                                ? 'var(--p3-accent)'
                                : 'var(--p3-accent2)',
                              opacity: 0.4,
                            }}
                          />
                          <span style={{ opacity: 0.5, fontWeight: 500 }}>
                            No. {String(index + 1).padStart(2, '0')}
                          </span>
                          {isInterrupted && (
                            <span
                              data-testid="message-interrupted"
                              style={{ opacity: 0.7, fontStyle: 'italic' }}
                            >
                              Interrupted
                            </span>
                          )}
                        </div>
                        {isUser ? (
                          <div
                            className={showDropCap ? 'drop-cap' : ''}
                            style={{
                              fontSize: '15.5px',
                              lineHeight: '1.8',
                              color: 'var(--p3-ink)',
                              letterSpacing: '0.005em',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {content}
                          </div>
                        ) : (
                          <div className="assistant-body">
                            {assistantSegments.length === 0 ? (
                              <div className={showDropCap ? 'assistant-text drop-cap' : 'assistant-text'}>
                                {content}
                                {isStreaming && message.content.length > 0 && <span className="typing-caret" />}
                              </div>
                            ) : (
                              assistantSegments.map((segment, segmentIndex) => {
                                if (segment.kind === 'think') {
                                  const thinkBlockId = `${message.id}-segment-${segmentIndex}`
                                  const isOpen = openThinkBlocks[thinkBlockId] ?? false

                                  return (
                                    <section
                                      key={thinkBlockId}
                                      className="assistant-think"
                                      data-testid="message-think-block"
                                      data-open={isOpen ? 'true' : 'false'}
                                      aria-label="Assistant reasoning block"
                                    >
                                      <button
                                        type="button"
                                        className="assistant-think-toggle"
                                        aria-expanded={isOpen}
                                        aria-controls={`${thinkBlockId}-content`}
                                        onClick={() => toggleThinkBlock(thinkBlockId)}
                                      >
                                        <span className="assistant-think-header sans">
                                          <span>Thinking</span>
                                          {segment.open && (
                                            <span className="assistant-think-open">Streaming</span>
                                          )}
                                        </span>
                                        <span className="assistant-think-chevron" aria-hidden="true">
                                          ▾
                                        </span>
                                      </button>
                                      {isOpen && (
                                        <div
                                          id={`${thinkBlockId}-content`}
                                          className="assistant-think-content"
                                        >
                                          <div>{segment.content}</div>
                                          {segment.open && isStreaming && message.content.length > 0 && (
                                            <span className="typing-caret" />
                                          )}
                                        </div>
                                      )}
                                    </section>
                                  )
                                }

                                return (
                                  <div
                                    key={`${message.id}-segment-${segmentIndex}`}
                                    className={
                                      showDropCap && segmentIndex === 0
                                        ? 'assistant-text drop-cap'
                                        : 'assistant-text'
                                    }
                                  >
                                    {segment.content}
                                    {segmentIndex === assistantSegments.length - 1 &&
                                      isStreaming &&
                                      message.content.length > 0 && <span className="typing-caret" />}
                                  </div>
                                )
                              })
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}

                <div ref={bottomRef} />

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginTop: '24px',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: '1px',
                      background:
                        'linear-gradient(90deg, transparent, var(--p3-border-strong))',
                    }}
                  />
                  <span
                    className="editorial-header"
                    style={{
                      fontSize: '16px',
                      color: 'var(--p3-gold)',
                      fontStyle: 'italic',
                      opacity: 0.7,
                    }}
                  >
                    ❧
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: '1px',
                      background:
                        'linear-gradient(90deg, var(--p3-border-strong), transparent)',
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              className="showcase-composer-wrap"
              style={{
                borderTop: '1px solid var(--p3-border)',
                padding: '24px 36px',
                background:
                  'linear-gradient(180deg, var(--p3-bg), var(--p3-paper-warm))',
              }}
            >
              <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                <div className="compose-area" data-testid="chat-composer">
                  <textarea
                    ref={draftTextareaRef}
                    data-testid="chat-draft-input"
                    value={draft}
                    onChange={(event) =>
                      dispatch({
                        type: 'SET_ACTIVE_CHAT_DRAFT',
                        payload: event.target.value,
                      })
                    }
                    onKeyDown={handleDraftKeyDown}
                    placeholder="Begin writing…"
                    rows={3}
                    disabled={!isHydrated || isGenerating}
                    aria-label="Message draft"
                  />
                </div>
                <div className="showcase-composer-meta">
                  <div className="showcase-meta">
                    <span
                      className="sans"
                      style={{
                        fontSize: '10.5px',
                        color: 'var(--p3-dim)',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {draft.length} characters
                    </span>
                    {wordCount > 0 && (
                      <span
                        className="sans"
                        style={{
                          fontSize: '10.5px',
                          color: 'var(--p3-gold)',
                          letterSpacing: '0.03em',
                          fontStyle: 'italic',
                        }}
                      >
                        ~{wordCount} words
                      </span>
                    )}
                    <span
                      className="sans"
                      style={{
                        fontSize: '10.5px',
                        color: 'var(--p3-dim)',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {isGenerating
                        ? 'Generating…'
                        : isLoading
                          ? loadStatus || 'Preparing…'
                          : formatRuntimeLabel(runtimePhase)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="send-editorial"
                    onClick={handleDraftSubmit}
                    disabled={(!canGenerate && !canStop) || (!canStop && isLoading)}
                    data-testid={canStop ? 'chat-stop-button' : 'chat-send-button'}
                    aria-label={canStop ? 'Stop generation' : 'Send message'}
                  >
                    {canStop ? 'Stop' : isLoading ? 'Preparing…' : 'Publish →'}
                  </button>
                </div>
              </div>
            </div>
          </main>

          <aside
            className="showcase-rail right-enter paper-grain"
            data-testid="chat-settings-rail"
            aria-label="Inference controls and telemetry"
            style={{
              width: '300px',
              borderLeft: '1px solid var(--p3-border)',
              overflow: 'auto',
              padding: '28px 22px',
              background: 'var(--p3-paper)',
              animation:
                'rightSlide 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.25s both',
            }}
          >
            <div
              className="rule-top"
              style={{ marginBottom: '24px' }}
              data-testid="inference-settings-panel"
            >
              <span className="settings-label">Inference Settings</span>
              <div style={{ marginBottom: '18px' }}>
                <div
                  className="sans"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '7px',
                    fontSize: '11.5px',
                  }}
                >
                  <span style={{ color: 'var(--p3-dim)', letterSpacing: '0.02em' }}>Mode</span>
                  <span
                    style={{
                      fontFamily: "'Source Serif 4', serif",
                      color: 'var(--p3-fg)',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                  >
                    {inferenceModeLabel}
                  </span>
                </div>
                <div className="control-cluster">
                  <button
                    type="button"
                    className={`mini-btn ${directPresetActive ? 'active' : ''}`}
                    onClick={() => applyModePreset('direct')}
                    disabled={controlsLocked || directPresetActive}
                  >
                    Direct
                  </button>
                  <button
                    type="button"
                    className={`mini-btn ${thinkingPresetActive ? 'active' : ''}`}
                    onClick={() => applyModePreset('thinking')}
                    disabled={controlsLocked || thinkingPresetActive || !thinkingSupported}
                  >
                    Thinking
                  </button>
                </div>
                {!thinkingSupported && (
                  <div className="support-note sans" data-testid="thinking-unsupported-note">
                    This model stays in direct mode. Use Qwen 3.5 2B or 4B for reasoning blocks.
                  </div>
                )}
              </div>
              {INFERENCE_SLIDERS.map((slider) => (
                <div key={slider.key} style={{ marginBottom: '16px' }}>
                  <div
                    className="sans"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '7px',
                      fontSize: '11.5px',
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--p3-dim)',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {slider.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "'Source Serif 4', serif",
                        color: 'var(--p3-fg)',
                        fontSize: '12px',
                        fontWeight: 500,
                      }}
                    >
                      {slider.format(inferenceSettings[slider.key])}
                    </span>
                  </div>
                  <input
                    type="range"
                    className="slider-editorial"
                    aria-label={slider.label}
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={inferenceSettings[slider.key]}
                    disabled={controlsLocked}
                    onChange={(event) =>
                      updateSetting({
                        [slider.key]: Number.parseFloat(event.target.value),
                      })
                    }
                  />
                </div>
              ))}
              <button
                type="button"
                className="details-toggle"
                data-open={advancedInferenceOpen ? 'true' : 'false'}
                data-testid="inference-advanced-toggle"
                aria-expanded={advancedInferenceOpen}
                aria-controls="inference-advanced-panel"
                onClick={() => setAdvancedInferenceOpen((current) => !current)}
              >
                <span>{advancedInferenceOpen ? 'Hide detailed inference' : 'Show detailed inference'}</span>
                <span className="details-toggle-chevron" aria-hidden="true">
                  ▾
                </span>
              </button>
              {advancedInferenceOpen && (
                <div id="inference-advanced-panel" className="details-panel">
                  {ADVANCED_INFERENCE_SLIDERS.map((slider) => (
                    <div key={slider.key} style={{ marginBottom: '16px' }}>
                      <div
                        className="sans"
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '7px',
                          fontSize: '11.5px',
                        }}
                      >
                        <span
                          style={{
                            color: 'var(--p3-dim)',
                            letterSpacing: '0.02em',
                          }}
                        >
                          {slider.label}
                        </span>
                        <span
                          style={{
                            fontFamily: "'Source Serif 4', serif",
                            color: 'var(--p3-fg)',
                            fontSize: '12px',
                            fontWeight: 500,
                          }}
                        >
                          {slider.format(inferenceSettings[slider.key])}
                        </span>
                      </div>
                      <input
                        type="range"
                        className="slider-editorial"
                        aria-label={slider.label}
                        min={slider.min}
                        max={slider.max}
                        step={slider.step}
                        value={inferenceSettings[slider.key]}
                        disabled={controlsLocked}
                        onChange={(event) =>
                          updateSetting({
                            [slider.key]: Number.parseFloat(event.target.value),
                          })
                        }
                      />
                    </div>
                  ))}
                  <div style={{ marginBottom: '16px' }}>
                    <div
                      className="sans"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '7px',
                        fontSize: '11.5px',
                      }}
                    >
                      <span
                        style={{
                          color: 'var(--p3-dim)',
                          letterSpacing: '0.02em',
                        }}
                      >
                        Do Sample
                      </span>
                      <span
                        style={{
                          fontFamily: "'Source Serif 4', serif",
                          color: 'var(--p3-fg)',
                          fontSize: '12px',
                          fontWeight: 500,
                        }}
                      >
                        {inferenceSettings.doSample ? 'On' : 'Off'}
                      </span>
                    </div>
                    <div className="control-cluster">
                      <button
                        type="button"
                        className={`mini-btn ${inferenceSettings.doSample ? 'active' : ''}`}
                        onClick={() => updateSetting({ doSample: true })}
                        disabled={controlsLocked || inferenceSettings.doSample}
                      >
                        Enabled
                      </button>
                      <button
                        type="button"
                        className={`mini-btn ${!inferenceSettings.doSample ? 'active' : ''}`}
                        onClick={() => updateSetting({ doSample: false })}
                        disabled={controlsLocked || !inferenceSettings.doSample}
                      >
                        Disabled
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="control-cluster">
                <button
                  type="button"
                  className="mini-btn wide"
                  onClick={() => dispatch({ type: 'RESET_ACTIVE_CHAT_SETTINGS_TO_DEFAULTS' })}
                  disabled={controlsLocked}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="mini-btn wide"
                  onClick={() => dispatch({ type: 'SAVE_ACTIVE_CHAT_SETTINGS_AS_DEFAULTS' })}
                  disabled={controlsLocked}
                >
                  Save Default
                </button>
              </div>
            </div>

            <div
              className="rule-accent"
              style={{ paddingTop: '18px', marginBottom: '24px' }}
              data-testid="system-prompt-panel"
            >
              <span className="settings-label">System Prompt</span>
              <div className="sys-prompt">
                <textarea
                  className="sys-prompt-input"
                  value={systemPrompt}
                  onChange={(event) =>
                    dispatch({
                      type: 'SET_ACTIVE_CHAT_SYSTEM_PROMPT',
                      payload: event.target.value,
                    })
                  }
                  disabled={controlsLocked}
                  aria-label="System prompt"
                />
              </div>
            </div>

            <div
              className="rule-accent"
              style={{ paddingTop: '18px', marginBottom: '24px' }}
              data-testid="context-window-panel"
            >
              <span className="settings-label">Context Window</span>
              <div
                style={{
                  border: '1px solid var(--p3-border)',
                  background: 'rgba(250, 246, 239, 0.82)',
                  padding: '18px 16px',
                  boxShadow: `0 8px 24px ${contextTone.glow}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    marginBottom: '14px',
                  }}
                >
                  <div
                    role="progressbar"
                    aria-label="Approximate context window usage"
                    aria-valuemin={0}
                    aria-valuemax={selectedModel.contextWindowTokens}
                    aria-valuenow={Math.min(contextEstimate.usedTokens, selectedModel.contextWindowTokens)}
                    aria-valuetext={`${formatTokenCount(contextEstimate.usedTokens)} of ${formatTokenCount(selectedModel.contextWindowTokens)} tokens used`}
                    data-testid="context-window-meter"
                    style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}
                  >
                    <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
                      <circle
                        cx="60"
                        cy="60"
                        r={contextRingRadius}
                        fill="none"
                        stroke="rgba(28, 25, 21, 0.08)"
                        strokeWidth="8"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r={contextRingRadius}
                        fill="none"
                        stroke={contextTone.stroke}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={contextRingCircumference}
                        strokeDashoffset={contextRingOffset}
                        transform="rotate(-90 60 60)"
                      />
                    </svg>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                      }}
                    >
                      <span
                        className="sans"
                        style={{
                          fontSize: '10px',
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: 'var(--p3-dim)',
                        }}
                      >
                        Used
                      </span>
                      <span
                        className="editorial-header"
                        style={{ fontSize: '26px', lineHeight: 1, color: contextTone.accent }}
                      >
                        {contextUsagePercent}%
                      </span>
                      <span
                        className="sans"
                        style={{ fontSize: '10px', color: 'var(--p3-dim)', letterSpacing: '0.04em' }}
                      >
                        approx.
                      </span>
                    </div>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      className="editorial-header"
                      style={{ fontSize: '18px', fontStyle: 'italic', color: 'var(--p3-fg)' }}
                    >
                      {formatTokenCount(contextEstimate.usedTokens)} / {formatTokenCount(selectedModel.contextWindowTokens)} tokens
                    </div>
                    <div
                      className="sans"
                      style={{
                        marginTop: '8px',
                        fontSize: '10px',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'var(--p3-dim)',
                      }}
                    >
                      {formatTokenCount(contextEstimate.remainingTokens)} tokens remaining
                    </div>
                  </div>
                </div>

                {contextSummaryRows.map((item) => (
                  <div key={item.key} className="telem-row sans">
                    <span style={{ color: 'var(--p3-dim)', letterSpacing: '0.02em' }}>{item.key}</span>
                    <span style={{ fontFamily: "'Source Serif 4', serif", fontSize: '11px', fontWeight: 500 }}>
                      {item.value}
                    </span>
                  </div>
                ))}
                <button
                  type="button"
                  className="details-toggle"
                  data-open={contextDetailsOpen ? 'true' : 'false'}
                  data-testid="context-window-details-toggle"
                  aria-expanded={contextDetailsOpen}
                  aria-controls="context-window-details-panel"
                  onClick={() => setContextDetailsOpen((current) => !current)}
                >
                  <span>{contextDetailsOpen ? 'Hide details' : 'Show details'}</span>
                  <span className="details-toggle-chevron" aria-hidden="true">
                    ▾
                  </span>
                </button>
                {contextDetailsOpen && (
                  <div id="context-window-details-panel" className="details-panel">
                    {contextDetailRows.map((item) => (
                      <div key={item.key} className="telem-row sans">
                        <span style={{ color: 'var(--p3-dim)', letterSpacing: '0.02em' }}>{item.key}</span>
                        <span style={{ fontFamily: "'Source Serif 4', serif", fontSize: '11px', fontWeight: 500 }}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                    <div className="details-note sans">
                      Native Qwen 3.5 context limit shown here is 262K tokens across the in-browser 0.8B, 2B, and 4B variants.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div
              className="rule-thin"
              style={{ paddingTop: '18px', marginBottom: '24px' }}
              data-testid="telemetry-panel"
            >
              <span className="settings-label">Telemetry</span>
              {telemetrySummaryRows.map((item) => (
                <div
                  key={item.key}
                  className="telem-row sans"
                  data-testid={item.testId}
                >
                  <span style={{ color: 'var(--p3-dim)', letterSpacing: '0.02em' }}>
                    {item.key}
                  </span>
                  <span
                    style={{
                      fontFamily: "'Source Serif 4', serif",
                      fontSize: '11px',
                      fontWeight: 500,
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
              <button
                type="button"
                className="details-toggle"
                data-open={telemetryDetailsOpen ? 'true' : 'false'}
                data-testid="telemetry-details-toggle"
                aria-expanded={telemetryDetailsOpen}
                aria-controls="telemetry-details-panel"
                onClick={() => setTelemetryDetailsOpen((current) => !current)}
              >
                <span>{telemetryDetailsOpen ? 'Hide details' : 'Show details'}</span>
                <span className="details-toggle-chevron" aria-hidden="true">
                  ▾
                </span>
              </button>
              {telemetryDetailsOpen && (
                <div id="telemetry-details-panel" className="details-panel">
                  {telemetryDetailRows.map((item) => (
                    <div key={item.key} className="telem-row sans">
                      <span style={{ color: 'var(--p3-dim)', letterSpacing: '0.02em' }}>
                        {item.key}
                      </span>
                      <span
                        style={{
                          fontFamily: "'Source Serif 4', serif",
                          fontSize: '11px',
                          fontWeight: 500,
                        }}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rule-thin" style={{ paddingTop: '18px' }}>
              <span className="settings-label">Colophon</span>
              <div
                style={{
                  fontSize: '11px',
                  lineHeight: '1.8',
                  color: 'var(--p3-dim)',
                  fontStyle: 'italic',
                }}
              >
                LLM Showcase
                <br />
                Local-first inference via WebGPU
                <br />
                Powered by Hugging Face Transformers.js
                <br />
                <span
                  style={{
                    color: 'var(--p3-gold)',
                    fontSize: '10px',
                    letterSpacing: '0.05em',
                  }}
                >
                  {telemetry.heuristicMemoryNote}
                </span>
              </div>
              <div
                className="sans"
                style={{
                  marginTop: '12px',
                  fontSize: '10px',
                  lineHeight: 1.7,
                  color: currentError ? 'var(--p3-accent)' : 'var(--p3-dim)',
                }}
              >
                {currentError ?? statusMessage}
              </div>
              {canClearError && (
                <div className="status-action">
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={handleClearError}
                  >
                    Retry Current Model
                  </button>
                </div>
              )}
              <div
                style={{
                  marginTop: '14px',
                  textAlign: 'center',
                  color: 'var(--p3-gold)',
                  fontSize: '14px',
                  opacity: 0.6,
                }}
              >
                ✦
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}

export default function ShowcasePageClient() {
  return (
    <ShowcaseProvider>
      <RuntimeInitializer />
      <ShowcaseShell />
    </ShowcaseProvider>
  )
}
