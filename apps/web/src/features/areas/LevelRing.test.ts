import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LevelRing } from './LevelRing'

describe('LevelRing', () => {
  it('is one labelled image: level, current XP and the XP that reaches the next level', () => {
    // lib/xp: level 2 starts at 283 XP, level 3 at 520.
    const html = renderToStaticMarkup(createElement(LevelRing, { totalXp: 420 }))
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Level 2, 420 of 520 XP"')
  })
})
