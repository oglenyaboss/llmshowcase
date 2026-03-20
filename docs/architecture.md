# Architecture Overview

LLM Showcase is a browser-native chat application that runs Qwen LLMs entirely client-side using WebGPU. This document describes the system architecture and key design decisions.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Main Thread)                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    React Application                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │   │
│  │  │   Sidebar   │  │  Chat View  │  │  Settings Rail  │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │   │
│  │         │                │                   │           │   │
│  │         └────────────────┼───────────────────┘           │   │
│  │                          ▼                                │   │
│  │              ┌───────────────────────┐                    │   │
│  │              │   ShowcaseProvider    │                    │   │
│  │              │   (React Context)     │                    │   │
│  │              └───────────┬───────────┘                    │   │
│  │                          │                                │   │
│  │                          ▼                                │   │
│  │              ┌───────────────────────┐                    │   │
│  │              │   showcaseReducer     │                    │   │
│  │              │   (State Machine)     │                    │   │
│  │              └───────────┬───────────┘                    │   │
│  │                          │                                │   │
│  └──────────────────────────┼────────────────────────────────┘   │
│                             │                                    │
│                             ▼                                    │
│              ┌───────────────────────┐                           │
│              │    ModelManager       │                           │
│              │   (Worker Facade)     │                           │
│              └───────────┬───────────┘                           │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           │ postMessage
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Web Worker (Dedicated Worker)                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    Transformers.js                          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │  │
│  │  │   Tokenizer  │  │   Processor  │  │  Qwen3.5 Model   │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘  │  │
│  │                          │                                  │  │
│  │                          ▼                                  │  │
│  │                   ┌─────────────┐                           │  │
│  │                   │   WebGPU    │                           │  │
│  │                   │  (GPU API)  │                           │  │
│  │                   └─────────────┘                           │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. State Layer (`src/state/`)

The application uses a unidirectional data flow inspired by Redux:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Action    │────▶│   Reducer   │────▶│    State    │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                                       │
       │                                       ▼
       │            ┌─────────────┐     ┌─────────────┐
       └────────────│  Dispatcher │◀────│  Selectors  │
                    └─────────────┘     └─────────────┘
```

**Key Files:**

| File | Purpose |
|------|---------|
| `showcase-context.tsx` | React context provider + hooks |
| `showcase-reducer.ts` | State machine with 25+ action types |
| `showcase-selectors.ts` | Derived state computation |
| `showcase-storage.ts` | IndexedDB persistence |
| `context-window.ts` | Token estimation for UI |

**State Shape:**

```typescript
interface ShowcaseState {
  // Persistent (IndexedDB)
  activeChatId: string
  newChatDefaults: NewChatDefaults
  chats: ChatSession[]
  
  // Transient (runtime only)
  runtimePhase: RuntimePhase
  warmState: WarmState
  telemetry: TelemetrySnapshot
  currentError: string | null
  // ...
}
```

### 2. Runtime Layer (`src/runtime/`)

Handles all WebGPU communication through a dedicated worker:

**ModelManager** — Facade pattern that:
- Manages worker lifecycle
- Tracks pending requests
- Handles cancellation
- Routes events to callbacks

**Worker Communication:**

```
Main Thread                    Worker
    │                            │
    │──── probe ────────────────▶│
    │◀─── probe_result ──────────│
    │                            │
    │──── load_model ───────────▶│
    │◀─── load_started ──────────│
    │◀─── load_progress ─────────│ (multiple)
    │◀─── warming_started ───────│
    │◀─── model_ready ───────────│
    │                            │
    │──── generate ─────────────▶│
    │◀─── generation_started ────│
    │◀─── stream_delta ──────────│ (multiple)
    │◀─── generation_complete ───│
```

### 3. UI Layer (`src/components/`)

Single-page layout with three regions:

```
┌────────────┬──────────────────────────┬──────────────┐
│            │                          │              │
│  Sidebar   │      Main Content        │   Settings   │
│  (272px)   │      (flexible)          │   Rail       │
│            │                          │   (320px)    │
│  - Chats   │  - Model selector        │  - System    │
│  - New     │  - Message thread        │    prompt    │
│  - Select  │  - Composer              │  - Inference │
│  - Rename  │  - Empty state           │    settings  │
│  - Delete  │                          │  - Context   │
│            │                          │    gauge     │
│            │                          │  - Telemetry │
│            │                          │              │
└────────────┴──────────────────────────┴──────────────┘
```

### 4. Persistence Layer

IndexedDB schema (v1):

```typescript
interface PersistedShowcaseStateV1 {
  version: 1
  activeChatId: string
  newChatDefaults: NewChatDefaults
  chats: ChatSession[]
}
```

**Hydration Flow:**

```
App Mount
    │
    ▼
ShowcaseProvider
    │
    ├──▶ loadPersistedShowcaseState()
    │         │
    │         ├──▶ Found? → HYDRATE_SUCCESS
    │         └──▶ Not found? → Create fresh state
    │
    ▼
