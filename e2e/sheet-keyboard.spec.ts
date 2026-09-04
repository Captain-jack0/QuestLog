import { expect, test } from '@playwright/test'

/**
 * Bottom sheets are modal dialogs, so the keyboard has to behave like one: Tab stays inside,
 * Escape closes, and focus goes back to whatever opened the sheet. There is no jsdom in this
 * project, so this is the only place those checks — and the body scroll lock below — can run
 * against a real browser.
 */
test('a bottom sheet traps Tab and hands focus back on Escape', async ({ page }) => {
  const email = `sheet-${Date.now()}@example.com`

  await test.step('sign up', async () => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('questlog-sheet-1234')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
  })

  // Tall enough that the page really scrolls: a fresh account's Today screen is short, and a
  // page that cannot scroll would let a broken lock pass with everything at 0.
  await page.addStyleTag({ content: 'body::after{content:"";display:block;height:2000px}' })
  await page.evaluate(() => window.scrollTo(0, 400))
  const scrolledTo = await page.evaluate(() => window.scrollY)
  expect(scrolledTo, 'the page never scrolled, so the lock proves nothing').toBeGreaterThan(0)

  const opener = page.getByRole('button', { name: /Pick up to 3/ })
  await opener.click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await test.step('the page behind is pinned where it was', async () => {
    // `overflow: hidden` alone is what iOS Safari ignores, so assert the pin itself.
    const body = await page.evaluate(() => ({
      position: document.body.style.position,
      top: document.body.style.top,
    }))
    expect(body.position).toBe('fixed')
    expect(body.top).toBe(`-${scrolledTo}px`)
  })

  await test.step('Tab never leaves the sheet', async () => {
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      const inside = await page.evaluate(() => {
        const sheet = document.querySelector('[role="dialog"]')
        return Boolean(sheet && document.activeElement && sheet.contains(document.activeElement))
      })
      expect(inside, `focus escaped the sheet after ${i + 1} tabs`).toBe(true)
    }
    await page.keyboard.press('Shift+Tab')
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  await test.step('Escape closes it and the opener gets focus back', async () => {
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(opener).toBeFocused()
  })

  await test.step('closing unpins the body and gives the scroll position back', async () => {
    const body = await page.evaluate(() => ({
      position: document.body.style.position,
      top: document.body.style.top,
      overflow: document.body.style.overflow,
      scrollY: window.scrollY,
    }))
    expect(body.position).toBe('')
    expect(body.top).toBe('')
    expect(body.overflow).toBe('')
    expect(body.scrollY).toBe(scrolledTo)
  })
})
