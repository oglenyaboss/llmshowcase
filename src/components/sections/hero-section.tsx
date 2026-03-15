'use client'

import { Badge } from '@/components/ui/badge'
import { Cpu, Zap } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="py-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Cpu className="h-4 w-4 text-primary" />
          </div>
          <Badge variant="secondary" className="font-mono text-xs">
            <Zap className="mr-1 h-3 w-3" />
            WebGPU
          </Badge>
        </div>
        
        <h1 
          data-testid="hero-heading"
          className="text-xl font-semibold tracking-tight"
        >
          Local WebGPU Chat
        </h1>
        
        <p className="text-sm text-muted-foreground">
          Browser-local Qwen chat with privacy-first design. Your chats stay on your device.
        </p>
      </div>
    </section>
  )
}
