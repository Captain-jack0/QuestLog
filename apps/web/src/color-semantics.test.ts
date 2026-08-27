import { describe, expect, it } from 'vitest'

/**
 * `flame` is the reward/pause colour (streaks, "Paused"); `alert` is the error colour.
 * Using flame for an error makes the streak badge and a validation failure the same orange.
 *
 * Only lines that *declare* their error semantics in the source are checked, so a match is
 * never a guess: `role="alert"` is ARIA saying "this is an error", `errors.x.message` is the
 * react-hook-form error body, `isError` is a failed query. A className cannot be classified
 * on its own, so cases without one of these markers (e.g. required-field asterisks) are out
 * of scope here by design — better uncovered than falsely flagged.
 */
const errorMarkers = [
  { name: 'role="alert"', pattern: /role="alert"/ },
  { name: 'form error message', pattern: /errors\.\w+\.message/ },
  { name: 'failed query', pattern: /\bisError\b/ },
]

// .tsx only: keeps this file (a .ts) out of its own scan.
const sources = import.meta.glob('./**/*.tsx', { query: '?raw', import: 'default', eager: true })

describe('colour semantics', () => {
  it('never paints a declared error with the flame (reward) colour', () => {
    const offenders = Object.entries(sources).flatMap(([file, source]) =>
      (source as string)
        .split('\n')
        .flatMap((line, i) =>
          line.includes('flame')
            ? errorMarkers
                .filter((m) => m.pattern.test(line))
                .map((m) => `${file}:${i + 1} — ${m.name} uses flame: ${line.trim()}`)
            : [],
        ),
    )

    expect(offenders).toEqual([])
  })

  it('still finds the markers it relies on (guards against a silently empty scan)', () => {
    const all = Object.values(sources).join('\n')
    for (const marker of errorMarkers) expect(all).toMatch(marker.pattern)
    expect(Object.keys(sources).length).toBeGreaterThan(20)
  })
})
