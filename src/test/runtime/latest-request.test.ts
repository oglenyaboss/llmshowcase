import { describe, it, expect } from 'vitest'
import { LatestRequestTracker } from '@/runtime/latest-request'

describe('LatestRequestTracker', () => {
  it('treats the newest request as current', () => {
    const tracker = new LatestRequestTracker()

    tracker.start('req-1')
    tracker.start('req-2')

    expect(tracker.isCurrent('req-1')).toBe(false)
    expect(tracker.isCurrent('req-2')).toBe(true)
  })

  it('does not clear a newer request when an older one finishes', () => {
    const tracker = new LatestRequestTracker()

    tracker.start('req-1')
    tracker.start('req-2')
    tracker.clear('req-1')

    expect(tracker.getCurrentRequestId()).toBe('req-2')
  })

  it('resets to no active request', () => {
    const tracker = new LatestRequestTracker()

    tracker.start('req-1')
    tracker.reset()

    expect(tracker.getCurrentRequestId()).toBeNull()
  })
})
