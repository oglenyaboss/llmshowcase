# Learnings

## [2026-03-14] Task 1: Scaffold Vite Foundation
- Greenfield repo — no migration constraints
- Stack: Vite + React + TypeScript + Tailwind v4
- npm as package manager
- `npm create vite@latest` cancels in this repo because the pre-existing `.sisyphus/` directory makes the root non-empty, so Task 1 was scaffolded manually while preserving the exact Vite/React/TS contract.
- `vite.config.ts` uses `defineConfig` from `vitest/config` so one config file can type-check both Vite options and the embedded Vitest `test` block.
- `worker: { format: "es" }` was added and the project is aligned to Vite's recommended module-worker pattern (`new Worker(new URL(...), { type: "module" })`) for future runtime tasks.
- `tsconfig.node.json` must include `tests/e2e/**/*.ts` so ESLint with project-aware TypeScript parsing can lint Playwright specs without parser project errors.
- Minimal placeholder files were created at the exact planned paths so `vitest` and `playwright` scripts are executable from the foundation task instead of failing on an empty tree.

## [2026-03-14] Task 3: Runtime Type Contracts

### Created Files
- `src/runtime/inference-types.ts` - All runtime types, worker protocol types, result types
- `src/config/models.ts` - Three Qwen model entries with helper functions
- `src/config/presets.ts` - Four preset templates with applyPresetTemplate helper

### Key Types Defined
- `RuntimePhase` - 9 phases: idle, probing, unsupported, loading_model, warming_model, ready, generating, stopping, error
- `WarmState` - 'cold' | 'warm'
- `ModelTier` - 'stable' | 'experimental'
- `ModelConfig` - Complete model metadata interface
- `CapabilityProbeResult` - WebGPU capability detection result
- `TelemetrySnapshot` - Debug panel state snapshot
- `WorkerRequest` - Discriminated union for main→worker messages
- `WorkerEvent` - Discriminated union for worker→main events

### Worker Protocol Design
- Every request after probe includes requestId and modelId
- Every event after probe_result echoes requestId and modelId
- ModelManager must ignore stale events by requestId

### Model Registry
- IDs: `qwen-0.8b`, `qwen-2b`, `qwen-4b`
- 0.8B and 2B are stable, 4B is experimental with warning
- Default dtype: q4 for all components
- Generation defaults: doSample=true, temp=0.7, topP=0.8, topK=20, repPenalty=1.05, maxNewTokens=256

### Preset Templates
1. Summarize - 3 bullet points
2. Explain code - functionality and risks
3. Rewrite text - clearer and professional
4. Extract JSON - structured data extraction

## [2026-03-14] Task 4: Pure Capability and Telemetry Helpers

### Created Files
- `src/lib/format.ts` - Formatting utilities for bytes, duration, tokens
- `src/runtime/capability.ts` - Capability probe result formatting and support detection
- `src/runtime/telemetry.ts` - Telemetry snapshot creation and updates
- `src/test/runtime/capability.test.ts` - 15 test cases for capability helpers
- `src/test/runtime/telemetry.test.ts` - 25 test cases for telemetry helpers

### Key Design Decisions
- `formatBytes()` returns 'N/A' for null, shows 0 decimals for whole numbers (4 GB, not 4.0 GB)
- `isLikelyCapable()` uses heuristic: maxBufferSize * 4 = estimated VRAM, with 20% margin
- Telemetry functions return new objects (immutable pattern) - never mutate input
- All helpers are pure functions with no browser API dependencies

### Test Coverage
- No WebGPU case, adapter null case, probe success formatting
- Support messages for unsupported browser and adapter unavailable
- Default telemetry state, zero-token throughput, byte formatting for limits
- Duration formatting, phase transitions, generation updates

## [2026-03-14] Task 5: Reducer-Driven App State

### Created Files
- `src/state/showcase-reducer.ts` - Central reducer with 17 action types
- `src/state/showcase-selectors.ts` - 20 selector functions (11 base + 9 derived)
- `src/state/showcase-context.tsx` - React context provider with hooks
- `src/test/state/showcase-reducer.test.ts` - 41 test cases

### State Machine Rules Enforced
1. Generation can only start from `ready` phase with non-empty prompt
2. Model switch resets warm state to `cold` and clears output/timings
3. Stop request moves phase to `stopping` before interrupt result
4. Interrupted generation ends in `ready` (not `error`)
5. Clear error only works from `error` phase (transitions to `idle` or `ready` based on warm state)
6. Generate from `unsupported` state is blocked

