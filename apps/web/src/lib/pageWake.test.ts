import { describe, expect, it } from 'vitest'
import { onPageWake } from './pageWake'

/** Stands in for `document`/`window`; EventTarget is built in, so no DOM is needed. */
function targets() {
  return { doc: new EventTarget(), win: new EventTarget() }
}

describe('onPageWake', () => {
  it('fires when the tab changes visibility', () => {
    const t = targets()
    let woke = 0
    onPageWake(() => woke++, t)

    t.doc.dispatchEvent(new Event('visibilitychange'))

    expect(woke).toBe(1)
  })

  it('fires when the page is restored from the back/forward cache', () => {
    const t = targets()
    let woke = 0
    onPageWake(() => woke++, t)

    t.win.dispatchEvent(new Event('pageshow'))

    expect(woke).toBe(1)
  })

  it('stops firing once unsubscribed, so a remount cannot stack listeners', () => {
    const t = targets()
    let woke = 0
    const off = onPageWake(() => woke++, t)

    off()
    t.doc.dispatchEvent(new Event('visibilitychange'))
    t.win.dispatchEvent(new Event('pageshow'))

    expect(woke).toBe(0)
  })
})
