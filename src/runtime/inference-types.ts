/**
 * Runtime Phase Union
 * Represents all possible states of the inference runtime
 */
export type RuntimePhase =
  | 'idle'
  | 'probing'
  | 'unsupported'
  | 'loading_model'
  | 'warming_model'
  | 'ready'
  | 'generating'
  | 'stopping'
  | 'error'

/**
 * Warm State
 * Indicates whether a model has been loaded and warmed in the current session
 */
export type WarmState = 'cold' | 'warm'

/**
 * Model Tier
 * Stability classification for model support
 */
export type ModelTier = 'stable' | 'experimental'

/**
 * Quantization dtype settings for model loading
 */
export interface ModelDtype {
  embed_tokens: 'q4' | 'fp16'
  vision_encoder: 'q4' | 'fp16'
  decoder_model_merged: 'q4' | 'fp16'
}

/**
 * Default generation parameters
 */
export interface GenerationDefaults {
  doSample: boolean
  enableThinking: boolean
  temperature: number
  topP: number
  topK: number
  minP: number
  presencePenalty: number
  repetitionPenalty: number
  maxNewTokens: number
}

/**
 * Chat message format for inference requests
 */
export interface InferenceChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Model Configuration
 * Complete metadata for a loadable Qwen model
 */
export interface ModelConfig {
  id: string
  label: string
  repoId: string
  tier: ModelTier
  supportsThinking: boolean
  description: string
  warning?: string
  contextWindowTokens: number
  memoryNote: string
  recommendedFor: string
  dtype: ModelDtype
  generationDefaults: GenerationDefaults
}

/**
 * Capability Probe Result
 * WebGPU device capabilities detected during probing
 */
export interface CapabilityProbeResult {
  webgpuAvailable: boolean
  adapterInfo: string | null
  shaderF16Support: boolean
  maxBufferSize: number | null
  maxStorageBufferBindingSize: number | null
  errorMessage?: string
}

/**
 * Telemetry Snapshot
 * Runtime state snapshot for the debug panel
 */
export interface TelemetrySnapshot {
  selectedModelLabel: string
  selectedModelRepoId: string
  supportTier: ModelTier
  runtimeLibrary: string
  backend: string
  runtimePhase: RuntimePhase
  warmState: WarmState
  shaderF16Support: boolean
  maxBufferSize: string
  maxStorageBufferBindingSize: string
  loadDurationMs: number | null
  warmupDurationMs: number | null
  generationDurationMs: number | null
  approxTokenCount: number
  approxTokensPerSecond: number | null
  heuristicMemoryNote: string
  lastError: string | null
}

// ============================================================================
// Worker Request Types (main thread -> worker)
// ============================================================================

export interface ProbeRequest {
  type: 'probe'
}

export interface LoadModelRequest {
  type: 'load_model'
  requestId: string
  modelId: string
}

export interface GenerateRequest {
  type: 'generate'
  requestId: string
  modelId: string
  messages: InferenceChatMessage[]
  settings: GenerationDefaults
}

export interface InterruptRequest {
  type: 'interrupt'
  requestId: string
  modelId: string
}

export interface DisposeModelRequest {
  type: 'dispose_model'
  requestId: string
  modelId: string
}

export interface ResetSessionRequest {
  type: 'reset_session'
  requestId: string
  modelId: string
}

/**
 * Discriminated union for all worker requests
 */
export type WorkerRequest =
  | ProbeRequest
  | LoadModelRequest
  | GenerateRequest
  | InterruptRequest
  | DisposeModelRequest
  | ResetSessionRequest

// ============================================================================
// Worker Event Types (worker -> main thread)
// ============================================================================

export interface ProbeResultEvent {
  type: 'probe_result'
  result: CapabilityProbeResult
}

export interface LoadStartedEvent {
  type: 'load_started'
  requestId: string
  modelId: string
}

export interface LoadProgressEvent {
  type: 'load_progress'
  requestId: string
  modelId: string
  progress: number
  status: string
}

export interface WarmingStartedEvent {
  type: 'warming_started'
  requestId: string
  modelId: string
}

export interface ModelReadyEvent {
  type: 'model_ready'
  requestId: string
  modelId: string
}

export interface GenerationStartedEvent {
  type: 'generation_started'
  requestId: string
  modelId: string
}

export interface StreamDeltaEvent {
  type: 'stream_delta'
  requestId: string
  modelId: string
  token: string
}

export interface GenerationCompleteEvent {
  type: 'generation_complete'
  requestId: string
  modelId: string
}

export interface GenerationInterruptedEvent {
  type: 'generation_interrupted'
  requestId: string
  modelId: string
}

export interface RuntimeErrorEvent {
  type: 'runtime_error'
  requestId: string
  modelId: string
  error: string
  phase: RuntimePhase
}

/**
 * Discriminated union for all worker events
 */
export type WorkerEvent =
  | ProbeResultEvent
  | LoadStartedEvent
  | LoadProgressEvent
  | WarmingStartedEvent
  | ModelReadyEvent
  | GenerationStartedEvent
  | StreamDeltaEvent
  | GenerationCompleteEvent
  | GenerationInterruptedEvent
  | RuntimeErrorEvent

// ============================================================================
// Result Types
// ============================================================================

/**
 * Model Load Result
 * Outcome of a model load attempt
 */
export interface ModelLoadResult {
  success: boolean
  modelId: string
  loadDurationMs?: number
  warmupDurationMs?: number
  error?: string
}

/**
 * Generation Result
 * Outcome of a generation request
 */
export interface GenerationResult {
  success: boolean
  modelId: string
  output: string
  tokenCount: number
  durationMs: number
  interrupted: boolean
  error?: string
}
