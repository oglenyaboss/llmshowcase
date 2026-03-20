# LLM Showcase — Local-First WebGPU Chat

A browser-native Qwen showcase with WebGPU inference, persistent local history, adjustable generation controls, and an editorial production-ready interface.

## Features

- Editorial showcase layout with browser-native chat workspace
- Multi-chat sidebar with create, select, rename, and delete capabilities
- Streaming responses with interrupt support
- Persistent local history via IndexedDB
- Editable system prompt and saved generation defaults
- Adjustable inference settings (temperature, top-p, top-k, repetition penalty, max tokens)
- Cursor-style context window gauge with approximate prompt-budget tracking
- Browser-local WebGPU inference using Transformers.js & ONNX Runtime
- Telemetry rail for runtime, capabilities, and memory heuristics

## Browser Support

- Chrome 113+ (recommended)
- Edge 113+
- Safari with WebGPU enabled (experimental)

## Privacy

All data stays local. Your chats never leave your browser:

- No server calls for inference
- Chat history stored in IndexedDB locally
- Model weights downloaded once and cached
- Full privacy—no data leaves your device

## Showcase Entry Point

- `/` — canonical production showcase homepage

## Development

```bash
npm install
npm run dev     # Development server
npm run build   # Production build
npm run preview # Preview production build
```

## Testing

```bash
npm run test        # Unit tests with Vitest
npm run test:e2e    # E2E tests with Playwright (mock WebGPU runtime)
```

## Limitations

- One model loaded at a time
- WebGPU required—no CPU/WASM fallback
- Actual VRAM cannot be queried reliably from browsers
- Model weights downloaded on first load (may take time)
- 4B model experimental—may fail on integrated GPUs

## Production Notes

- Legacy numbered prototype routes have been removed in favor of a single canonical homepage
- Playwright E2E tests run against a mock runtime using `NEXT_PUBLIC_E2E_MOCK_RUNTIME=1`
- Metadata is configured for a public showcase landing page

## Screenshots

![Chat Workspace](./public/readme/chat-workspace.png)
![Settings Rail](./public/readme/settings-rail.png)
![Chat Sidebar](./public/readme/chat-sidebar.png)

## License

MIT
