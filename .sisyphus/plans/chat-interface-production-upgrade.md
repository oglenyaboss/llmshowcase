# Chat Interface Production Upgrade

## Goal

Turn the current single-prompt browser demo into a production-leaning chat experience inspired by ChatGPT and LM Studio, while keeping the existing browser-local WebGPU model loading pipeline intact.

## Current State

- `src/app/app-shell.tsx` renders a marketing/demo layout composed of separate cards.
- `src/state/showcase-reducer.ts` stores one `promptText`, one `outputText`, and one `streamedOutput`.
- `src/components/runtime-initializer.tsx` triggers `ModelManager.generate(selectedModelId, promptText)` when `runtimePhase === 'generating'`.
- `src/runtime/model-manager.ts` forwards a `generate` worker request with only `{ modelId, prompt }`.
- `src/workers/inference.worker.ts` builds the chat template from a hidden `SYSTEM_PROMPT` constant plus one user message and uses hardcoded `GENERATION_DEFAULTS`.
- `src/config/models.ts` already defines per-model `generationDefaults`, but the UI does not expose them.

## Constraints

- Preserve current probe / load / warmup / stream / interrupt flow.
- Keep telemetry and model switching functional.
- Do not add type suppressions.
- Keep the first pass focused on a single in-memory conversation, not multi-session persistence.
- Keep production-leaning UX: clear controls, sensible defaults, reset affordances, and empty/loading/error states.

## Implementation Plan

### 1. Expand state to represent a chat session

Update `src/state/showcase-reducer.ts` and related selectors/tests to replace the single prompt/output model with:

- `chatMessages: ChatMessage[]`
- `draftMessage: string`
- `streamingAssistantMessage: string`
- `systemPrompt: string`
- `inferenceSettings: GenerationDefaults`
- existing preset selection retained for quickly seeding the draft

Define message types so the UI and runtime can distinguish `system`, `user`, and `assistant` roles. Keep the system prompt editable in state, but do not render it as a normal chat bubble.

Reducer actions should cover:

- draft edits
- preset application
- system prompt edits
- inference setting updates
- inference setting reset from selected model defaults
- message enqueue on generation start
- assistant streaming updates
- assistant completion / interruption
- clearing chat without unloading the model

### 2. Wire structured chat payloads through runtime

Update `src/runtime/inference-types.ts`, `src/runtime/model-manager.ts`, `src/components/runtime-initializer.tsx`, and `src/workers/inference.worker.ts` so generation uses structured inputs:

- full conversation history (system + prior user/assistant turns + current user turn)
- editable system prompt
- current inference settings

Implementation details:

- replace the worker `GenerateRequest.prompt` field with `messages`, `systemPrompt`, and `settings`
- preserve streaming semantics and interruption support
- keep warmup lightweight, but build warmup prompts with the active system prompt helper rather than a duplicated hidden constant path
- continue using model defaults as the baseline when a model is selected or switched

### 3. Redesign the shell into a real chat workspace

Refactor `src/app/app-shell.tsx` and section components into a chat-first layout:

- main column: workspace header, preset chips, scrollable conversation area, empty state, composer, send/stop controls
- side column: model selector, system prompt editor, inference controls, runtime/capability status, telemetry

This should feel like a focused application surface rather than stacked demo cards.

### 4. Replace single prompt/output cards with chat-native components

Refactor or replace `src/components/sections/inference-panel.tsx`, `src/components/sections/output-panel.tsx`, and `src/components/sections/preset-prompts.tsx` with chat-native components that:

- render user and assistant messages with distinct treatments
- show live assistant streaming in the conversation view
- keep preset prompts as lightweight conversation starters
- support keyboard send with multiline compose preserved
- expose clear chat and reset settings actions where appropriate

### 5. Keep supporting panels product-usable

Update adjacent UI copy/components (`hero-section`, metadata, status text where needed) so the page reads like a local chat product instead of a single-prompt showcase. Keep telemetry and capability information accessible in the sidebar without dominating the experience.

### 6. Verification

Run and fix issues from:

- `lsp_diagnostics` on all modified files
- targeted unit tests for reducer/runtime updates
- `npm run test`
- `npm run lint`
- `npm run build`

## Expected Outcome

After implementation, the app should support a real multi-turn in-memory chat flow with:

- a modern chat interface
- editable system prompt
- editable inference parameters
- model-specific defaults that reset cleanly on model switch
- preserved browser-local streaming, stop, and telemetry behavior

## Non-Goals For This Pass

- persisted conversation history
- multiple named chats or folders
- server sync / authentication
- prompt library management beyond the existing preset starters
