'use client'

import { Badge } from '@/components/ui/badge'
import { Cpu, Zap } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="py-8 md:py-12">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Cpu className="h-5 w-5 text-primary" />
          </div>
          <Badge variant="secondary" className="font-mono text-xs">
            <Zap className="mr-1 h-3 w-3" />
            WebGPU Powered
          </Badge>
        </div>
        
        <h1 
          data-testid="hero-heading"
          className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl"
        >
          Browser-Native{' '}
          <span className="text-primary">Qwen Inference</span>
        </h1>
        
        <p className="max-w-2xl text-muted-foreground md:text-lg">
          Run Qwen 3.5 language models entirely in your browser using WebGPU. 
          No server required—your data stays local.
        </p>
      </div>
    </section>
  )
}
