'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useShowcaseState } from '@/state/showcase-context'
import { selectTelemetry } from '@/state/showcase-selectors'
import { Activity, AlertCircle } from 'lucide-react'

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
          <div 
            data-testid="telemetry-runtime"
            className="rounded-lg border p-3"
          >
            <span className="tech-label block mb-2">Runtime</span>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Backend</span>
                <span className="font-mono">{telemetry.backend || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Library</span>
                <span className="font-mono">{telemetry.runtimeLibrary || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max Buffer</span>
                <span className="font-mono">{telemetry.maxBufferSize || '—'}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <span className="tech-label block mb-2">Performance</span>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Load Time</span>
                <span className="font-mono">
                  {telemetry.loadDurationMs ? `${telemetry.loadDurationMs}ms` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Warmup</span>
                <span className="font-mono">
                  {telemetry.warmupDurationMs ? `${telemetry.warmupDurationMs}ms` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tokens/sec</span>
                <span className="font-mono">
                  {telemetry.approxTokensPerSecond 
                    ? `${telemetry.approxTokensPerSecond.toFixed(1)}` 
                    : '—'}
                </span>
              </div>
            </div>
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
