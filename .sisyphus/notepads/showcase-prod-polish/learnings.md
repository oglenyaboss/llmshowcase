# Learnings - Showcase Production Polish

## [2026-03-15T21:50:00Z] Architecture Exploration

### Current State Architecture
- **showcase-reducer.ts**: Single-turn state with `promptText`, `outputText`, `streamedOutput`, `selectedPresetId`
- **showcase-selectors.ts**: 20+ selectors for flat values
- **showcase-context.tsx**: Uses `useReducer` with single context
- **NO showcase-types.ts exists** - types scattered across files

### Current Runtime Architecture
- **GenerateRequest** (inference-types.ts:117-122): Only has `prompt: string` - no messages array
- **SYSTEM_PROMPT**: Hardcoded in worker (inference.worker.ts:51-52)
- **GENERATION_DEFAULTS**: Hardcoded in worker (lines 57-64) - **NEVER uses model config**
- **ModelManager.generate()**: `generate(modelId: string, prompt: string)` - needs messages + settings

### Key Files to Modify
- `src/state/showcase-reducer.ts` - Add multi-chat actions
- `src/state/showcase-selectors.ts` - Add chat-aware selectors
- `src/runtime/inference-types.ts` - Add ChatMessage type, update GenerateRequest
- `src/workers/inference.worker.ts` - Accept messages + settings from request
- `src/runtime/model-manager.ts` - Update generate() signature

### Conventions
- Use `crypto.randomUUID()` for IDs (no UUID package)
- Types in `showcase-types.ts` for domain types
- Snake_case for worker/Transformers.js fields, camelCase for UI

## [2026-03-15T03:53:00Z] Task 1 Completed - Multi-Chat Domain State

### New Types Created (showcase-types.ts)
- `ChatRole = 'user' | 'assistant'`
- `AssistantMessageStatus = 'complete' | 'interrupted'`
- `HydrationStatus = 'booting' | 'ready' | 'failed'`
- `ChatMessage`, `ChatSession`, `NewChatDefaults`, `PersistedShowcaseStateV1`, `ActiveGenerationInput`
- `DEFAULT_SYSTEM_PROMPT` constant moved from worker to config

### State Architecture Changes
- **Persistent region**: `activeChatId`, `newChatDefaults`, `chats`, `hydrationStatus`
- **Transient region**: `runtimePhase`, `warmState`, `loadProgress`, `loadStatus`, `statusMessage`, `telemetry`, `currentError`, `generationStartedAt`, `loadStartedAt`, `tokenCount`, `activeAssistantMessageId`, `activeGenerationInput`
- **Removed**: `promptText`, `outputText`, `streamedOutput`, `selectedPresetId`, `selectedModelId`

### New Actions
- `HYDRATE_SUCCESS`, `HYDRATE_FAILURE` - persistence hydration
- `CREATE_CHAT`, `SELECT_CHAT`, `RENAME_CHAT`, `DELETE_CHAT` - chat CRUD
- `SET_ACTIVE_CHAT_DRAFT`, `APPLY_PROMPT_STARTER` - draft management
- `SET_ACTIVE_CHAT_MODEL`, `SET_ACTIVE_CHAT_SYSTEM_PROMPT`, `UPDATE_ACTIVE_CHAT_SETTINGS` - per-chat settings
- `RESET_ACTIVE_CHAT_SETTINGS_TO_DEFAULTS`, `SAVE_ACTIVE_CHAT_SETTINGS_AS_DEFAULTS` - settings management
- `GENERATION_ENQUEUE`, `GENERATION_STREAM`, `GENERATION_COMPLETE`, `GENERATION_INTERRUPTED` - generation lifecycle

### Key Implementation Details
- Initial state must create chat first, then use its ID for `activeChatId` (not two separate UUIDs)
- `GENERATION_ENQUEUE` only works from `ready` phase (enforced by reducer)
- Auto-title from first user message, truncated to 48 chars with ellipsis
- `DELETE_CHAT` auto-creates replacement when deleting last chat
- `RENAME_CHAT` sets `isCustomTitle = true` to prevent auto-title overwrite
- Generation input prepared at enqueue time with last 8 finalized pairs + new user message

### Selectors Pattern
- All UI reads from active chat via selectors (no direct state field access)
- `selectActiveChat*` selectors derive from `state.activeChatId` lookup
- `selectStreamedOutput` reads from active assistant message content
- `selectCanGenerate` checks both `runtimePhase === 'ready'` AND `hydrationStatus === 'ready'`

### Breaking Changes (UI Components)
Components using old selectors/actions need updates (Tasks 3-5):
- `selectSelectedModelId` → `selectActiveChatModelId`
- `selectPromptText` → `selectActiveChatDraft`
- `selectOutputText` → derived from `selectActiveChatMessages`
- `selectStreamedOutput` → still exists but reads from message
- `SELECT_MODEL` → `SET_ACTIVE_CHAT_MODEL`
- `SET_PROMPT` → `SET_ACTIVE_CHAT_DRAFT`
- `APPLY_PRESET` → `APPLY_PROMPT_STARTER`
- `GENERATION_START` → `GENERATION_ENQUEUE`
