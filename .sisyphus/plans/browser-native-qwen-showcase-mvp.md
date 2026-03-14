# Plan: Browser-Native Qwen WebGPU Showcase MVP

## Objective

Build a single-page, portfolio-grade web showcase that demonstrates **local Qwen inference directly in the browser via WebGPU** with **no backend inference**.

The implementation must feel like a serious engineering demo rather than a chat clone:
- single-page technical showcase,
- explicit WebGPU story,
- honest capability detection,
- streaming generation,
- telemetry/debug visibility,
- clear stable vs experimental model support.

## Success Criteria

The finished implementation is successful only if all of the following are true:

1. The app is a **frontend-only** Vite application with no backend inference path.
2. The UI presents **three selectable Qwen tiers**:
   - Qwen 3.5 0.8B
   - Qwen 3.5 2B
   - Qwen 3.5 4B (explicitly experimental)
3. The app uses **WebGPU** for runtime inference and does **not silently fall back** to server inference or hidden CPU inference.
4. The app can show a complete runtime lifecycle:
   - capability probe,
   - model load progress,
   - warmup,
   - ready/warm state,
   - streaming generation,
   - stopped/error states.
5. The UI remains responsive because inference runs in a **dedicated Web Worker**.
6. The experience is **single-turn showcase UX**, not chat history UX.
7. The telemetry/debug panel exposes meaningful runtime data and honest limitations.
8. Unsupported or weak environments fail with **clear messages**, not silent stalls.
9. The repo remains production-style:
   - TypeScript-first,
   - no unnecessary `any`,
   - separated UI/runtime/state layers,
   - runnable scripts,
   - tests for logic/state flows,
   - README with launch + limitation guidance.

## Repo Reality

- Repository is greenfield.
- No existing app, config, lint, test, CI, or folder conventions exist.
- There are no migration constraints.

## Locked Decisions

### Stack

