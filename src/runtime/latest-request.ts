export class LatestRequestTracker {
  private currentRequestId: string | null = null

  start(requestId: string): void {
    this.currentRequestId = requestId
  }

  isCurrent(requestId: string): boolean {
    return this.currentRequestId === requestId
  }

  clear(requestId: string): void {
    if (this.currentRequestId === requestId) {
      this.currentRequestId = null
    }
  }

  reset(): void {
    this.currentRequestId = null
  }

  getCurrentRequestId(): string | null {
    return this.currentRequestId
  }
}
