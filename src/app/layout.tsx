import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LLM Showcase — Local WebGPU Chat',
  description: 'A browser-local multi-chat Qwen playground with WebGPU inference, persistent local history, and adjustable generation settings.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}