- **Framework**: Vite + React + TypeScript
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite`
- **UI primitives**: shadcn/ui Vite setup with only the minimal components needed for this MVP
- **Package manager**: npm
- **Lint/Test**: ESLint + Vitest + Testing Library + Playwright

### Runtime

- **Runtime library**: `@huggingface/transformers` pinned to the Qwen-compatible `4.0.0-next.6` line for MVP implementation
- **Execution backend**: ONNX Runtime Web through Transformers.js on **WebGPU**
- **Model source**: ONNX-community browser artifacts only
- **One model loaded at a time**
- **Inference location**: dedicated **module Web Worker**
- **No backend inference**
- **No silent CPU fallback**

### Model IDs

- `onnx-community/Qwen3.5-0.8B-ONNX`
- `onnx-community/Qwen3.5-2B-ONNX`
- `onnx-community/Qwen3.5-4B-ONNX`

### Product Behavior

- This is a **single-prompt showcase**, not a conversation app.
- Each generation **replaces** the current output instead of building chat history.
- All models run in **non-thinking / direct-response mode** for consistent latency and to avoid reasoning loops in-browser.
- `0.8B` and `2B` are the only **stable** support tiers.
- `4B` is always labeled **experimental**.
- The interface must look like a **technical product demo**, not message bubbles.

### Generation Defaults

- Hidden system prompt: concise, technical, direct-answer behavior only.
- Prompt textarea max length: **4000 characters**
- `do_sample: true`
- `temperature: 0.7`
- `top_p: 0.8`
- `top_k: 20`
- `repetition_penalty: 1.05`
- `max_new_tokens: 256`
- No user-facing advanced tuning controls in MVP

## Dependency Plan

### Runtime Dependencies

- `react`
- `react-dom`
- `@huggingface/transformers@4.0.0-next.6`
- `lucide-react`
- `clsx`
- `tailwind-merge`
- `class-variance-authority`
- shadcn-required Radix packages for the exact selected primitives only:
  - `@radix-ui/react-progress`
  - `@radix-ui/react-scroll-area`
  - `@radix-ui/react-select`
  - `@radix-ui/react-separator`
- `@radix-ui/react-slot`
- `@radix-ui/react-tooltip`

### Package Scripts

Use these exact `package.json` scripts:

- `dev`: `vite`
- `build`: `tsc -b && vite build`
- `preview`: `vite preview`
- `lint`: `eslint .`
- `test`: `vitest`
- `test:e2e`: `playwright test`

### Dev Dependencies

- `@types/node`
- `@types/react`
- `@types/react-dom`
- `vite`
- `@vitejs/plugin-react`
- `typescript`
- `tailwindcss`
- `@tailwindcss/vite`
- `eslint`
- `@eslint/js`
- `typescript-eslint`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `globals`
- `vitest`
- `jsdom`
- `@testing-library/react`
- `@testing-library/jest-dom`
- `@testing-library/user-event`
- `@playwright/test`

## Architecture Blueprint

### Application Shape

- Single route only.
- No React Router.
- No server routes.
- Root app composes one hero section and one responsive two-column showcase layout.

### Design Direction

- Dark-first technical aesthetic.
- Subtle grid / surface treatment, not flashy neon.
- Use cards, badges, small monospace metadata labels, and restrained accent color.
- Avoid chat bubbles entirely.
- Output should look like a **streaming console/result pane**.

### File Structure

```text
/
├─ components.json
├─ eslint.config.mjs
├─ index.html
├─ package.json
├─ playwright.config.ts
├─ README.md
├─ tsconfig.json
├─ tsconfig.app.json
├─ tsconfig.node.json
├─ vite.config.ts
├─ src/
│  ├─ main.tsx
│  ├─ index.css
│  ├─ app/
│  │  ├─ App.tsx
│  │  └─ app-shell.tsx
│  ├─ components/
│  │  ├─ sections/
│  │  │  ├─ hero-section.tsx
│  │  │  ├─ model-selector-card.tsx
│  │  │  ├─ capability-status-card.tsx
│  │  │  ├─ inference-panel.tsx
│  │  │  ├─ preset-prompts.tsx
│  │  │  ├─ output-panel.tsx
│  │  │  ├─ telemetry-panel.tsx
│  │  │  └─ footer-info.tsx
│  │  └─ ui/
│  │     ├─ badge.tsx
│  │     ├─ button.tsx
│  │     ├─ card.tsx
│  │     ├─ progress.tsx
│  │     ├─ scroll-area.tsx
│  │     ├─ select.tsx
│  │     ├─ separator.tsx
│  │     ├─ skeleton.tsx
│  │     ├─ textarea.tsx
│  │     └─ tooltip.tsx
│  ├─ config/
│  │  ├─ models.ts
│  │  └─ presets.ts
│  ├─ lib/
│  │  ├─ cn.ts
│  │  ├─ copy.ts
│  │  ├─ format.ts
│  │  └─ guards.ts
│  ├─ runtime/
│  │  ├─ capability.ts
│  │  ├─ inference-types.ts
│  │  ├─ model-manager.ts
│  │  ├─ telemetry.ts
│  │  └─ worker-client.ts
│  ├─ state/
│  │  ├─ showcase-context.tsx
│  │  ├─ showcase-reducer.ts
│  │  └─ showcase-selectors.ts
│  ├─ workers/
│  │  └─ inference.worker.ts
│  ├─ test/
│  │  ├─ setup.ts
│  │  ├─ runtime/
│  │  │  ├─ capability.test.ts
│  │  │  ├─ model-manager.test.ts
│  │  │  ├─ telemetry.test.ts
│  │  │  └─ worker-probe.test.ts
│  │  └─ state/
│  │     └─ showcase-reducer.test.ts
│  └─ vite-env.d.ts
└─ tests/
   └─ e2e/
      └─ showcase.spec.ts
