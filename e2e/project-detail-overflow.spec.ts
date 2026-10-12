import { expect, test } from '@playwright/test'

/**
 * Issue #54 reported the project page scrolling sideways at 375px (scrollWidth 405, blamed on
 * the quick-add form's Add button); it did not reproduce here, so this is the guard. Phones run from
 * 320 to 390, so the page is checked at each of them, with a task on it so the task row and its
 * controls are on screen too. Runs against the local Supabase stack, like smoke.spec.ts.
 */
test('the project page never scrolls sideways on a phone', async ({ page }) => {
  await test.step('sign up and open a project with a task', async () => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.getByLabel('Email').fill(`overflow-${Date.now()}@example.com`)
    await page.getByLabel('Password').fill('questlog-overflow-1234')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()

    await page.getByRole('link', { name: 'Areas' }).click()
    await page.getByRole('button', { name: '+ New' }).click()
    await page.getByLabel('Name').fill('Narrow')
    await page.getByRole('button', { name: 'Create area' }).click()
    await page.getByRole('link', { name: /Narrow/ }).click()
    await page.getByRole('button', { name: '+ New project' }).click()
    await page.getByLabel('Title').fill('Narrow project')
    await page.getByRole('button', { name: 'Create project' }).click()
    await page.getByRole('link', { name: 'Narrow project' }).click()

    await page.getByRole('textbox', { name: 'New task' }).fill('Narrow task')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByRole('radiogroup', { name: 'Status for Narrow task' })).toBeVisible()
  })

  for (const width of [320, 375, 390]) {
    await test.step(`${width}px wide`, async () => {
      await page.setViewportSize({ width, height: 800 })
      // Both pinned to the requested width, not just to each other: under Chromium's mobile
      // emulation the layout viewport widens to fit overflowing content, so innerWidth grows
      // along with scrollWidth and a bare `scrollWidth === innerWidth` passes on a broken page.
      // Polled, not read once: the resize reflows asynchronously.
      await expect
        .poll(() => page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]))
        .toEqual([width, width])
    })
  }
})

/**
 * What #54 most likely saw: an unbroken task title pushed the card's difficulty select and ⋯
 * button past the card's edge, where overflow-hidden cut them off (select right edge ~406px at
 * 375). The page itself never scrolled, so the check above cannot see it; this one measures the
 * controls against their own card.
 */
test('an unbroken task title keeps the card controls inside the card', async ({ page }) => {
  const longTitle = 'Supercalifragilisticexpialidocious'.repeat(3)

  await test.step('sign up and add a task with an unbroken title', async () => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.getByLabel('Email').fill(`longtitle-${Date.now()}@example.com`)
    await page.getByLabel('Password').fill('questlog-overflow-1234')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()

    await page.getByRole('link', { name: 'Areas' }).click()
    await page.getByRole('button', { name: '+ New' }).click()
    await page.getByLabel('Name').fill('Long')
    await page.getByRole('button', { name: 'Create area' }).click()
    await page.getByRole('link', { name: /Long/ }).click()
    await page.getByRole('button', { name: '+ New project' }).click()
    await page.getByLabel('Title').fill('Long project')
    await page.getByRole('button', { name: 'Create project' }).click()
    await page.getByRole('link', { name: 'Long project' }).click()

    await page.getByRole('textbox', { name: 'New task' }).fill(longTitle)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByRole('radiogroup', { name: `Status for ${longTitle}` })).toBeVisible()
  })

  for (const width of [320, 375, 390]) {
    await test.step(`${width}px wide`, async () => {
      await page.setViewportSize({ width, height: 800 })
      const select = page.getByRole('combobox', {
        name: new RegExp(`^Difficulty for ${longTitle}`),
      })
      const open = page.getByRole('button', { name: `Open ${longTitle}` })
      const titleButton = page.getByRole('button', {
        name: new RegExp(`^Task title: ${longTitle}`),
      })
      // The card is the nearest ancestor that clips; both controls must end inside it. No such
      // ancestor → NaN, which fails, rather than quietly measuring against the page.
      const overhang = (el: Element) => {
        let card = el.parentElement
        while (card && getComputedStyle(card).overflow !== 'hidden') card = card.parentElement
        return card ? el.getBoundingClientRect().right - card.getBoundingClientRect().right : NaN
      }
      await expect.poll(() => select.evaluate(overhang)).toBeLessThanOrEqual(0)
      await expect.poll(() => open.evaluate(overhang)).toBeLessThanOrEqual(0)
      // The title wraps inside its own box instead of spilling over the controls beside it.
      await expect
        .poll(() => titleButton.evaluate((el) => el.scrollWidth - el.clientWidth))
        .toBeLessThanOrEqual(0)
    })
  }
})
