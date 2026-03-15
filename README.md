# LLM Showcase — Local WebGPU Chat

A browser-local multi-chat Qwen playground with WebGPU inference, persistent local history, and adjustable generation settings.

## Features

- Multi-chat sidebar with create, select, rename, and delete capabilities
- Chat-first workspace with streaming responses
- Persistent local history via IndexedDB
- Editable system prompt
- Adjustable inference settings (temperature, max tokens, top-p)
- Browser-local WebGPU inference using Transformers.js & ONNX Runtime

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

## Screenshots

![Chat Workspace](./public/readme/chat-workspace.png)
![Settings Rail](./public/readme/settings-rail.png)
![Chat Sidebar](./public/readme/chat-sidebar.png)

## License

MIT