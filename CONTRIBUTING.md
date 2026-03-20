# Contributing to LLM Showcase

Thank you for your interest in contributing! This document provides guidelines and instructions.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/llmshowcase.git
cd llmshowcase

# Install dependencies
npm install

# Start development server
npm run dev
```

## Prerequisites

- Node.js 22+
- npm 10+
- Chrome 113+ or Edge 113+ (for WebGPU support)

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── layout.tsx          # Root layout with metadata
│   └── page.tsx            # Homepage with JSON-LD schema
├── components/             # React components
│   ├── showcase-page-client.tsx  # Main client component
│   └── runtime-initializer.tsx   # WebGPU runtime bootstrap
├── config/                 # Configuration
│   ├── models.ts           # Model registry (Qwen variants)
│   └── presets.ts          # Prompt presets
├── lib/                    # Utility functions
│   ├── assistant-content.ts # Parse thinking blocks
│   └── format.ts           # Formatting utilities
├── runtime/                # Inference runtime
│   ├── model-manager.ts    # Worker facade
│   ├── worker-client.ts    # Worker communication
│   ├── inference-types.ts  # Type definitions
│   ├── generation-settings.ts # Settings transformation
│   ├── telemetry.ts        # Runtime metrics
│   └── mock-model-manager.ts # E2E mock runtime
├── state/                  # Application state
│   ├── showcase-context.tsx  # React context + provider
│   ├── showcase-reducer.ts   # State reducer
│   ├── showcase-types.ts     # State types
│   ├── showcase-selectors.ts # Selector functions
│   ├── showcase-storage.ts   # IndexedDB persistence
│   └── context-window.ts     # Token estimation
├── workers/                # Web Workers
│   └── inference.worker.ts   # WebGPU inference worker
└── test/                   # Test files
    ├── runtime/            # Runtime unit tests
    ├── state/              # State unit tests
    ├── lib/                # Library unit tests
    └── setup.ts            # Test configuration
```

## Architecture

See [docs/architecture.md](./docs/architecture.md) for a detailed overview.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:ui` | Run tests with UI |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:e2e` | Run E2E tests (Playwright) |

## Testing

### Unit Tests

```bash
npm run test
```

We use Vitest with React Testing Library. Tests are located in `src/test/` mirroring the source structure.

### E2E Tests

```bash
npm run test:e2e
```

E2E tests use Playwright with a mock runtime (`NEXT_PUBLIC_E2E_MOCK_RUNTIME=1`) for deterministic testing.

## Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Run `npm run lint` before committing
- **Formatting**: No Prettier config — follow existing patterns

### Key Patterns

1. **Discriminated unions** for actions and events
2. **Selector pattern** for state access
3. **Worker facade** for WebGPU isolation
4. **IndexedDB** for persistence

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Run tests: `npm run test && npm run lint`
4. Update documentation if needed
5. Submit PR with a clear description

### PR Checklist

- [ ] Tests pass locally
- [ ] Lint passes
- [ ] Build succeeds
- [ ] Documentation updated (if applicable)

## Adding New Models

1. Add model config to `src/config/models.ts`:

```typescript
const newModel: ModelConfig = {
  id: 'model-id',
  label: 'Model Label',
  repoId: 'huggingface/repo-id',
  tier: 'stable' | 'experimental',
  supportsThinking: boolean,
  description: 'Model description',
  contextWindowTokens: number,
  memoryNote: 'VRAM requirement',
  recommendedFor: 'Use case',
  dtype: { embed_tokens: 'q4', vision_encoder: 'q4', decoder_model_merged: 'q4' },
  generationDefaults: { /* ... */ },
}
```

2. Register in `models` object and `modelList` array
3. Add tests for model-specific behavior

## Browser Support

Target browsers:
- Chrome 113+
- Edge 113+
- Safari with WebGPU enabled (experimental)

Firefox is not supported (no WebGPU as of 2026).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.