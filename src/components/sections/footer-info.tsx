'use client'

import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Shield, Lock, Cpu } from 'lucide-react'

export function FooterInfo() {
  return (
    <footer className="py-6">
      <Separator className="mb-6" />
      <div 
        data-testid="footer-local-inference"
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="text-sm font-medium">Local Inference</span>
              <p className="text-xs text-muted-foreground">
                Your data never leaves your browser
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="font-mono text-xs">
            <Lock className="mr-1 h-3 w-3" />
            Private
          </Badge>
          <Badge variant="outline" className="font-mono text-xs">
            <Cpu className="mr-1 h-3 w-3" />
            WebGPU
          </Badge>
          <span className="text-xs text-muted-foreground">
            Powered by Transformers.js & ONNX Runtime
          </span>
        </div>
      </div>
    </footer>
  )
}
