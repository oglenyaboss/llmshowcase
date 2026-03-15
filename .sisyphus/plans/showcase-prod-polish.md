# Showcase Production Polish

## Goal

Turn the current browser-local Qwen WebGPU demo into a GitHub-ready showcase app with a ChatGPT-style chat workspace, an LM Studio-style settings rail, persistent local multi-chat history, editable system prompt support, and user-configurable inference controls — without replacing the existing browser-local runtime pipeline.

## Repo-Grounded Current State

- `src/app/app-shell.tsx` renders a demo shell made of stacked cards, not a full chat workspace.
- `src/state/showcase-reducer.ts` is single-turn today: one `promptText`, one `streamedOutput`, one `outputText`.
- `src/components/runtime-initializer.tsx` drives the runtime lifecycle from React state into `src/runtime/model-manager.ts` and then `src/workers/inference.worker.ts`.
- `src/workers/inference.worker.ts` currently hardcodes both the system prompt and generation defaults.
- `src/config/models.ts` already defines per-model `generationDefaults`, but the UI/runtime do not expose them to the user.
- There is no browser persistence layer for chats or settings.
- Quality baseline already exists: strict TypeScript, ESLint, Vitest, Playwright, and Next build.
- GitHub-showcase polish is missing: no CI workflow, no committed LICENSE file, no README screenshots/assets.

## Locked Product Decisions

- App shape: full app shell with a local multi-chat sidebar.
- Visual direction: hybrid ChatGPT-like chat workspace + LM Studio-like control rail.
- Persistence: chats and settings survive reloads.
- Settings ownership: global defaults exist for new chats, but each chat snapshots its own model, system prompt, and inference settings.
- Runtime scope: keep the existing browser-local WebGPU pipeline; no backend, sync, or public deployment in this pass.
- Chat management scope: create, select, rename, delete only.
- Default system prompt for new chats: move the current hidden worker prompt into config and reuse it as the explicit default:
  - `You are a concise local browser demo assistant. Answer directly, clearly, and compactly. Do not mention hidden reasoning. Prefer short technical responses.`
- Persistence engine: native IndexedDB, versioned schema `v1`, no extra storage dependency.
- Identity rule: use `crypto.randomUUID()` for chat ids and message ids; do not add a UUID package.
- Model loading rule: one loaded model at a time; switching to a chat with a different `modelId` automatically triggers a model switch/load with visible loading state and disabled send actions.
- Model change rule inside an active chat: changing the model keeps the chat history and system prompt, but resets that chat’s inference settings to the selected model’s `generationDefaults`.
- Reload during generation: do not persist partial streaming text; only completed messages, interrupted-finalized messages, chat drafts, and settings are persisted.
- Title rule: first user message auto-titles the chat, truncated to 48 characters with ellipsis; fallback title is `New chat`; manual rename prevents future auto-title overwrites.
- History trim rule for generation requests: send system prompt first, then the latest 8 completed user/assistant pairs, then the current user message.
- Exposed settings surface:
  - Primary: `temperature`, `topP`, `repetitionPenalty`, `maxNewTokens`
  - Advanced collapsible: `doSample`, `topK`
  - Out of scope: beam search, multiple return sequences, no-repeat-ngram controls, attachments, model comparison mode.
- Settings UX rule: the right rail edits the active chat snapshot; add two explicit actions:
  - `Reset chat to defaults`
  - `Save current settings as new-chat defaults`
- Delete rule: deleting the last remaining chat immediately creates a fresh empty chat from global defaults so the app never enters a no-chat state.
- Busy-state rule: while runtime phase is `loading_model`, `warming_model`, `generating`, or `stopping`, disable chat switching, model switching, delete, and settings mutation controls.

## Scope

### IN

- Persistent local multi-chat sidebar
- Chat-first workspace layout
- Active-chat draft persistence
- Editable per-chat system prompt
- Editable per-chat inference settings with global defaults for new chats
- Structured chat request payloads through runtime and worker
- Auto model switching when active chat changes model
- README refresh, LICENSE file, screenshots, CI workflow