### Action Types
Discriminated union with 17 actions covering:
- Probe lifecycle (start/success/failure)
- Model selection and switch
- Load lifecycle (start/progress/ready/warmup)
- Prompt/preset management
- Generation lifecycle (start/stream/complete/interrupt)
- Error handling and telemetry updates

### Selector Patterns
- Base selectors: Direct property access
- Derived selectors: Computed values (canGenerate, isLoading, isGenerating, etc.)
- All selectors are pure functions with no side effects

### Context API
- `ShowcaseProvider` - Wraps component tree
- `useShowcaseState()` - Returns { state, dispatch }
- `useShowcaseDispatch()` - Returns dispatch function only
- `useShowcaseSelector(fn)` - For optimized re-renders

### Test Coverage
- All state transitions covered
- Edge cases: empty prompt, invalid model, wrong phase transitions
- Selector tests for derived state calculations

## [2026-03-14] Task 6: Web Worker Shell and WebGPU Probe

### Created Files
- `src/workers/inference.worker.ts` - Dedicated module Web Worker with probe logic
- `src/test/runtime/worker-probe.test.ts` - 8 test cases for probe contract coverage

### Key Design Decisions
1. **Probe logic extracted for testability**: `performProbe()` is a separate exported function that can be tested directly without worker message passing
2. **WebGPU types defined inline**: Since WebGPU types are not in standard TypeScript lib, they are defined in the worker file
3. **Graceful error handling**: All errors are caught and returned as structured `CapabilityProbeResult` with `errorMessage` field rather than thrown
4. **Request types placeholder**: Future request types (load_model, generate, etc.) are handled but return "not yet implemented" errors

### Probe Implementation
- Checks `navigator.gpu` existence
- Calls `navigator.gpu.requestAdapter()`
- If adapter exists: checks `shader-f16` support, captures `maxBufferSize` and `maxStorageBufferBindingSize`
- Gets adapter info via `requestAdapterInfo()` with fallback for unsupported browsers
- All browser API calls wrapped in try/catch

### Test Coverage
1. Unsupported browser case (navigator.gpu = undefined)
2. Adapter null case (requestAdapter returns null)
3. Successful probe with full capability info
4. Missing shader-f16 feature
5. requestAdapterInfo throwing error
6. requestAdapterInfo returning empty info
7. Probe throwing unexpectedly
8. Non-Error thrown values

## [2026-03-14] Task 7: Worker Client and Model Manager

### Created Files
- `src/runtime/worker-client.ts` - WorkerClient class for worker lifecycle management
- `src/runtime/model-manager.ts` - ModelManager facade for worker messaging
- `src/test/runtime/model-manager.test.ts` - 11 test cases for model-manager

### Key Design Decisions
1. **WorkerClient handles lifecycle**: Initialize, terminate, message wiring
2. **ModelManager tracks request IDs**: New requests invalidate old ones, stale events are ignored
3. **Runtime errors reject promises**: Error events cause pending promises to reject (not resolve with failure object)
4. **switchModel terminates and recreates worker**: Full cleanup ensures clean state
5. **Callbacks pattern for events**: ModelManager exposes callbacks for reducer integration rather than dispatching directly

### Worker Loading Pattern
For Next.js, use URL constructor with import.meta.url:
```typescript
const workerUrl = new URL('../workers/inference.worker.ts', import.meta.url)
const worker = new Worker(workerUrl, { type: 'module' })
```

### Request ID Generation
```typescript
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}
```

### Test Mocking Strategy
For Vitest with ES modules, use a class-based mock in vi.mock():
```typescript
vi.mock('@/runtime/worker-client', () => {
  return {
    WorkerClient: class MockWorkerClient {
      constructor(options) { capturedOnEvent = options.onEvent }
      initialize() { mockCalls.push({ method: 'initialize', args: [] }) }
      sendRequest(...args) { mockCalls.push({ method: 'sendRequest', args }) }
      terminate() { mockCalls.push({ method: 'terminate', args: [] }) }
      isReady() { return true }
    },
  }
})
```

### Test Cases Covered
1. Probe sends request and resolves with result
2. Load model rejects when probe not called first
3. Load model sends correct request after probe
4. Generate rejects when probe not called first
5. Generate rejects when model not loaded
6. Stale request IDs are ignored
7. switchModel terminates and reinitializes worker
8. Dispose terminates worker and clears state
9. Runtime errors propagate to callbacks
10. Multiple concurrent requests - only latest matters
11. Interrupt sends correct request

