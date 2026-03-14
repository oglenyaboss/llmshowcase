# Decisions

## [2026-03-14] Initial Setup
- Following locked stack decisions from plan
- Vite + React + TypeScript
- Tailwind v4 via @tailwindcss/vite
- shadcn/ui for primitives

## [2026-03-14] User Request - Changed to Next.js
- User explicitly requested Next.js + Tailwind CSS template (replacing Vite)
- Using Next.js 14.2.x with App Router
- Using Tailwind v3.4.x (stable) instead of v4 (experimental)
- Client-side only app with 'use client' directive for WebGPU code
- Created directory structure for Web Workers and inference isolation
- Testing: Vitest + Playwright (no React plugin in vitest.config due to version conflicts)