### OUT

- Auth
- Cloud sync or shared storage
- Export/import
- Attachments or multimodal upload UI
- Search, folders, pinning, branching, tags
- AI-generated chat titles
- Public deployment config
- CPU/WASM fallback redesign
- Multiple simultaneously loaded models
- Formatter adoption / repo-wide style rewrite beyond files touched for this pass

## Architecture Contract

### Layout Contract

- Desktop layout: 3-pane workspace.
  - Left: chat sidebar
  - Center: main chat thread + composer
  - Right: model/system/settings rail + status + telemetry
- Grid contract:
  - `lg`: `260px minmax(0,1fr)` with right rail stacked below the center column
  - `xl`: `280px minmax(0,1fr) 360px`
- Replace the current marketing-style hero with a compact workspace header.
- Keep capability/telemetry visible but secondary to the chat workflow.

### Persistent Data Contract

Persist exactly these fields and nothing transient:

- `activeChatId: string`
- `newChatDefaults`
  - `modelId: string`
  - `systemPrompt: string`
  - `inferenceSettings`
- `chats: ChatSession[]`
  - `id`
  - `title`
  - `isCustomTitle`
  - `createdAt`
  - `updatedAt`
  - `modelId`
  - `systemPrompt`
  - `inferenceSettings`
  - `draftMessage`
  - `messages: ChatMessage[]`

Use this message contract:

- `role`: `user | assistant`
- `content: string`
- `createdAt: number`
- `status` on assistant messages only: `complete | interrupted`

Do **not** persist:

- `runtimePhase`
- `warmState`
- `loadProgress`
- `loadStatus`
- `statusMessage`
- `telemetry`
- `currentError`
- transient streaming token buffer

### State Contract

- `ShowcaseState` must be split conceptually into:
  - persistent app/chat state
  - transient runtime state
- Replace flat single-prompt fields with active-chat derived selectors.
- Remove persistent dependence on `selectedPresetId`; prompt starters become stateless helpers that write into the active chat draft.
- `updatedAt` changes on create, rename, message completion/interruption, model change, system prompt change, and settings change — **not** on every draft keystroke.

### Persistence Contract

- Create a native IndexedDB adapter with database name `llmshowcase` and a single versioned record namespace for app state.
- Persist writes with a 300ms debounce.
- Hydration rules:
  - no stored document -> create one empty chat from global defaults
  - malformed or unsupported version -> discard and rebuild fresh safe state
  - missing `activeChatId` -> select the first chat by `updatedAt desc`
  - zero chats after hydration -> create one empty chat immediately

### Runtime Contract

- `GenerateRequest` must stop sending a single `prompt` string.
- Replace it with structured generation input:
  - `messages` (already including the `system` message as the first element)
  - `settings`
- The worker must stop using the current hidden generation prompt/defaults for real responses.
- `src/config/models.ts` remains the source of truth for model-level generation defaults.
- The worker converts camelCase UI settings into the snake_case fields expected by Transformers.js.
- Warmup may keep a separate internal warmup prompt, but it must be explicitly named as an internal warmup-only constant and never reused for user-visible generation.

### UX Contract

- Preset chips fill or transform the active draft only; they never auto-send.
- Composer behavior:
  - `Enter` sends
  - `Shift+Enter` inserts newline
  - send disabled when draft is blank or runtime is not ready
  - stop button replaces send while generation is active
- On user send:
  - append user message immediately
  - clear draft
  - render a streaming assistant bubble
- On stop:
  - preserve partial assistant content as an `interrupted` assistant message
- On browser reload during active generation:
  - do not restore transient streaming output
  - restore only completed/interrupted messages plus the last saved draft

## Implementation Tasks

### Task 1 — Replace single-turn state with persistent multi-chat domain state ✅ COMPLETE

**Files to create**

- `src/state/showcase-types.ts`

**Files to update**