### Promise Behavior
- `probe()`: Resolves with `CapabilityProbeResult`
- `loadModel()`: Resolves with `ModelLoadResult` on success, rejects on runtime error
- `generate()`: Resolves with `GenerationResult` on success/interrupt, rejects on error
- Runtime errors cause promise rejection (not resolution with failure object)

## [2026-03-14] Task 8: Qwen Model Initialization in Worker

### Dependency
- `@huggingface/transformers@4.0.0-next.6` - Pinned version for Qwen3.5 compatibility

### Key Implementation Pattern for Qwen3.5
The correct flow for text-only generation with Qwen3_5ForConditionalGeneration:

```typescript
import {
  AutoProcessor,
  Qwen3_5ForConditionalGeneration,
  type PreTrainedModel,
  type Processor,
} from '@huggingface/transformers'

// 1. Load processor and model
const processor = await AutoProcessor.from_pretrained(repoId)
const model = await Qwen3_5ForConditionalGeneration.from_pretrained(repoId, {
  dtype: { embed_tokens: 'q4', vision_encoder: 'q4', decoder_model_merged: 'q4' },
  device: 'webgpu',
  progress_callback: (progress) => { /* emit progress events */ },
})

// 2. Apply chat template (returns string)
const text = processor.apply_chat_template(messages, {
  add_generation_prompt: true,
})

// 3. Process text to get inputs tensor
const inputs = await processor(text)

// 4. Generate
await model.generate({ ...inputs, max_new_tokens: 256 })
```

### Dtype Fallback Strategy
1. First attempt: All q4 quantization (embed_tokens, vision_encoder, decoder_model_merged)
2. Second attempt: fp16 vision_encoder if first fails
3. No third fallback - surface error to user

### Hidden System Prompt
```
You are a concise local browser demo assistant. Answer directly, clearly, and compactly. Do not mention hidden reasoning. Prefer short technical responses.
```

### Model State Management
- Single model in memory at a time
- `disposeModel()` clears model reference and resets state
- Model stored in `ModelState` interface with model, processor, modelId, repoId

### Worker Events Emitted During Load
1. `load_started` - When load begins
2. `load_progress` - During download with progress percentage and file name
3. `warming_started` - After model loaded, before warmup
4. `model_ready` - After successful warmup
5. `runtime_error` - On any failure (with cleanup of partial state)

### Warmup Implementation
- One-token generation with minimal input
- Uses same system prompt as real generation
- Input: "Hi" with system prompt
- Cleans up model on warmup failure

## [2026-03-14] Task 9: Streaming Generation and Interruption Semantics

### Key Implementation Pattern for TextStreamer
`TextStreamer` requires a `PreTrainedTokenizer`, NOT a `Processor`. Load tokenizer separately:

```typescript
import { AutoTokenizer, TextStreamer, InterruptableStoppingCriteria } from '@huggingface/transformers'

// Load tokenizer alongside processor
const processor = await AutoProcessor.from_pretrained(repoId)
const tokenizer = await AutoTokenizer.from_pretrained(repoId)

// TextStreamer requires tokenizer, not processor
const streamer = new TextStreamer(tokenizer, {
  skip_prompt: true,
  skip_special_tokens: true,
  callback_function: (token: string) => {
    // Handle streaming token
  },
})
```

### TextStreamer Callback Options
- Use `callback_function` (not `callbacks.on_token_generated`)
- The callback receives decoded text chunks, not raw tokens

### InterruptableStoppingCriteria Usage
```typescript
const stoppingCriteria = new InterruptableStoppingCriteria()

// Pass to generate
await model.generate({
  ...inputs,
  streamer,
  stopping_criteria: [stoppingCriteria],
})

// To interrupt:
stoppingCriteria.interrupt()

// Check if interrupted:
if (stoppingCriteria.interrupted) {
  // Handle interruption
}
```

### Generation Flow
1. Emit `generation_started` event
2. Create `InterruptableStoppingCriteria` and store in model state
3. Build messages: system prompt + user prompt
4. Apply chat template via processor
5. Create `TextStreamer` with tokenizer and callback
6. Generate with streamer and stopping criteria
7. On completion: emit `generation_complete` or `generation_interrupted`

### ModelState Extensions for Generation
```typescript
interface ModelState {
  model: PreTrainedModel | null
  processor: Processor | null
  tokenizer: PreTrainedTokenizer | null  // Required for TextStreamer
  modelId: string | null
  repoId: string | null
  stoppingCriteria: InterruptableStoppingCriteria | null
  activeRequestId: string | null  // Track current generation for stale event filtering
}
```

### Request ID Tracking
- Store `activeRequestId` when generation starts
- Only emit events if `activeRequestId` matches current request
- Clear `activeRequestId` when generation completes/errors
- This prevents stale events from old requests