State ready
    │
    └──▶ Auto-save on state change (debounced 300ms)
```

## Data Flow

### Chat Generation Flow

```
User types message
        │
        ▼
  draftMessage updated
        │
        ▼
User presses Enter
        │
        ▼
GENERATION_ENQUEUE action
        │
        ├──▶ User message added to chat
        ├──▶ Assistant placeholder created
        └──▶ activeAssistantMessageId set
        │
        ▼
buildGenerationInput()
        │
        ├──▶ Get recent messages (last 16)
        ├──▶ Add system prompt
        └──▶ Add new user message
        │
        ▼
ModelManager.generate()
        │
        ▼
Worker: model.generate() with TextStreamer
        │
        ├──▶ stream_delta events → GENERATION_STREAM
        └──▶ generation_complete → GENERATION_COMPLETE
        │
        ▼
Chat updated with final assistant message
```

### Model Switch Flow

```
User clicks model tab
        │
        ▼
SET_ACTIVE_CHAT_MODEL action
        │
        ├──▶ Update chat.modelId
        ├──▶ Reset inference settings to model defaults
        └──▶ Trigger runtime reset
        │
        ▼
RESET_FOR_MODEL_SWITCH action
        │
        ├──▶ runtimePhase → 'idle'
        ├──▶ warmState → 'cold'
        └──▶ Clear generation state
        │
        ▼
User can now load new model
```

## Key Design Decisions

### 1. Worker Isolation

**Why:** WebGPU operations are CPU/GPU intensive and can block the main thread. Running inference in a dedicated worker keeps the UI responsive.

**Trade-off:** Additional complexity for worker communication, but necessary for streaming responses.

### 2. Discriminated Union Actions

**Why:** TypeScript exhaustiveness checking ensures all action cases are handled.

```typescript
type ShowcaseAction =
  | { type: 'CREATE_CHAT'; payload?: { id?: string } }
  | { type: 'SELECT_CHAT'; payload: string }
  | { type: 'DELETE_CHAT'; payload: string }
  // ...

// Compiler error if any case is missing
switch (action.type) {
  case 'CREATE_CHAT': // ...
  case 'SELECT_CHAT': // ...
  // ...
  default:
    const _exhaustive: never = action // Type safety
}
```

### 3. Selector Pattern

**Why:** Encapsulates state access and enables memoization.

```typescript
// Bad: Direct access in component
const chat = state.chats.find(c => c.id === state.activeChatId)

// Good: Selector
const chat = selectActiveChat(state)
```

### 4. Token Estimation (Approximation)

**Why:** Accurate tokenization requires loading the model's tokenizer (large). We use a heuristic:

```typescript
const wordEstimate = wordCount * 1.33  // Words to tokens ratio
const characterEstimate = length / 4   // Characters to tokens
return Math.max(wordEstimate, characterEstimate)
```

**Trade-off:** Not precise, but good enough for UI gauge.

### 5. Dtype Fallback

**Why:** Some GPUs don't support certain quantization formats.

```typescript
// First attempt: all q4
const dtypeAttempt1 = {
  embed_tokens: 'q4',
  vision_encoder: 'q4',
  decoder_model_merged: 'q4',
}

// Fallback: fp16 vision encoder
const dtypeAttempt2 = {
  embed_tokens: 'q4',
  vision_encoder: 'fp16',
  decoder_model_merged: 'q4',
}
```

## Performance Considerations

### Bundle Size

- Next.js handles code splitting automatically
- Worker is loaded lazily on first probe
- Models are downloaded on-demand (cached in browser)

### Memory

- Only one model loaded at a time
- Chat history limited to last 16 messages for context
- IndexedDB stores unlimited chat history locally

### Rendering

- React 19 with concurrent features
- Selective re-renders via context splitting
- CSS animations respect `prefers-reduced-motion`

## Testing Strategy

### Unit Tests (Vitest)

- Runtime logic: token estimation, settings transformation
- State management: reducer, selectors, storage
- Fast, deterministic, no browser required

### E2E Tests (Playwright)

- Full UI workflows with mock runtime
- Deterministic responses via `NEXT_PUBLIC_E2E_MOCK_RUNTIME=1`
- Tests: chat CRUD, model switching, generation flow

## Limitations

1. **WebGPU Required** — No CPU/WASM fallback
2. **One Model at a Time** — Switching unloads previous model
3. **No VRAM Query** — Browsers don't expose actual VRAM
4. **Model Download** — First load downloads ~500MB-2GB
5. **4B Model Experimental** — May fail on integrated GPUs

## Future Considerations

- [ ] Add Error Boundaries for React error recovery
- [ ] Implement KV cache for faster repeated generation
- [ ] Add model caching to IndexedDB
- [ ] Support for custom models via HuggingFace URL
- [ ] Voice input/output integration