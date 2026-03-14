'use client'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-4">LLM Showcase</h1>
        <p className="text-lg text-slate-300">Browser-only WebGPU inference</p>
      </div>
    </main>
  )
}