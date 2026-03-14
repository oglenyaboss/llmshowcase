# Browser-Native Qwen WebGPU Showcase

A single-page portfolio demo showcasing local Qwen inference directly in the browser via WebGPU.

## Install

```bash
npm install
```

## Run

```bash
npm run dev     # Development server
npm run build   # Production build
npm run preview # Preview production build
```

## Tested browsers

- Chrome 113+ (recommended)
- Edge 113+
- Safari with WebGPU enabled (experimental)

## Model Tiers

| Model | Status | VRAM | Notes |
|-------|--------|------|-------|
| Qwen 3.5 0.8B | Stable | ~1-2 GB | Best for most devices |
| Qwen 3.5 2B | Stable | ~3-4 GB | Better quality |
| Qwen 3.5 4B | Experimental | ~5-6 GB | May fail on integrated GPUs |

## Known limitations

- Actual VRAM cannot be queried reliably from browsers
- 4B model is experimental and may fail or stall
- No silent CPU/WASM fallback - WebGPU only
- Single-prompt showcase (not multi-turn chat)
- First load downloads model weights (may take time)

## V2 Roadmap

- [ ] Multi-turn conversation mode
- [ ] Prompt parameter tuning UI
- [ ] Model comparison mode
- [ ] Export/share outputs
- [ ] Offline PWA support

## License

MIT