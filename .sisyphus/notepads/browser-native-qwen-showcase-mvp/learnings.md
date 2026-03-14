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