- `src/state/showcase-reducer.ts`
- `src/state/showcase-selectors.ts`
- `src/test/state/showcase-reducer.test.ts`
- `src/test/state/showcase-types.test.ts` only if extracting type-driven helpers requires runtime coverage; otherwise skip this file

**Do exactly this**

- Create `src/state/showcase-types.ts` and export the canonical domain types:
  - `ChatRole = 'user' | 'assistant'`
  - `AssistantMessageStatus = 'complete' | 'interrupted'`
  - `ChatMessage`
  - `ChatSession`
  - `NewChatDefaults`
  - `PersistedShowcaseStateV1`
  - `HydrationStatus = 'booting' | 'ready' | 'failed'`
- Rework `ShowcaseState` so it contains two clearly separated regions:
  - persistent app/chat state: `activeChatId`, `newChatDefaults`, `chats`, `hydrationStatus`
  - transient runtime state: `runtimePhase`, `warmState`, `loadProgress`, `loadStatus`, `statusMessage`, `telemetry`, `currentError`, timestamps, token counts, `activeAssistantMessageId`, `activeGenerationInput`
- Remove the old single-turn fields from normal runtime usage:
  - `promptText`
  - `outputText`
  - `streamedOutput`
  - `selectedPresetId`
- Add reducer actions with these exact responsibilities:
  - `HYDRATE_SUCCESS`
  - `HYDRATE_FAILURE`
  - `CREATE_CHAT`
  - `SELECT_CHAT`
  - `RENAME_CHAT`
  - `DELETE_CHAT`
  - `SET_ACTIVE_CHAT_DRAFT`
  - `APPLY_PROMPT_STARTER`
  - `SET_ACTIVE_CHAT_MODEL`
  - `SET_ACTIVE_CHAT_SYSTEM_PROMPT`
  - `UPDATE_ACTIVE_CHAT_SETTINGS`
  - `RESET_ACTIVE_CHAT_SETTINGS_TO_DEFAULTS`
  - `SAVE_ACTIVE_CHAT_SETTINGS_AS_DEFAULTS`
  - `GENERATION_ENQUEUE`
  - `GENERATION_STREAM`
  - `GENERATION_COMPLETE`
  - `GENERATION_INTERRUPTED`
- `GENERATION_ENQUEUE` must:
  - receive the current draft text in the action payload
  - append the user message immediately to the active chat
  - clear the active chat draft
  - append an empty assistant placeholder message
  - store the placeholder id in `activeAssistantMessageId`
  - store a fully prepared `activeGenerationInput` built from the pre-stream snapshot so the current user turn is included exactly once
- `GENERATION_STREAM`, `GENERATION_COMPLETE`, and `GENERATION_INTERRUPTED` must update the assistant placeholder message directly; never recreate flat output fields.
- `DELETE_CHAT` must auto-create a fresh replacement chat from `newChatDefaults` when deleting the final remaining chat.
- `RENAME_CHAT` must set `isCustomTitle = true`.
- `APPLY_PROMPT_STARTER` must write into the active chat draft only and must not persist a selected-preset marker.
- Update selectors so all UI reads active-chat derived values instead of flat `promptText` / `outputText` state.

**QA scenarios**

- Tool: Vitest + Grep + LSP.
- Step 1: Run `npm run test -- --run src/test/state/showcase-reducer.test.ts`.
- Step 2: Assert exit code `0` and individual test coverage for create chat, select chat, rename chat, delete chat, replacement chat creation, draft updates, prompt starter application, per-chat settings updates, saving defaults, enqueue/send lifecycle, and interrupted assistant finalization.
- Step 3: Run a workspace content search for `promptText|outputText|streamedOutput|selectedPresetId` and confirm those symbols no longer appear in app/runtime UI files, except inside intentional migration code.
- Step 4: Run `lsp_diagnostics` on `src/state/showcase-reducer.ts` and `src/state/showcase-selectors.ts`.
- Pass condition: all reducer tests pass, the deprecated flat fields are removed from live UI/runtime code, and LSP reports zero errors.

