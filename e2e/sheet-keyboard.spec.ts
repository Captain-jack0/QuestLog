import { expect, test } from '@playwright/test'

/**
 * Bottom sheets are modal dialogs, so the keyboard has to behave like one: Tab stays inside,
 * Escape closes, and focus goes back to whatever opened the sheet. There is no jsdom in this
 * project, so this is the only place that check can run against a real browser.
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

  const opener = page.getByRole('button', { name: /Pick up to 3/ })
  await opener.click()
  await expect(page.getByRole('dialog')).toBeVisible()

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
})
