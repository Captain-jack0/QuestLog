import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Icon, ICON_PATHS, type IconName } from './Icon'

describe('Icon', () => {
  it('draws a non-empty path and hides itself from assistive tech, for every name', () => {
    for (const name of Object.keys(ICON_PATHS) as IconName[]) {
      const html = renderToStaticMarkup(createElement(Icon, { name }))
      expect(html, name).toMatch(/<path d="[^"]+"/)
      expect(html, name).toContain('aria-hidden="true"')
    }
  })
})
