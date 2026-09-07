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

  // The three tests above inject their targets, so the default `{ doc: document, win: window }`
  // never runs under them — swap the two and all three stay green while bfcache restores go
  // dead in production (`pageshow` is dispatched on Window; a listener on Document never sees
  // it). The seam made the unbreakable part testable and left the breakable part exposed. This
  // one runs the real default by standing in for the globals for the length of the test — no
  // jsdom needed, EventTarget is built in.
  it('binds the defaults the right way round: visibilitychange on document, pageshow on window', () => {
    const doc = new EventTarget()
    const win = new EventTarget()
    const saved = { document: globalThis.document, window: globalThis.window }
    Object.assign(globalThis, { document: doc, window: win })

    try {
      let woke = 0
      const off = onPageWake(() => woke++)

      // Each event on the *wrong* target first: a swapped default would catch these.
      win.dispatchEvent(new Event('visibilitychange'))
      doc.dispatchEvent(new Event('pageshow'))
      expect(woke).toBe(0)

      doc.dispatchEvent(new Event('visibilitychange'))
      win.dispatchEvent(new Event('pageshow'))
      expect(woke).toBe(2)

      off()
    } finally {
      Object.assign(globalThis, saved)
    }
  })
})