```

### State Ownership

#### Reducer-Owned Serializable UI State

Keep the following in a reducer/context layer:
- selected model id,
- prompt text,
- preset id,
- runtime phase,
- progress percentage / loading labels,
- streamed output text,
- status copy,
- telemetry snapshots,
- current error,
- warm/cold flag,
- timestamps and counts used by UI.

#### Service-Owned Non-Serializable Runtime State

Keep the following inside `ModelManager` only:
- worker instance,
- active request id,
- active model id actually loaded in worker,
- stale-event filtering,
- interrupt lifecycle,
- teardown/dispose mechanics,
- request promises/callback routing.

### Runtime State Machine

Use these exact phases:

- `idle`
- `probing`
- `unsupported`
- `loading_model`
- `warming_model`
- `ready`
- `generating`
- `stopping`
- `error`

Use a separate field for warm state:
- `cold`
- `warm`

### Model Registry Contract

Each model entry in `src/config/models.ts` must contain:

- `id`
- `label`
- `repoId`
- `tier` (`stable` or `experimental`)
- `description`
- `warning`
- `memoryNote`
- `recommendedFor`
- `dtype`
- `generationDefaults`

Model-tier copy must be fixed as follows:

- **0.8B**: “Fastest path. Best chance of working on modern integrated GPUs and Apple Silicon.”
- **2B**: “Balanced path. Better output quality, higher load time and memory pressure.”
- **4B**: “Experimental. High failure/stall risk on integrated GPUs and weaker laptops.”

### Worker Protocol

Define strict discriminated unions for all worker messages.

#### Main thread → worker

- `probe`
- `load_model`
- `generate`
- `interrupt`
- `dispose_model`
- `reset_session`

Every operation except `probe` must include:
- `requestId`
- `modelId`

#### Worker → main thread

- `probe_result`
- `load_started`
- `load_progress`
- `warming_started`
- `model_ready`
- `generation_started`
- `stream_delta`
- `generation_complete`
- `generation_interrupted`
- `runtime_error`

Every worker event after `probe_result` must echo:
- `requestId`
- `modelId`

`ModelManager` must ignore any event whose `requestId` is no longer current.

### Capability Detection

Use two-phase detection.

#### Phase 1 — API probe

On initial app mount:
- check `navigator.gpu`,
- call `navigator.gpu.requestAdapter()`,
- collect:
  - `shader-f16` support,
  - `maxBufferSize`,
  - `maxStorageBufferBindingSize`,
  - adapter info if available, otherwise `Unavailable`.

#### Phase 2 — real runtime probe

Real support is not considered confirmed until selected model load + warmup succeeds.

Rules:
- never claim a model is supported based only on API availability,
- use heuristics for guidance copy only,
- use actual load/warmup success as the final truth.

### Loading / Warmup / Preload Behavior

- Do **not** auto-download model weights on page load.
- Instantiate the worker and run `probe` on mount.
- Do **not** load any model just because the selection changed.
- First click on **Generate** triggers:
  1. load selected model if not already loaded,
  2. warmup with a minimal one-token run,
  3. begin actual generation.
- If the selected model is already loaded and warm, start generation immediately.

Warm-state semantics are fixed as follows:
- `cold` = model is not initialized in the current worker session,
- `warm` = model is loaded and warmed in the current worker session,
- a full page refresh always returns to `cold`, even if browser caches reduce network download cost.

### Model Loading Rules

- Only one model may live in memory at a time.
- Switching model must always:
  1. interrupt any active generation,
  2. terminate/dispose the old model worker state,
  3. clear output and timings,
  4. mark new selection as `cold`.
- No multi-model residency.
- No background preloading of secondary models.

### Runtime Implementation Rules

- Primary implementation path for Qwen3.5 models:
  - `AutoProcessor`
  - `Qwen3_5ForConditionalGeneration`
  - `TextStreamer`
  - `InterruptableStoppingCriteria`
- Use this exact hidden system prompt:
  - `You are a concise local browser demo assistant. Answer directly, clearly, and compactly. Do not mention hidden reasoning. Prefer short technical responses.`
- Build generation input as exactly two messages:
  1. system message with the fixed hidden system prompt,
  2. user message with the textarea content.
- Apply the chat template through the processor for text-only usage and disable thinking mode explicitly if the model API supports that option in the selected implementation path.
- First dtype attempt for text-only MVP:
  - `embed_tokens: "q4"`
  - `vision_encoder: "q4"`
  - `decoder_model_merged: "q4"`
- If model initialization fails on this dtype map, retry exactly once with:
  - `embed_tokens: "q4"`
  - `vision_encoder: "fp16"`
  - `decoder_model_merged: "q4"`
- If the second attempt fails, surface the failure and stop. Do not add a third runtime path.
- Do not retain `past_key_values` between generations.
- Do not expose a thinking-mode toggle in MVP.

### Telemetry Panel Fields

The telemetry/debug panel must show these exact fields:

- Selected model label
- Selected model repo id
- Support tier (`stable` / `experimental`)
- Runtime library (`Transformers.js`)
- Backend (`WebGPU`)
- Runtime phase
- Warm state (`cold` / `warm`)
- `shader-f16` support (`yes` / `no`)
- `maxBufferSize` formatted
- `maxStorageBufferBindingSize` formatted
- Load duration ms
- Warmup duration ms
- Generation duration ms
- Approx emitted token count
- Approx tokens/sec
- Heuristic memory note
- Last error message

If adapter info is unavailable, show `Adapter info unavailable in this browser`.

### UX Copy Rules

Use explicit, honest copy.

#### Unsupported browser

`WebGPU is unavailable in this browser. Try the latest Chrome, Edge, or Safari on a newer GPU-capable device.`

#### Adapter unavailable

`This browser exposed the WebGPU API, but no compatible GPU adapter could be created.`

#### Model init failure

`The selected model could not be initialized on this device. Try Qwen 0.8B or switch to a more capable GPU.`

#### Warmup failure

`The model downloaded, but WebGPU warmup failed before generation could start.`

#### Generation failure

`Generation stopped because the browser runtime reported an inference error.`

#### 4B warning

`Qwen 3.5 4B is experimental in-browser and may fail or stall on integrated GPUs.`

#### Cache trouble helper note

`If downloads get stuck after a refresh, clear this site’s browser data and retry.`

### Preset Prompts

Implement exactly four preset prompt templates:

1. **Summarize**
   - `Summarize the following in 3 concise bullet points:\n\n{{input}}`
2. **Explain code**
   - `Explain this code clearly. Describe what it does, how it works, and any obvious risks or edge cases:\n\n{{input}}`
3. **Rewrite text**
   - `Rewrite the following text to be clearer, tighter, and more professional while preserving the meaning:\n\n{{input}}`
4. **Extract JSON**
   - `Extract structured data from the following text. Return valid minified JSON only with keys: summary, entities, action_items.\n\n{{input}}`

Preset button behavior:
- clicking a preset inserts its template into the textarea,
- if the textarea already contains text, wrap that text into `{{input}}`,
- if the textarea is empty, insert the template with `{{input}}` removed and cursor placed at the end.

### Test Strategy

- **Unit tests**: capability helpers, reducer transitions, telemetry formatting, model-manager event handling.
- **Component/integration tests**: prompt actions, control enable/disable logic, reducer-driven UI states.
- **Playwright**: unsupported-browser path and basic rendered-shell checks.
- **Real WebGPU smoke**: local manual verification on the implementer machine for at least 0.8B before finishing runtime work.

### Required Data Test IDs

Use these exact `data-testid` values:

- `hero-heading`
- `model-card-qwen-0_8b`
- `model-card-qwen-2b`
- `model-card-qwen-4b`
- `status-webgpu`
- `status-runtime`
- `status-model`
- `status-warm`
- `prompt-input`
- `preset-summarize`
- `preset-explain-code`
- `preset-rewrite-text`
- `preset-extract-json`
- `generate-button`
- `stop-button`
- `output-stream`
- `telemetry-panel`
- `telemetry-runtime`
- `telemetry-error`
- `footer-local-inference`

### Support Tier Acceptance Rules

#### Stable path acceptance

For `0.8B` and `2B`, the implementation is acceptable only if:
- both models appear as selectable production-style options,
- both use the same worker/WebGPU runtime path,
- both show load/warm/generate states correctly,
- failures surface honest device/runtime messages instead of silent fallback,
- neither model is labeled experimental.

#### Experimental path acceptance

For `4B`, the implementation is acceptable only if:
- it is labeled experimental everywhere it appears,
- the UI warns before or during load attempt,
- failure is treated as an expected product case,
- the app remains responsive after failure,
- the user can switch back to 0.8B/2B without refreshing.

#### Unsupported-environment acceptance

For browsers/devices without a viable WebGPU path, the implementation is acceptable only if:
- the app enters `unsupported` state,
- generate controls do not trigger runtime work,
- the UI explains what is missing,
- the telemetry panel does not claim an active inference backend.

### Browser Validation Targets

- Primary supported validation: latest desktop Chrome and Edge.
- Secondary spot check: latest desktop Safari with WebGPU enabled.
- Do not claim Firefox support in MVP copy unless directly verified during implementation.
- Playwright unsupported-browser coverage must simulate missing WebGPU by overriding `navigator.gpu` to `undefined` before app boot.

### Out of Scope

Do **not** add any of the following in MVP:

- backend inference,
- API routes,
- auth,
- multi-turn chat history,
- saved sessions,
- export/share,
- prompt parameter tuning UI,
- image input,
- video input,
- RAG/document upload,
- analytics backend,
- offline/PWA work,
- multi-model comparison mode,
- CPU/WASM hidden fallback,
- Next.js migration,
- benchmark charts.

## Implementation Tasks

<!-- TASKS INSERT HERE -->

### Task 1 — Scaffold the greenfield Vite application foundation

Create the base project skeleton and baseline tooling for a browser-only React application.

Implementation requirements:
- scaffold Vite React TypeScript app in the repo root,
- configure npm scripts for `dev`, `build`, `lint`, `test`, and `test:e2e`,
- configure TypeScript for app + node usage,
- configure Vite with React and Tailwind plugin,
- add path alias `@/* -> ./src/*`,
- ensure worker imports are supported via module worker / Vite worker conventions,
- add `.gitignore` suitable for Node/Vite output,
- create empty source directories matching the planned structure.

QA scenarios:
- Command: `npm install`
  - Expected: exits `0` and produces `node_modules` plus lockfile.
- Command: `npm run build`
  - Expected: exits `0` with a production bundle and no TS build errors.
- Command: `npm run lint`
  - Expected: exits `0` on the empty scaffold.

### Task 2 — Install and configure Tailwind + minimal shadcn/ui primitives

Set up the styling system and only the UI primitives needed for the showcase.

Implementation requirements:
- install Tailwind v4 with `@tailwindcss/vite`,
- import Tailwind in `src/index.css`,
- initialize shadcn/ui for Vite,
- add only the required primitive components from the plan,
- create `src/lib/cn.ts` for merged classnames,
- establish dark-first surface tokens and typography rules in CSS,
- include utility classes for technical panels, muted copy, and subtle grid/background treatment.

QA scenarios:
- Command: `npm run build`
  - Expected: exits `0` and includes generated Tailwind styles.
- Tool: manual browser flow in a local dev session.
  - Preconditions: `npm run dev` is running.
  - Steps:
    1. Open `http://127.0.0.1:5173` in a desktop browser.
    2. Wait for the first paint to settle.
    3. Inspect the root shell visually.
  - Expected: the page uses a dark styled shell and does not look like raw browser-default HTML controls.

### Task 3 — Create typed runtime/domain contracts before implementation

Define the full set of shared types before writing runtime logic.

Implementation requirements:
- create `src/runtime/inference-types.ts` with:
  - model config types,
  - capability probe result types,
  - telemetry snapshot type,
  - runtime phase union,
  - worker request/response discriminated unions,
  - model load/generation result types,
- create `src/config/models.ts` with the three fixed model entries,
- create `src/config/presets.ts` with the four fixed presets,
- ensure no `any` appears in these files.

QA scenarios:
- Command: `npm run lint`
  - Expected: exits `0`.
- Command: `npm run build`
  - Expected: exits `0` and compiles the contract/config files without TypeScript errors.

### Task 4 — Implement pure capability helpers and telemetry formatters first

Build testable pure logic before wiring browser APIs.

Implementation requirements:
- create `src/runtime/capability.ts` helpers for:
  - formatting adapter limits,
  - deriving support copy from probe results,
  - converting raw adapter data into UI-safe capability summaries,
- create `src/runtime/telemetry.ts` helpers for:
  - duration calculation,
  - approx tokens/sec calculation,
  - memory-note formatting,
  - default telemetry state,
- create `src/lib/format.ts` for bytes/ms/tokens formatting.

QA scenarios:
- Command: `npm run test -- --run src/test/runtime/capability.test.ts src/test/runtime/telemetry.test.ts`
  - Expected: exits `0`.
- Assertions must cover:
  - no WebGPU case,
  - adapter-null case,
  - probe success formatting,
  - zero-token throughput,
  - byte formatting for large limits.

### Task 5 — Define reducer-driven app state and transition rules

Create the UI state machine before connecting it to the worker runtime.

Implementation requirements:
- create `src/state/showcase-reducer.ts` with explicit actions for:
  - probe start/success/failure,
  - model select,
  - load start/progress/ready,
  - warmup start/complete,
  - prompt change,
  - preset apply,
  - generation start/stream/complete,
  - stop request/interrupt,
  - runtime error,
  - telemetry update,
  - reset-on-model-switch,
- create `src/state/showcase-selectors.ts`,
- create `src/state/showcase-context.tsx` provider wrapper.

Reducer rules that must be enforced:
- generate cannot move to `generating` from `unsupported`,
- model switch clears output and timings,
- stale errors do not preserve `generating`,
- stop moves phase to `stopping` before final interrupt result,
- successful ready state sets warm state to `warm`.

QA scenarios:
- Command: `npm run test -- --run src/test/state/showcase-reducer.test.ts`
  - Expected: exits `0`.
- Must include cases for:
  - switch while generating,
  - empty prompt blocked state,
  - 4B selection preserving experimental warning,
  - interrupted generation ending in `ready`, not `error`.

### Task 6 — Implement the worker shell and WebGPU probe path

Create the dedicated module worker and validate basic runtime probing.

Implementation requirements:
- create `src/workers/inference.worker.ts`,
- structure probe handling so the probe-result shaping logic is testable outside raw `self.addEventListener` glue,
- create `src/test/runtime/worker-probe.test.ts` for probe-contract coverage,
- implement `probe` handling that:
  - checks `navigator.gpu`,
  - requests adapter,
  - captures `shader-f16` support and safe limit values,
  - returns a `probe_result` message,
- do not load any model in this task,
- wrap worker logic in try/catch and always emit typed `runtime_error` on unexpected failure.

QA scenarios:
- Command: `npm run test -- --run src/test/runtime/worker-probe.test.ts`
  - Expected: exits `0` and covers supported, unsupported, adapter-null, and thrown-error probe-result cases.
- Command: `npm run build`
  - Expected: exits `0` with the worker bundled successfully.

### Task 7 — Build a typed worker client and ModelManager facade

Encapsulate all worker messaging behind a single runtime service.

Implementation requirements:
- create `src/runtime/worker-client.ts` responsible for worker creation and message wiring,
- create `src/runtime/model-manager.ts` with methods:
  - `probe()`
  - `loadModel(modelId)`
  - `generate(modelId, prompt)`
  - `interrupt()`
  - `switchModel(nextModelId)`
  - `dispose()`
- enforce one active request id at a time,
- ignore stale worker events,
- expose callbacks/events for reducer integration,
- terminate and recreate the worker on full dispose after model switch.

QA scenarios:
- Command: `npm run test -- --run src/test/runtime/model-manager.test.ts`
  - Expected: exits `0`.
- Required assertions:
  - stale request ids are ignored,
  - switchModel interrupts prior generation,
  - runtime errors propagate exactly once,
  - generate before probe/load is rejected predictably.

### Task 8 — Add real model load, warmup, and dispose behavior in the worker

Implement actual Qwen model initialization using the locked runtime path.

Implementation requirements:
- use `AutoProcessor` + `Qwen3_5ForConditionalGeneration`,
- wire model repo IDs from request payload,
- implement fixed dtype attempt #1:
  - `embed_tokens: "q4"`
  - `vision_encoder: "q4"`
  - `decoder_model_merged: "q4"`
- if initialization fails, retry once with `vision_encoder: "fp16"`,
- emit load progress via `progress_callback`,
- run one-token warmup after successful initialization,
- emit `load_started`, `load_progress`, `warming_started`, and `model_ready`,
- implement explicit disposal/teardown when requested,
- never fall back to alternate backends silently.

QA scenarios:
- Command: `npm run build`
  - Expected: exits `0` with worker code bundled.
- Command: `npm run test -- --run src/test/runtime/model-manager.test.ts`
  - Expected: mocked load-progress, warmup-start, model-ready, and load-failure paths are handled in order and leave runtime state recoverable.
- Real-browser validation for this task is deferred to Task 13 and the Final Verification Wave, after the visible runtime surfaces exist.

### Task 9 — Implement streaming generation and interruption semantics

Add generation, streaming output, and stop control using the worker runtime.

Implementation requirements:
- use `TextStreamer` for streamed text deltas,
- use `InterruptableStoppingCriteria` for stop behavior,
- generate in direct-response mode only,
- disable prompt submission when prompt is empty or runtime is unsupported,
- on each new generation:
  - clear previous output,
  - reset token counters/timing,
  - start fresh,
- do not preserve KV cache across requests,
- emit exact events:
  - `generation_started`
  - `stream_delta`
  - `generation_complete`
  - `generation_interrupted`

QA scenarios:
- Command: `npm run test -- --run src/test/runtime/model-manager.test.ts src/test/state/showcase-reducer.test.ts`
  - Expected: streaming delta handling, interrupt flow, and duplicate-submit guards pass without UI involvement.
- Real-browser validation for streaming and stop behavior is deferred to Task 13 and the Final Verification Wave, after the prompt/output controls exist.

### Task 10 — Compose the showcase UI shell and visual hierarchy

Build the full single-page layout with the required showcase sections.

Implementation requirements:
- create `src/app/App.tsx` and `src/app/app-shell.tsx`,
- create the initial `tests/e2e/showcase.spec.ts` shell coverage with a `@shell` case,
- build the following sections:
  - hero,
  - model selector,
  - capability/status,
  - inference panel,
  - preset prompts,
  - output panel,
  - telemetry/debug panel,
  - footer/info block,
- ensure responsive layout:
  - single column on small screens,
  - primary/secondary panel split on large screens,
- add all required `data-testid` hooks.

QA scenarios:
- Command: `npx playwright test tests/e2e/showcase.spec.ts --grep "@shell"`
  - Expected: the page renders all required sections and test IDs.
- Tool: manual browser flow in a local dev session.
  - Preconditions: `npm run dev` is running.
  - Steps:
    1. Open `http://127.0.0.1:5173` at desktop width (1440px or wider).
    2. Inspect the overall layout.
  - Expected: the output area is a single panel surface, the page has no chat-history UI, and the layout reads as one cohesive technical showcase.

### Task 11 — Implement model selection UX with stable/experimental signaling

Make model selection explicit, understandable, and safe.

Implementation requirements:
- create a model selector card with three options,
- extend `tests/e2e/showcase.spec.ts` with a `@model-selection` case,
- visually distinguish the selected option,
- show tier badges (`stable`, `experimental`),
- show per-model copy from the registry,
- show experimental warning inline for 4B,
- disable switching only while the worker is disposing/loading, not forever,
- switching model mid-generation must:
  - stop generation,
  - clear stale output,
  - reset timings,
  - set warm state to cold.

QA scenarios:
- Command: `npx playwright test tests/e2e/showcase.spec.ts --grep "@model-selection"`
  - Expected: selecting 4B shows experimental messaging immediately and model switching resets visible runtime/output state.

### Task 12 — Build capability/status cards with honest environment messaging

Implement the runtime observability surfaces that explain whether the app can run.

Implementation requirements:
- show:
  - `WebGPU available / unavailable`,
  - runtime phase,
  - selected model status,
  - warm/cold state,
- extend `tests/e2e/showcase.spec.ts` with an `@unsupported` case that overrides `navigator.gpu` before app boot,
- when unsupported:
  - show unsupported copy,
  - disable generation,
  - leave model cards visible,
- when supported but not yet loaded:
  - show that the environment is capable but model is cold,
- when model fails:
  - keep status visible with recovery suggestion.

QA scenarios:
- Command: `npx playwright test tests/e2e/showcase.spec.ts --grep "@unsupported"`
  - Expected: `status-webgpu` shows unavailable copy and `generate-button` is disabled.
- Tool: manual browser flow on a WebGPU-capable device.
  - Preconditions: `npm run dev` is running.
  - Steps:
    1. Open `http://127.0.0.1:5173`.
    2. Wait for the probe to finish.
    3. Observe `status-runtime`, `status-webgpu`, and `status-warm`.
  - Expected: the cards reflect the live probe result and phase transition without stale `probing` state.

### Task 13 — Build the inference form, preset interactions, and output panel

Implement the main user interaction surface.

Implementation requirements:
- textarea with fixed placeholder explaining local prompt execution,
- extend `tests/e2e/showcase.spec.ts` with a `@prompt-controls` case,
- generate button,
- stop button,
- preset buttons above or beside the form,
- output panel with scrollable streaming text,
- button states:
  - Generate disabled when prompt empty, unsupported, stopping, or loading,
  - Stop enabled only during generating/stopping transition,
- preserve partial output on interrupt,
- show skeleton/progress treatment while loading/warming.

QA scenarios:
- Command: `npx playwright test tests/e2e/showcase.spec.ts --grep "@prompt-controls"`
  - Expected: empty prompt disables Generate, preset clicks mutate the prompt, and Stop is unavailable outside active generation.
- Tool: manual browser flow on a WebGPU-capable device.
  - Preconditions: `npm run dev` is running and 0.8B can reach `ready`.
  - Steps:
    1. Apply each preset once.
    2. Verify the prompt content changes.
    3. Start one generation and inspect `output-stream`.
  - Expected: stream appears incrementally and the output pane remains readable while growing.

### Task 14 — Implement telemetry/debug panel with exact required fields

Make the demo technically convincing by exposing runtime evidence.

Implementation requirements:
- render all exact telemetry fields listed in the plan,
- extend `tests/e2e/showcase.spec.ts` with a `@telemetry-shell` case,
- display durations only after data exists,
- approximate tokens/sec from streamed token timing,
- show heuristic memory note from selected model config,
- show last error text when present,
- show backend explicitly as `WebGPU` only after successful probe/load path,
- never display ambiguous labels like `auto` or `default`.

QA scenarios:
- Command: `npx playwright test tests/e2e/showcase.spec.ts --grep "@telemetry-shell"`
  - Expected: the telemetry panel renders all required labels in the shell.
- Tool: manual browser flow on a WebGPU-capable device.
  - Preconditions: `npm run dev` is running and one successful generation has completed.
  - Steps:
    1. Generate once with 0.8B.
    2. Inspect `telemetry-panel`.
  - Expected: load duration, generation duration, approximate token count, and approximate tokens/sec are populated.

### Task 15 — Implement graceful failure, recovery, and cache-trouble guidance

Ensure the app handles real-world browser/runtime failure modes honestly.

Implementation requirements:
- centralize user-facing runtime error mapping in `src/lib/copy.ts`,
- display exact copy for unsupported browser, adapter failure, model init failure, warmup failure, generation failure,
- add a small recovery/help note for partial download/cache issues,
- after any failure, keep the page usable so users can:
  - switch to 0.8B,
  - retry generation,
  - read the telemetry panel,
- do not force refresh as the only recovery path.

QA scenarios:
- Command: `npm run test -- --run src/test/runtime/model-manager.test.ts`
  - Expected: mapped runtime-error cases surface the correct user-facing copy.
- Command: `npx playwright test tests/e2e/showcase.spec.ts --grep "@unsupported"`
  - Expected: unsupported mode does not leave a permanent loading spinner and keeps the page interactive.

### Task 16 — Add README with launch instructions, limitations, and v2 roadmap

Document the showcase honestly for portfolio use.

Implementation requirements:
- include project purpose and browser-native constraint,
- include install and run commands,
- document tested browsers,
- document the three model tiers and 4B experimental status,
- explicitly state that actual VRAM cannot be queried reliably from browsers,
- document common failure modes,
- include a v2 roadmap aligned with the product direction.

QA scenarios:
- Command: `node -e "const fs=require('fs'); const s=fs.readFileSync('README.md','utf8'); const required=['Install','Run','Tested browsers','Known limitations','V2']; const missing=required.filter(x=>!s.includes(x)); if(missing.length){console.error(missing); process.exit(1)}"`
  - Expected: exits `0`.
- Command: `node -e "const pkg=require('./package.json'); const required=['dev','build','preview','lint','test','test:e2e']; const missing=required.filter(x=>!pkg.scripts?.[x]); if(missing.length){console.error(missing); process.exit(1)}"`
  - Expected: exits `0`.

## Final Verification Wave

Run these commands exactly once the implementation is complete:

1. `npm install`
2. `npm run lint`
3. `npm run test -- --run`
4. `npx playwright test`
5. `npm run build`

Expected outcomes:
- all commands exit with code `0`,
- no TypeScript errors,
- no ESLint errors,
- Playwright unsupported-browser test passes,
- production build succeeds.

Then run one real browser smoke on a WebGPU-capable machine:

1. `npm run dev`
2. Open the app in a browser with WebGPU enabled.
3. Select **Qwen 3.5 0.8B**.
4. Enter: `Summarize why WebGPU local inference is useful in one sentence.`
5. Click **Generate**.

Expected outcomes:
- status moves through `loading_model` → `warming_model` → `ready` → `generating`,
- streamed text appears progressively in `output-stream`,
- telemetry shows non-empty load and generation timings,
- footer states that inference runs locally in-browser,
- no hidden backend path is reported anywhere.

## Commit Plan

Use this exact commit sequence unless an earlier runtime blocker prevents progress:

1. `chore: scaffold vite react ts app with tailwind foundation`
2. `test: add capability and state contract coverage`
3. `feat: add webgpu worker probe and qwen model loading flow`
4. `feat: implement single-model manager and reducer-driven runtime state`
5. `feat: build showcase layout and model selection experience`
6. `feat: add load warmup telemetry and runtime status views`
7. `feat: stream generation output with presets and stop controls`
8. `feat: add graceful fallback states and limitation messaging`
9. `docs: add launch instructions known limitations and v2 roadmap`

## Final Response Contract

After implementation is complete, the final user-facing answer must use these exact headings:

- `A. Краткое архитектурное решение`
- `B. Trade-off’ы и почему выбран этот путь`
- `C. Структура проекта`
- `D. Полный код файлов`
- `E. Как запускать`
- `F. Что может не взлететь в реальных браузерах`
- `G. Что улучшить во второй версии`

Do not add a backend-inference story anywhere in the final response.
