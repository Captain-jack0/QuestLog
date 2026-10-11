import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HEARTBEAT_MS,
  autoStoppedMessage,
  runHeartbeat,
  stopThenSignOut,
  type AutoStopped,
} from './autoStop'

describe('autoStoppedMessage', () => {
  it('names a single clock and what it paid', () => {
    expect(autoStoppedMessage([{ id: 'a', seconds: 1800, xp_awarded: 10 }])).toBe(
      'Your timer stopped while you were away — 30 min logged · +10 ✨',
    )
  })

  it('counts several clocks and leaves discarded ones out of the minutes', () => {
    expect(
      autoStoppedMessage([
        { id: 'a', seconds: 600, xp_awarded: 0 },
        { id: 'b', seconds: 40, xp_awarded: 0, discarded: true },
      ]),
    ).toBe('2 timers stopped while you were away — 10 min logged')
  })
})

describe('runHeartbeat', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const setup = (running: boolean, result: AutoStopped[] = [], visible = true) => {
    const targets = { doc: new EventTarget(), win: new EventTarget() }
    const beat = vi.fn(async () => result)
    const onAutoStopped = vi.fn()
    const stop = runHeartbeat({ beat, onAutoStopped, running, targets, isVisible: () => visible })
    return { targets, beat, onAutoStopped, stop }
  }

  it('beats once on mount even with no clock, and not again', async () => {
    const { beat } = setup(false)
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 3)
    expect(beat).toHaveBeenCalledTimes(1)
  })

  it('beats every minute while clocks run', async () => {
    const { beat } = setup(true)
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2)
    expect(beat).toHaveBeenCalledTimes(3)
  })

  it('beats when the page comes back into view, not when it hides', () => {
    const visible = setup(true)
    visible.targets.doc.dispatchEvent(new Event('visibilitychange'))
    visible.targets.win.dispatchEvent(new Event('pageshow'))
    expect(visible.beat).toHaveBeenCalledTimes(3)

    const hidden = setup(true, [], false)
    hidden.targets.doc.dispatchEvent(new Event('visibilitychange'))
    expect(hidden.beat).toHaveBeenCalledTimes(1)
  })

  it('stops beating once cleaned up', async () => {
    const { beat, targets, stop } = setup(true)
    stop()
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2)
    targets.doc.dispatchEvent(new Event('visibilitychange'))
    expect(beat).toHaveBeenCalledTimes(1)
  })

  it('reports what the server closed, and stays quiet when it closed nothing', async () => {
    const closed = [{ id: 'a', seconds: 600, xp_awarded: 0 }]
    const loud = setup(false, closed)
    const quiet = setup(false)
    await vi.advanceTimersByTimeAsync(0)
    expect(loud.onAutoStopped).toHaveBeenCalledWith(closed)
    expect(quiet.onAutoStopped).not.toHaveBeenCalled()
  })
})

describe('stopThenSignOut', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('stops first, then signs out', async () => {
    const calls: string[] = []
    await stopThenSignOut(
      async () => calls.push('stop'),
      async () => calls.push('signOut'),
    )
    expect(calls).toEqual(['stop', 'signOut'])
  })

  it('signs out even when the stop fails', async () => {
    const signOut = vi.fn(async () => {})
    await stopThenSignOut(() => Promise.reject(new Error('offline')), signOut)
    expect(signOut).toHaveBeenCalledOnce()
  })

  it('does not wait more than the timeout for a hanging stop', async () => {
    const signOut = vi.fn(async () => {})
    const done = stopThenSignOut(() => new Promise(() => {}), signOut, 3000)
    await vi.advanceTimersByTimeAsync(2999)
    expect(signOut).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await done
    expect(signOut).toHaveBeenCalledOnce()
  })
})
