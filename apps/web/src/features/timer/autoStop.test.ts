import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HEARTBEAT_MS,
  autoStoppedMessage,
  resolvePomodoro,
  runHeartbeat,
  stopThenSignOut,
  type AutoStopped,
  type AwaitingPomodoro,
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

  const setup = (
    running: boolean,
    result: AutoStopped[] = [],
    visible = true,
    awaiting: AwaitingPomodoro[] = [],
  ) => {
    const targets = { doc: new EventTarget(), win: new EventTarget() }
    const beat = vi.fn(async () => ({ auto_stopped: result, needs_confirm: awaiting }))
    const onAutoStopped = vi.fn()
    const onNeedsConfirm = vi.fn()
    const stop = runHeartbeat({
      beat,
      onAutoStopped,
      onNeedsConfirm,
      running,
      targets,
      isVisible: () => visible,
    })
    return { targets, beat, onAutoStopped, onNeedsConfirm, stop }
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

  it('asks about a pomodoro the server is holding, on the beat after the page wakes', async () => {
    const held: AwaitingPomodoro = {
      id: 'p',
      started_at: '2026-10-11T09:00:00Z',
      last_seen_at: '2026-10-11T09:10:00Z',
      project_title: 'Book',
      task_title: 'Chapter 3',
    }
    const asking = setup(true, [], true, [held])
    const quiet = setup(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(asking.onNeedsConfirm).toHaveBeenCalledWith([held])
    expect(asking.onAutoStopped).not.toHaveBeenCalled()
    asking.targets.doc.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(asking.onNeedsConfirm).toHaveBeenCalledTimes(2)
    expect(quiet.onNeedsConfirm).toHaveBeenCalledWith([])
  })

  it('syncs the list on every landed beat, so an answer from another tab clears it; a lost beat leaves it be', async () => {
    const held: AwaitingPomodoro = {
      id: 'p',
      started_at: '2026-10-11T09:00:00Z',
      last_seen_at: '2026-10-11T09:10:00Z',
      project_title: null,
      task_title: null,
    }
    const beats = [
      { auto_stopped: [], needs_confirm: [held] },
      null,
      { auto_stopped: [], needs_confirm: [] },
    ]
    const beat = vi.fn(async () => beats.shift() ?? null)
    const onNeedsConfirm = vi.fn()
    const onAutoStopped = vi.fn()
    const targets = { doc: new EventTarget(), win: new EventTarget() }
    runHeartbeat({ beat, onAutoStopped, onNeedsConfirm, running: true, targets })
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS * 2)
    expect(beat).toHaveBeenCalledTimes(3)
    expect(onNeedsConfirm.mock.calls).toEqual([[[held]], [[]]])
    expect(onAutoStopped).not.toHaveBeenCalled()
  })
})

describe('resolvePomodoro', () => {
  it('sends yes and no for that entry, and hands back the answer', async () => {
    const call = vi.fn(async (args: { p_entry_id: string; p_continued: boolean }) => ({
      data: { id: args.p_entry_id, resolved: true, continued: args.p_continued },
      error: null,
    }))
    expect(await resolvePomodoro(call, 'p', true)).toEqual({
      id: 'p',
      resolved: true,
      continued: true,
    })
    await resolvePomodoro(call, 'p', false)
    expect(call.mock.calls.map(([args]) => args)).toEqual([
      { p_entry_id: 'p', p_continued: true },
      { p_entry_id: 'p', p_continued: false },
    ])
  })

  it('throws what the server refused', async () => {
    const refused = { message: 'pomodoro not found', code: 'P0002' }
    await expect(
      resolvePomodoro(async () => ({ data: null, error: refused }), 'theirs', false),
    ).rejects.toBe(refused)
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
