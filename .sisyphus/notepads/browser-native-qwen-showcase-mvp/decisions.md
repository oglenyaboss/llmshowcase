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

## [2026-03-14] Task 2: Tailwind + shadcn/ui Setup

### Design Decisions

#### Dark-First Theme
- Used HSL color values with CSS variables for dynamic theming
- Background: `222 47% 6%` (deep slate blue-gray)
- Primary accent: `217 91% 60%` (blue-500 equivalent)
- All semantic colors defined via CSS variables for consistency

#### Technical Aesthetic Utilities
Added custom utility classes in globals.css:
- `.grid-bg`: Subtle 24px grid pattern for technical feel
- `.surface`: Gradient surface treatment for cards
- `.tech-label`: Monospace uppercase labels for metadata
- `.console-output`: Monospace text for streaming output
- `.glow-subtle`: Subtle glow effect for interactive elements
- Custom scrollbar styling matching dark theme

#### Component Architecture
- All components use `class-variance-authority` for variant management
- Radix UI primitives for accessibility (progress, scroll-area, select, separator, slot, tooltip)
- `cn()` utility combines `clsx` (conditional classes) + `tailwind-merge` (deduplication)
- Forward refs properly implemented for all components

#### shadcn/ui Configuration
- `components.json` configured for Next.js + TypeScript
- Aliases set to `@/components` and `@/lib/utils`
- Tailwind config extended with CSS variable references
- `tailwindcss-animate` plugin for animations

### Files Created
- `components.json` - shadcn/ui configuration
- `src/lib/cn.ts` - Class merging utility
- `src/lib/utils.ts` - Standard shadcn utils
- `src/components/ui/badge.tsx` - Badge component
- `src/components/ui/button.tsx` - Button with variants
- `src/components/ui/card.tsx` - Card compound component
- `src/components/ui/progress.tsx` - Progress bar (Radix)
- `src/components/ui/scroll-area.tsx` - Custom scrollbar (Radix)
- `src/components/ui/select.tsx` - Dropdown select (Radix)
- `src/components/ui/separator.tsx` - Divider line (Radix)
- `src/components/ui/skeleton.tsx` - Loading placeholder
- `src/components/ui/textarea.tsx` - Text input area
- `src/components/ui/tooltip.tsx` - Hover tooltip (Radix)

### Dependencies Installed
- `lucide-react` - Icon library
- `clsx` - Conditional classnames
- `tailwind-merge` - Tailwind class deduplication
- `class-variance-authority` - Component variants
- `@radix-ui/react-progress` - Accessible progress
- `@radix-ui/react-scroll-area` - Custom scrollbars
- `@radix-ui/react-select` - Accessible select
- `@radix-ui/react-separator` - Divider component
- `@radix-ui/react-slot` - Composition primitive
- `@radix-ui/react-tooltip` - Accessible tooltips
- `tailwindcss-animate` - Animation utilities