### Task 2 — Add versioned IndexedDB persistence and hydration gating ✅ COMPLETE

**Files to create**

- `src/state/showcase-storage.ts`
- `src/test/state/showcase-storage.test.ts`
- `src/test/state/showcase-context.test.tsx`

**Files to update**

- `src/state/showcase-context.tsx`
- `src/test/setup.ts`
- `package.json`
- `src/test/state/showcase-reducer.test.ts`

**Do exactly this**

- Add `fake-indexeddb` as a dev dependency for unit tests.
- Register the IndexedDB test shim in `src/test/setup.ts`.
- Create `src/state/showcase-storage.ts` with these exports:
  - `loadPersistedShowcaseState()`
  - `savePersistedShowcaseState(state)`
  - `clearPersistedShowcaseState()`
  - `createFreshPersistedStateFromDefaults()`
- Use native IndexedDB with:
  - database name: `llmshowcase`
  - version: `1`
  - object store: `app-state`
  - record key: `root`
- `ShowcaseProvider` must boot with `hydrationStatus = 'booting'`, then asynchronously hydrate persisted state before the runtime starts probing/loading.
- `RuntimeInitializer` must not probe, load, switch, or generate until `hydrationStatus === 'ready'`.
- On hydrate success, dispatch `HYDRATE_SUCCESS` with either the stored document or a fresh document built from the locked defaults.
- On hydrate failure or malformed payload, discard the stored value, rebuild a safe fresh document, and dispatch `HYDRATE_FAILURE` only for user-visible telemetry/copy if needed; the app must still become usable.
- Persist only the locked persistent fields from the plan, with a 300ms debounced save.
- Do not persist transient runtime state, telemetry, progress bars, or streaming token buffers.

**QA scenarios**

- Tool: Vitest + LSP.
- Step 1: Run `npm run test -- --run src/test/state/showcase-storage.test.ts src/test/state/showcase-context.test.tsx`.
- Step 2: Assert exit code `0` and explicit passing cases for empty storage hydrate, valid `v1` hydrate, malformed payload recovery, zero-chat recovery, and debounced save behavior.
- Step 3: In `src/test/state/showcase-context.test.tsx`, simulate hydrate -> mutate -> re-hydrate and assert chats, drafts, active chat id, and defaults persist while runtime phase, load progress, and telemetry do not.
- Step 4: Run `lsp_diagnostics` on `src/state/showcase-storage.ts` and `src/state/showcase-context.tsx`.
- Pass condition: all persistence tests pass and LSP reports zero errors.

### Task 3 — Rewire the runtime contract around structured chat messages ✅ COMPLETE

**Files to create**

- `src/runtime/chat-request.ts`
- `src/runtime/generation-settings.ts`
- `src/test/runtime/chat-request.test.ts`
- `src/test/runtime/generation-settings.test.ts`

**Files to update**

- `src/runtime/inference-types.ts`
- `src/runtime/model-manager.ts`
- `src/components/runtime-initializer.tsx`
- `src/workers/inference.worker.ts`
- `src/test/runtime/model-manager.test.ts`

**Do exactly this**

- Update `src/runtime/inference-types.ts` to introduce:
  - `InferenceChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }`
  - `GenerateRequest` with `messages` and `settings` instead of `prompt`
- Create `src/runtime/chat-request.ts` with pure helpers that:
  - convert the active chat snapshot into worker-ready messages
  - prepend the active chat system prompt as the first `system` message
  - include only the latest 8 finalized user/assistant pairs from history
  - append the newly queued user message last
- Create `src/runtime/generation-settings.ts` with pure helpers that:
  - merge active-chat settings over model defaults
  - convert camelCase UI fields to the exact snake_case worker generation fields
