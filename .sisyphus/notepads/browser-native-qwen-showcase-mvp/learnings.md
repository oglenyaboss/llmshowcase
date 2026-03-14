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
