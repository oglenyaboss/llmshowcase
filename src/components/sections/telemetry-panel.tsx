'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useShowcaseState } from '@/state/showcase-context'
import { selectTelemetry } from '@/state/showcase-selectors'
import { Activity, AlertCircle } from 'lucide-react'
import { formatDuration } from '@/lib/format'

function formatBoolean(value: boolean): string {
  return value ? 'Yes' : 'No'
}

function formatTokensPerSecond(value: number | null): string {
  if (value === null) return 'N/A'
  return `${value.toFixed(1)} t/s`
}

export function TelemetryPanel() {
  const { state } = useShowcaseState()
  const telemetry = selectTelemetry(state)

  const hasError = telemetry.lastError !== null

  return (
    <Card data-testid="telemetry-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Telemetry</CardTitle>
          <Badge variant="secondary" className="font-mono text-xs">
            <Activity className="mr-1 h-3 w-3" />
            Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="rounded-lg border p-3">
            <span className="tech-label block mb-2">Model</span>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Label</span>
                <span className="font-mono">{telemetry.selectedModelLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Repository</span>
                <span className="font-mono text-xs truncate max-w-[180px]">
                  {telemetry.selectedModelRepoId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Support Tier</span>
                <Badge
                  variant={telemetry.supportTier === 'stable' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {telemetry.supportTier}
                </Badge>
              </div>
            </div>
          </div>

          <div
            data-testid="telemetry-runtime"
            className="rounded-lg border p-3"
          >
            <span className="tech-label block mb-2">Runtime</span>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Library</span>
                <span className="font-mono">{telemetry.runtimeLibrary}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Backend</span>
                <span className="font-mono">{telemetry.backend}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phase</span>
                <span className="font-mono">{telemetry.runtimePhase}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Warm State</span>
                <span className="font-mono">{telemetry.warmState}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <span className="tech-label block mb-2">Capabilities</span>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">shader-f16</span>
                <span className="font-mono">{formatBoolean(telemetry.shaderF16Support)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Buffer</span>
                <span className="font-mono">{telemetry.maxBufferSize}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Storage Buffer</span>
                <span className="font-mono">{telemetry.maxStorageBufferBindingSize}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <span className="tech-label block mb-2">Performance</span>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Load Duration</span>
                <span className="font-mono">
                  {formatDuration(telemetry.loadDurationMs)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Warmup Duration</span>
                <span className="font-mono">
                  {formatDuration(telemetry.warmupDurationMs)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Generation Duration</span>
                <span className="font-mono">
                  {formatDuration(telemetry.generationDurationMs)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Token Count</span>
                <span className="font-mono">{telemetry.approxTokenCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tokens/sec</span>
                <span className="font-mono">
                  {formatTokensPerSecond(telemetry.approxTokensPerSecond)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <span className="tech-label block mb-2">Memory</span>
            <p className="text-sm text-muted-foreground">
              {telemetry.heuristicMemoryNote}
            </p>
          </div>

          {hasError && (
            <div
              data-testid="telemetry-error"
              className="rounded-lg border border-destructive/50 bg-destructive/10 p-3"
            >
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Last Error</span>
              </div>
              <p className="mt-1 text-xs text-destructive/80">
                {telemetry.lastError}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
