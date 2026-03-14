'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useShowcaseState } from '@/state/showcase-context'
import {
  selectIsProbing,
  selectIsUnsupported,
  selectHasError,
  selectIsReady,
  selectIsLoading
} from '@/state/showcase-selectors'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Cpu,
  Box,
  Thermometer,
  AlertTriangle
} from 'lucide-react'

export function CapabilityStatusCard() {
  const { state } = useShowcaseState()
  const isProbing = selectIsProbing(state)
  const isUnsupported = selectIsUnsupported(state)
  const hasError = selectHasError(state)
  const isReady = selectIsReady(state)
  const isLoading = selectIsLoading(state)
  const { telemetry, warmState, runtimePhase, currentError } = state

  const getWebGPUStatus = () => {
    if (isProbing) return { icon: Loader2, label: 'Probing...', variant: 'secondary' as const, available: null }
    if (isUnsupported) return { icon: XCircle, label: 'Unavailable', variant: 'destructive' as const, available: false }
    if (hasError) return { icon: AlertCircle, label: 'Error', variant: 'destructive' as const, available: false }
    if (telemetry.shaderF16Support || telemetry.backend === 'WebGPU') return { icon: CheckCircle2, label: 'Available', variant: 'default' as const, available: true }
    return { icon: XCircle, label: 'Unsupported', variant: 'destructive' as const, available: false }
  }

  const getRuntimeStatus = () => {
    const phaseLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      idle: { label: 'Idle', variant: 'secondary' },
      probing: { label: 'Probing...', variant: 'secondary' },
      unsupported: { label: 'Unsupported', variant: 'destructive' },
      loading_model: { label: 'Loading Model...', variant: 'secondary' },
      warming_model: { label: 'Warming...', variant: 'secondary' },
      ready: { label: 'Ready', variant: 'default' },
      generating: { label: 'Generating...', variant: 'default' },
      stopping: { label: 'Stopping...', variant: 'secondary' },
      error: { label: 'Error', variant: 'destructive' },
    }

    const phase = phaseLabels[runtimePhase] || { label: 'Unknown', variant: 'secondary' }

    if (isProbing) return { icon: Loader2, label: phase.label, variant: phase.variant }
    if (isUnsupported) return { icon: XCircle, label: phase.label, variant: phase.variant }
    if (hasError) return { icon: AlertCircle, label: phase.label, variant: phase.variant }
    if (isReady) return { icon: CheckCircle2, label: phase.label, variant: phase.variant }
    return { icon: AlertCircle, label: phase.label, variant: phase.variant }
  }

  const getModelStatus = () => {
    if (isLoading) return { icon: Loader2, label: 'Loading...', variant: 'secondary' as const }
    if (warmState === 'warm') return { icon: CheckCircle2, label: telemetry.selectedModelLabel, variant: 'default' as const }
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

  // Determine if we should show unsupported message
  const showUnsupportedMessage = isUnsupported

  // Determine if we should show adapter unavailable message
  const showAdapterUnavailableMessage = !isUnsupported && !isProbing && webgpu.available === false && !hasError

  // Determine if we should show error message with recovery
  const showErrorMessage = hasError && currentError

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">System Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div
            data-testid="status-webgpu"
            className="flex items-center gap-2 rounded-lg border p-3"
          >
            <Cpu className={cn('h-4 w-4', isProbing && 'animate-spin')} />
            <div className="flex-1">
              <span className="tech-label block">WebGPU</span>
              <Badge variant={webgpu.variant} className="mt-1 text-xs">
                <webgpu.icon className={cn('mr-1 h-3 w-3', isProbing && 'animate-spin')} />
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
                <model.icon className={cn('mr-1 h-3 w-3', isLoading && 'animate-spin')} />
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

        {showUnsupportedMessage && (
          <Alert variant="destructive" data-testid="unsupported-alert">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>WebGPU Unavailable</AlertTitle>
            <AlertDescription>
              WebGPU is unavailable in this browser. Try the latest Chrome, Edge, or Safari on a newer GPU-capable device.
            </AlertDescription>
          </Alert>
        )}

        {showAdapterUnavailableMessage && (
          <Alert variant="warning" data-testid="adapter-unavailable-alert">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>GPU Adapter Not Found</AlertTitle>
            <AlertDescription>
              This browser exposed the WebGPU API, but no compatible GPU adapter could be created.
            </AlertDescription>
          </Alert>
        )}

        {showErrorMessage && (
          <Alert variant="destructive" data-testid="error-alert">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Runtime Error</AlertTitle>
            <AlertDescription>
              {currentError}
              <div className="mt-2 text-xs">
                Try refreshing the page or selecting a different model. If the problem persists, your device may not have sufficient resources.
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