- Store the prepared request payload in `activeGenerationInput` during `GENERATION_ENQUEUE`; `RuntimeInitializer` must consume that payload instead of reading the cleared draft.
- Change `ModelManager.generate()` to accept `(modelId, messages, settings)` and forward that request to the worker.
- Keep `ModelManager.switchModel()` as the only model transition path and let active-chat model changes continue to flow through `selectedModelId`-style selectors derived from the active chat.
- In `src/workers/inference.worker.ts`:
  - stop using the hidden `SYSTEM_PROMPT` constant for real generations
  - rename the existing constant to something warmup-specific if it remains for warmup only
  - apply `processor.apply_chat_template(messages, { add_generation_prompt: true })`
  - use `src/runtime/generation-settings.ts` helpers to map camelCase UI settings to the snake_case generation keys expected by Transformers.js
  - merge chat settings over model defaults from `src/config/models.ts`
- Preserve the current interrupt, streaming, and stale-request protections.

**QA scenarios**

- Tool: Vitest + LSP.
- Step 1: Run `npm run test -- --run src/test/runtime/chat-request.test.ts src/test/runtime/generation-settings.test.ts src/test/runtime/model-manager.test.ts`.
- Step 2: Assert exit code `0` and explicit passing cases proving the request builder puts the system message first, trims to the latest 8 finalized pairs, and appends the current user message exactly once.
- Step 3: Assert explicit passing cases proving `ModelManager.generate()` forwards `messages` and `settings`, ignores stale worker events, and still resolves interrupts correctly.
- Step 4: Assert explicit passing cases proving generation settings helpers use model defaults as the baseline and active-chat overrides win.
- Step 5: Run `lsp_diagnostics` on `src/runtime/inference-types.ts`, `src/runtime/chat-request.ts`, `src/runtime/generation-settings.ts`, `src/runtime/model-manager.ts`, `src/components/runtime-initializer.tsx`, and `src/workers/inference.worker.ts`.
- Pass condition: all runtime tests pass and LSP reports zero errors.

### Task 4 — Add a deterministic mock runtime path for Playwright and CI ✅ COMPLETE

**Files to create**

- `src/runtime/mock-model-manager.ts`
- `src/runtime/runtime-factory.ts`

**Files to update**

- `src/components/runtime-initializer.tsx`
- `playwright.config.ts`
- `tests/e2e/showcase.spec.ts`

**Do exactly this**

- Introduce a runtime factory that returns the real `ModelManager` by default and a deterministic `MockModelManager` when `process.env.NEXT_PUBLIC_E2E_MOCK_RUNTIME === '1'`.
- `MockModelManager` must simulate:
  - successful probe
  - model load start/progress/ready
  - streaming assistant tokens from a fixed canned response
  - interrupt producing a partial assistant message
- Do not attempt real WebGPU inference inside Playwright.
- Configure `playwright.config.ts` web server env to set `NEXT_PUBLIC_E2E_MOCK_RUNTIME=1`.
- Expand Playwright coverage so CI can validate user-visible behavior without GPU dependence.

**QA scenarios**

- Tool: Playwright.
- Step 1: Start the app through Playwright web server config with `NEXT_PUBLIC_E2E_MOCK_RUNTIME=1`.
- Step 2: Run `npm run test:e2e`.
- Step 3: Assert exit code `0`, HTML report generation, and no dependency on real WebGPU hardware.
- Step 4: Require explicit Playwright tests for create/select/rename/delete chat, per-chat settings persistence across reload, chat title generation from the first user message, interrupted assistant message persistence, corrupted persisted state recovery to a fresh safe chat, and automatic model switching when moving between chats on different models.
- Pass condition: the full Playwright suite passes under the mock runtime on a non-WebGPU machine.

### Task 5 — Replace the demo shell with a chat-first workspace ✅ COMPLETE

**Files to create**

- `src/components/sections/chat-sidebar.tsx`
- `src/components/sections/chat-thread.tsx`
- `src/components/sections/chat-composer.tsx`
- `src/components/sections/chat-settings-rail.tsx`
- `src/components/sections/system-prompt-panel.tsx`
- `src/components/sections/inference-settings-panel.tsx`

**Files to update**