### Events Emitted
1. `generation_started` - When generation begins
2. `stream_delta` - For each token/chunk streamed
3. `generation_complete` - Normal completion
4. `generation_interrupted` - When `stoppingCriteria.interrupt()` was called

## [2026-03-14] Task 10: Inference Form, Preset Interactions, and Output Panel

### Component Structure

#### Inference Panel (`src/components/sections/inference-panel.tsx`)
- Already fully implemented with all required functionality
- Uses `selectCanGenerate` and `selectCanStop` selectors for button states
- Generate button disabled when: prompt empty, unsupported, stopping, loading
- Stop button enabled only during generating/stopping phases
- Uses `data-testid` attributes: `prompt-input`, `generate-button`, `stop-button`

#### Preset Prompts (`src/components/sections/preset-prompts.tsx`)
- Updated to use `applyPresetTemplate` function from presets config
- Four preset buttons with icons: Summarize, Explain code, Rewrite text, Extract JSON
- Preset click wraps existing text into {{input}} placeholder or removes placeholder if empty
- Uses `data-testid` attributes: `preset-summarize`, `preset-explain-code`, `preset-rewrite-text`, `preset-extract-json`

#### Output Panel (`src/components/sections/output-panel.tsx`)
- Updated to show skeleton loading state during `loading_model` and `warming_model` phases
- Uses `selectIsLoading` selector to detect loading states
- Console/result pane styling with dark background (`bg-black/50`)
- Scrollable streaming text output with cursor animation during generation
- Uses `data-testid` attribute: `output-stream`

### State Management Patterns

#### Selectors Used
- `selectCanGenerate`: Returns true when runtimePhase is 'ready' and prompt text is non-empty
- `selectCanStop`: Returns true when runtimePhase is 'generating' or 'stopping'
- `selectIsLoading`: Returns true when runtimePhase is 'loading_model' or 'warming_model'
- `selectIsGenerating`: Returns true when runtimePhase is 'generating'
- `selectStreamedOutput`: Returns the streamed output text

#### Actions Dispatched
- `SET_PROMPT`: Updates prompt text
- `GENERATION_START`: Starts generation (only if canGenerate)
- `STOP_REQUEST`: Requests generation stop
- `APPLY_PRESET`: Applies preset template with presetId and text

### Preset Template Logic

The `applyPresetTemplate` function in `src/config/presets.ts`:
- If input is provided: replaces {{input}} placeholder with the input text
- If input is empty: returns template without the placeholder (removes `\n\n{{input}}` or `{{input}}`)

### E2E Test Pattern

Added `@prompt-controls` test that verifies:
1. Prompt input and generate button visibility
2. Generate button disabled when prompt is empty
3. Generate button enabled when prompt has text
4. All four preset buttons are visible
5. Preset buttons insert templates correctly
6. Preset buttons wrap existing text into the template

### Changes Made
1. `src/components/sections/preset-prompts.tsx`: Import and use `applyPresetTemplate` function
2. `src/components/sections/output-panel.tsx`: Add skeleton loading state during loading/warming phases
3. `tests/e2e/showcase.spec.ts`: Add `@prompt-controls` e2e test

### Verification
- `npm run build` exits 0
- `lsp_diagnostics` shows zero errors on all modified files
- All 100 unit tests pass

## [2026-03-14] Task: Graceful Failure and Recovery

### Created Files
- `src/lib/copy.ts` - Centralized error messages, titles, and recovery suggestions

### Key Patterns
- Error copy is centralized in a single file for consistency and easy updates
- Each error type has: message, title, and recovery suggestion
- `getErrorCopy()`, `getErrorTitle()`, `getRecoverySuggestion()` helpers for type-safe access

### Recovery Behavior
- Model selector cards are always clickable except during loading/warming phases
- Users can switch models after errors without page refresh
- `CLEAR_ERROR` action transitions from error phase to idle/ready based on warm state
- Clear Error button provided in capability status card for explicit recovery

### Error Types Defined
1. `unsupportedBrowser` - WebGPU not available
2. `adapterUnavailable` - WebGPU API exists but no GPU adapter
3. `modelInitFailure` - Model initialization failed
4. `warmupFailure` - Warmup failed after download
5. `generationFailure` - Inference error during generation
6. `cacheTrouble` - Guidance for stuck downloads

### No Hidden Fallbacks
- Errors are shown honestly in telemetry panel (`lastError`)
- No silent error catching
- Recovery suggestions guide users to switch models or clear browser data
