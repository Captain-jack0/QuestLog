import { describe, expect, it } from 'vitest'

/**
 * The keyboard focus ring is one global rule in index.css (`:focus-visible`). Any component
 * that sets `outline-none` deletes it for that control, and a 1px border tint is not a focus
 * indicator (WCAG 2.2 §2.4.11). Nothing in the tree needs `outline-none` today, so the guard
 * is simply: it does not come back without being argued for here.
 *
 * There is no jsdom in this project, so this reads the source tree as text rather than
 * rendering it. CSS is not covered: vitest stubs `.css` imports to an empty string, so the
 * global rule in index.css itself is not asserted here.
 */
const sources = import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', eager: true }) as Record<
  string,
  { default: string }
>

/** Files allowed to contain `outline-none`. Add a reason before adding a path. */
const allowed: string[] = []

describe('keyboard focus ring', () => {
  it('reads the source tree', () => {
    // Guards the guard: a glob that matches nothing would make the check below vacuous.
    expect(Object.keys(sources).length).toBeGreaterThan(50)
  })

  it('is not cancelled anywhere in the source tree', () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => !path.endsWith('.test.ts') && !allowed.includes(path))
      .flatMap(([path, mod]) =>
        mod.default
          .split('\n')
          .flatMap((text, i) => (text.includes('outline-none') ? [`${path}:${i + 1}`] : [])),
      )

    expect(offenders).toEqual([])
  })
})