- `src/app/app-shell.tsx`
- `src/components/sections/model-selector-card.tsx`
- `src/components/sections/preset-prompts.tsx`
- `src/components/sections/inference-panel.tsx`
- `src/components/sections/output-panel.tsx`
- `src/components/sections/capability-status-card.tsx`
- `src/components/sections/telemetry-panel.tsx`
- `src/app/globals.css`

**Do exactly this**

- Replace the current left-content/right-sidebar grid with the locked 3-pane workspace layout.
- `chat-sidebar.tsx` must provide:
  - new chat button
  - chat list sorted by `updatedAt desc`
  - inline rename affordance
  - delete affordance with disabled state during busy runtime
  - active chat highlight
  - stable test ids: `chat-sidebar`, `chat-item-{id}`, `new-chat-button`
- `chat-thread.tsx` must render:
  - empty state for a new chat
  - user bubbles
  - assistant bubbles
  - assistant `interrupted` status badge/treatment
  - scrolling container pinned to newest content while streaming
  - stable test ids: `chat-thread`, `chat-empty-state`, `message-user`, `message-assistant`, `message-interrupted`
- `chat-composer.tsx` must own:
  - active chat draft textarea
  - send button
  - stop button swap during generation
  - Enter vs Shift+Enter keyboard behavior
  - disabled states based on selectors
  - stable test ids: `chat-composer`, `chat-draft-input`, `chat-send-button`, `chat-stop-button`
- Convert `preset-prompts.tsx` from a card into lightweight prompt starter chips above the composer or at the top of the thread.
- Remove `inference-panel.tsx` and `output-panel.tsx` from the shell; keep them only if reused internally, otherwise convert or replace them fully with the new chat components.
- `chat-settings-rail.tsx` must vertically compose:
  - `ModelSelectorCard`
  - `SystemPromptPanel`
  - `InferenceSettingsPanel`
  - `CapabilityStatusCard`
  - `TelemetryPanel`
- `system-prompt-panel.tsx` edits the active chat system prompt snapshot.
- `inference-settings-panel.tsx` exposes locked controls:
  - primary controls: temperature, topP, repetitionPenalty, maxNewTokens
  - advanced disclosure: doSample, topK
  - buttons: `Reset chat to defaults`, `Save current settings as new-chat defaults`
- `chat-settings-rail.tsx`, `system-prompt-panel.tsx`, and `inference-settings-panel.tsx` must expose stable test ids: `chat-settings-rail`, `system-prompt-panel`, `inference-settings-panel`.
- Update supporting sections so telemetry and capability cards remain smaller, denser, and secondary.
- Update global styles only as needed to support:
  - workspace layout
  - chat bubbles
  - rail density
  - scroll behavior
  - no visual regression of the existing dark theme tokens

**QA scenarios**

- Tool: Playwright + LSP.
- Step 1: Run `npm run test:e2e` at desktop viewport.
- Step 2: Use the stable test ids from this task to assert `chat-sidebar`, `chat-thread`, `chat-composer`, and `chat-settings-rail` are visible together.
- Step 3: In Playwright, press `Enter` in `chat-draft-input` and assert send occurs; then press `Shift+Enter` and assert a newline is inserted instead of send.
- Step 4: Trigger generation in the mock runtime and assert `chat-send-button` is replaced by `chat-stop-button`, and that chat switching, model switching, delete, and settings controls are disabled during busy runtime phases.
- Step 5: Run `lsp_diagnostics` on all newly created section components.
- Pass condition: all desktop shell interactions pass in Playwright and LSP reports zero errors.

### Task 6 — Align status, metadata, and copy with productized chat positioning ✅ COMPLETE

**Files to update**

- `src/components/sections/hero-section.tsx`
- `src/components/sections/footer-info.tsx`
- `src/lib/copy.ts`
- `src/app/layout.tsx`
- `README.md`

**Do exactly this**

