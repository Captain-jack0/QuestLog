import { expect, test, type Locator } from '@playwright/test'

/**
 * Issue #45: clocks run side by side, stack up in TimerBar, stop one at a time, and the fourth
 * start is refused with a reason. Runs against the local Supabase stack, like smoke.spec.ts.
 *
 * Row buttons are pressed from the keyboard, not clicked: TimerBar is pinned over the bottom of
 * the page, and on a phone-sized viewport it can sit on top of the last task's buttons and eat
 * the click. A focused button takes Enter whatever is drawn over it.
 */
const press = async (button: Locator) => {
  await button.focus()
  await button.press('Enter')
}

test('timers run side by side, stack in the bar and stop one at a time', async ({ page }) => {
  const email = `timers-${Date.now()}@example.com`
  // No name here contains another, so every name selector below has exactly one target.
  const tasks = ['Anchor', 'Bosun', 'Compass', 'Dinghy']

  await test.step('sign up and build a project with four tasks', async () => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('questlog-timers-1234')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()

    await page.getByRole('link', { name: 'Areas' }).click()
    await page.getByRole('button', { name: '+ New' }).click()
    await page.getByLabel('Name').fill('Clocks')
    await page.getByRole('button', { name: 'Create area' }).click()
    await page.getByRole('link', { name: /Clocks/ }).click()
    await page.getByRole('button', { name: '+ New project' }).click()
    await page.getByLabel('Title').fill('Clock project')
    await page.getByRole('button', { name: 'Create project' }).click()
    await page.getByRole('link', { name: 'Clock project' }).click()

    for (const title of tasks) {
      await page.getByRole('textbox', { name: 'New task' }).fill(title)
      await page.getByRole('button', { name: 'Add', exact: true }).click()
      // Enabled only once the saved row replaces the optimistic one (TaskItem `pending`).
      await expect(page.getByRole('button', { name: `Start a timer on ${title}` })).toBeEnabled()
    }
  })

  const bar = page.getByRole('region', { name: 'Running timers' })

  await test.step('a second clock starts without stopping the first', async () => {
    await press(page.getByRole('button', { name: 'Start a timer on Anchor' }))
    await expect(page.getByRole('button', { name: 'Stop the timer on Anchor' })).toBeVisible()
    await expect(bar.getByRole('button', { name: /Show all/ })).toHaveCount(0)

    await press(page.getByRole('button', { name: 'Start a timer on Bosun' }))
    await expect(page.getByRole('button', { name: 'Stop the timer on Bosun' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Stop the timer on Anchor' })).toBeVisible()
    await expect(bar.getByRole('button', { name: 'Show all 2 timers' })).toHaveText('+1')
  })

  await test.step('the open deck stops the card underneath and only that one', async () => {
    await bar.getByRole('button', { name: 'Show all 2 timers' }).click()
    await expect(bar.getByRole('listitem')).toHaveCount(2)

    // Bosun was started last, so Anchor is the card that sat underneath.
    await bar
      .getByRole('listitem')
      .filter({ hasText: 'Anchor' })
      .getByRole('button', { name: 'Stop', exact: true })
      .click()

    await expect(page.getByRole('button', { name: 'Start a timer on Anchor' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Stop the timer on Bosun' })).toBeVisible()
    await expect(bar.getByText('Bosun')).toBeVisible()
    await expect(bar.getByText('Anchor')).toHaveCount(0)
    // One clock left: no deck, no badge, no list.
    await expect(bar.getByRole('listitem')).toHaveCount(0)
    await expect(bar.getByRole('button', { name: /Show all/ })).toHaveCount(0)
  })

  await test.step('with three running, the fourth start is refused and says why', async () => {
    await press(page.getByRole('button', { name: 'Start a timer on Anchor' }))
    await expect(page.getByRole('button', { name: 'Stop the timer on Anchor' })).toBeVisible()
    await press(page.getByRole('button', { name: 'Start a timer on Compass' }))
    await expect(page.getByRole('button', { name: 'Stop the timer on Compass' })).toBeVisible()
    await expect(bar.getByRole('button', { name: 'Show all 3 timers' })).toHaveText('+2')

    const fourth = page.getByRole('button', { name: 'Start a timer on Dinghy' })
    await expect(fourth).toHaveAttribute('aria-disabled', 'true')
    await expect(fourth).toHaveAttribute('title', /Up to 3 timers/)

    await press(fourth)
    await expect(page.getByRole('status').filter({ hasText: 'Up to 3 timers' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Stop the timer on Dinghy' })).toHaveCount(0)
    await expect(bar.getByRole('button', { name: 'Show all 3 timers' })).toBeVisible()
  })
})
