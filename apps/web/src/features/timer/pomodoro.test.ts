import { describe, expect, it } from 'vitest'
import {
  BREAK_SECONDS,
  FOCUS_SECONDS,
  formatDuration,
  formatMinutes,
  pomodoroPhase,
} from './pomodoro'

describe('pomodoroPhase', () => {
  it('starts in focus with the whole block ahead', () => {
    expect(pomodoroPhase(0)).toEqual({ phase: 'focus', remaining: FOCUS_SECONDS, completed: 0 })
  })

  it('counts down inside the focus block', () => {
    expect(pomodoroPhase(60)).toEqual({
      phase: 'focus',
      remaining: FOCUS_SECONDS - 60,
      completed: 0,
    })
  })

  it('flips to the break the second the block ends', () => {
    expect(pomodoroPhase(FOCUS_SECONDS)).toEqual({
      phase: 'break',
      remaining: BREAK_SECONDS,
      completed: 1,
    })
  })

  it('starts the next focus block after the break', () => {
    const cycle = FOCUS_SECONDS + BREAK_SECONDS
    expect(pomodoroPhase(cycle)).toEqual({ phase: 'focus', remaining: FOCUS_SECONDS, completed: 1 })
    expect(pomodoroPhase(cycle * 2 + 10).completed).toBe(2)
  })

  it('never reports a negative clock when the device clock jumps', () => {
    expect(pomodoroPhase(-30).remaining).toBe(FOCUS_SECONDS)
  })
})

describe('formatDuration', () => {
  it('shows mm:ss under an hour and h:mm:ss beyond', () => {
    expect(formatDuration(0)).toBe('00:00')
    expect(formatDuration(65)).toBe('01:05')
    expect(formatDuration(3600)).toBe('1:00:00')
    expect(formatDuration(3725)).toBe('1:02:05')
  })
})

describe('formatMinutes', () => {
  it('rounds to whole minutes, then to hours', () => {
    expect(formatMinutes(90)).toBe('2m')
    expect(formatMinutes(1500)).toBe('25m')
    expect(formatMinutes(6000)).toBe('1h 40m')
  })
})