- Replace the oversized landing-style hero with a compact product header that frames the app as a local chat product, not a one-shot demo.
- Keep the privacy/local inference message, but rewrite it to fit the new shell.
- Update browser capability and error copy so it refers to chats, settings, and local persistence where relevant.
- Update page metadata title/description in `src/app/layout.tsx` to match the new product framing.
- Set exact metadata values in `src/app/layout.tsx`:
  - `title: 'LLM Showcase — Local WebGPU Chat'`
  - `description: 'A browser-local multi-chat Qwen playground with WebGPU inference, persistent local history, and adjustable generation settings.'`
- Rewrite `README.md` to include:
  - `## Features`
  - `## Browser Support`
  - `## Privacy`
  - `## Development`
  - `## Testing`
  - `## Limitations`
  - `## Screenshots`

**QA scenarios**

- Tool: Read + LSP.
- Step 1: Read `README.md` and verify the exact headings `## Features`, `## Browser Support`, `## Privacy`, `## Development`, `## Testing`, `## Limitations`, and `## Screenshots` are present.
- Step 2: Read `src/app/layout.tsx`, `src/components/sections/hero-section.tsx`, `src/components/sections/footer-info.tsx`, and `src/lib/copy.ts` and confirm they describe the product as a local chat app rather than a single-prompt demo.
- Step 3: Run `lsp_diagnostics` on those source files.
- Pass condition: all required headings exist, the copy matches the implemented product framing, and LSP reports zero errors.

### Task 7 — Add GitHub showcase assets and automation ✅ COMPLETE

**Files to create**

- `LICENSE`
- `.github/workflows/ci.yml`
- `public/readme/chat-workspace.png`
- `public/readme/settings-rail.png`
- `public/readme/chat-sidebar.png`

**Files to update**

- `README.md`

**Do exactly this**

- Add a committed `LICENSE` file using the MIT license to match the README claim.
- Add a GitHub Actions workflow that runs on push and pull_request with these steps in order:
  - checkout
  - setup-node `22` with npm cache
  - `npm ci`
  - `npm run lint`
  - `npm run test -- --run`
  - `npm run build`
- Do not include Playwright in CI for this pass unless the workflow also installs browsers and uses the mock runtime path reliably; keep CI stable over broad coverage.
- Capture and commit at least 3 README screenshots after implementation:
  - main chat workspace
  - settings rail
  - multi-chat sidebar state
- Capture those screenshots via Playwright `page.screenshot()` against the mock runtime after the final verification wave so asset generation is repeatable.
- Update README image references to those committed assets.

**QA scenarios**

- Tool: Read + Glob.
- Step 1: Verify `.github/workflows/ci.yml` exists and references only commands present in `package.json`.
- Step 2: Verify `LICENSE` exists at repo root and contains MIT license text.
- Step 3: Verify `public/readme/chat-workspace.png`, `public/readme/settings-rail.png`, and `public/readme/chat-sidebar.png` all exist in the repo tree.
- Step 4: Read `README.md` and confirm it references those exact asset paths.
- Pass condition: workflow, license, assets, and README references all exist and line up exactly.

## Final Verification Wave

1. Run `lsp_diagnostics` on every modified TS/TSX file and clear all errors.
2. Run `npm run lint` and require exit code `0`.
3. Run `npm run test -- --run` and require exit code `0` with no failed tests.
4. Run `npm run build` and require exit code `0`.
5. Run `npm run test:e2e` and require exit code `0` with Playwright HTML report generated.
6. Verify the new e2e coverage includes:
   - create/select/rename/delete chat
   - per-chat settings persistence across reload
   - automatic model switching across chats
   - stop behavior preserving interrupted partial assistant output
   - corrupted persisted state recovering to a fresh safe chat
7. Capture fresh README screenshots only after all checks above pass.

## Expected Outcome

After implementation, the repository should present as a polished local-chat showcase rather than a single-prompt demo:

- persistent local multi-chat shell
- real chat thread UX with streaming/interruption
- active-chat model/system/inference controls
- reproducible per-chat snapshots with global new-chat defaults
- preserved browser-local WebGPU pipeline
- updated README, LICENSE, screenshots, and CI suitable for publishing the repo proudly on GitHub
