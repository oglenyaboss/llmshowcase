'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useShowcaseState } from '@/state/showcase-context'
import { 
  selectIsProbing, 
  selectIsUnsupported, 
  selectHasError,
  selectIsReady 
} from '@/state/showcase-selectors'
import { cn } from '@/lib/utils'
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2,
  Cpu,
  Box,
  Thermometer
} from 'lucide-react'

export function CapabilityStatusCard() {
  const { state } = useShowcaseState()
  const isProbing = selectIsProbing(state)
  const isUnsupported = selectIsUnsupported(state)
  const hasError = selectHasError(state)
  const isReady = selectIsReady(state)
  const { telemetry, warmState } = state

  const getWebGPUStatus = () => {
    if (isProbing) return { icon: Loader2, label: 'Probing...', variant: 'secondary' as const }
    if (isUnsupported) return { icon: XCircle, label: 'Unavailable', variant: 'destructive' as const }
    if (hasError) return { icon: AlertCircle, label: 'Error', variant: 'destructive' as const }
    if (isReady || telemetry.backend !== '—') return { icon: CheckCircle2, label: 'Supported', variant: 'default' as const }
    return { icon: XCircle, label: 'Unsupported', variant: 'destructive' as const }
  }

  const getRuntimeStatus = () => {
    if (isProbing) return { icon: Loader2, label: 'Initializing...', variant: 'secondary' as const }
    if (isUnsupported) return { icon: XCircle, label: 'Not Available', variant: 'destructive' as const }
    if (hasError) return { icon: AlertCircle, label: 'Error', variant: 'destructive' as const }
    if (isReady) return { icon: CheckCircle2, label: 'Ready', variant: 'default' as const }
    return { icon: AlertCircle, label: 'Idle', variant: 'secondary' as const }
  }

  const getModelStatus = () => {
    if (warmState === 'warm') return { icon: CheckCircle2, label: 'Loaded', variant: 'default' as const }
    return { icon: AlertCircle, label: 'Not Loaded', variant: 'secondary' as const }
  }

  const getWarmStatus = () => {
    if (warmState === 'warm') return { icon: Thermometer, label: 'Warm', variant: 'default' as const }
    return { icon: Thermometer, label: 'Cold', variant: 'secondary' as const }
  }

  const webgpu = getWebGPUStatus()
  const runtime = getRuntimeStatus()
  const model = getModelStatus()
  const warm = getWarmStatus()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">System Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <div 
            data-testid="status-webgpu"
            className="flex items-center gap-2 rounded-lg border p-3"
          >
            <Cpu className={cn('h-4 w-4', isProbing && 'animate-spin')} />
            <div className="flex-1">
              <span className="tech-label block">WebGPU</span>
              <Badge variant={webgpu.variant} className="mt-1 text-xs">
                <webgpu.icon className="mr-1 h-3 w-3" />
                {webgpu.label}
              </Badge>
            </div>
          </div>

          <div 
            data-testid="status-runtime"
            className="flex items-center gap-2 rounded-lg border p-3"
          >
            <Box className="h-4 w-4" />
            <div className="flex-1">
              <span className="tech-label block">Runtime</span>
              <Badge variant={runtime.variant} className="mt-1 text-xs">
                <runtime.icon className={cn('mr-1 h-3 w-3', isProbing && 'animate-spin')} />
                {runtime.label}
              </Badge>
            </div>
          </div>

          <div 
            data-testid="status-model"
            className="flex items-center gap-2 rounded-lg border p-3"
          >
            <Box className="h-4 w-4" />
            <div className="flex-1">
              <span className="tech-label block">Model</span>
              <Badge variant={model.variant} className="mt-1 text-xs">
                <model.icon className="mr-1 h-3 w-3" />
                {model.label}
              </Badge>
            </div>
          </div>

          <div 
            data-testid="status-warm"
            className="flex items-center gap-2 rounded-lg border p-3"
          >
            <Thermometer className="h-4 w-4" />
            <div className="flex-1">
              <span className="tech-label block">Cache</span>
              <Badge variant={warm.variant} className="mt-1 text-xs">
                <warm.icon className="mr-1 h-3 w-3" />
                {warm.label}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
