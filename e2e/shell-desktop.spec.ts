import { expect, test } from '@playwright/test'

/**
 * The desktop shell (md and up): the rail holds the same five places as the phone's tab bar and
 * marks the current one with aria-current, Ctrl+K opens Quick add from anywhere, and the detail
 * screens get a breadcrumb built from the real area and project. Runs only in the `desktop`
 * project (playwright.config.ts), against the local Supabase stack like smoke.spec.ts.
 */
test('the desktop rail, Quick add shortcut and breadcrumb work', async ({ page }) => {
  const rail = page.getByRole('navigation', { name: 'Main' })

  await test.step('sign up', async () => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.getByLabel('Email').fill(`desktop-${Date.now()}@example.com`)
    await page.getByLabel('Password').fill('questlog-desktop-1234')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
  })

  await test.step('the rail lists the five places and marks the current one', async () => {
    await expect(rail.getByRole('link')).toHaveText([
      'Today',
      'Threads',
      'Areas',
      'Progress',
      'Settings',
    ])
    await expect(rail.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page')

    await rail.getByRole('link', { name: 'Threads' }).click()
    await expect(page.getByRole('heading', { name: 'Threads', exact: true })).toBeVisible()
    await expect(rail.getByRole('link', { name: 'Threads' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(rail.getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current')
  })

  await test.step('the avatar opens Settings without a second "Settings" link', async () => {
    await page.getByRole('link', { name: 'Profile' }).click()
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Settings' })).toHaveCount(1)
  })

  await test.step('Ctrl+K opens Quick add, once, even from inside a text field', async () => {
    const quickAdd = page.getByRole('dialog', { name: 'Quick add' })
    await page.keyboard.press('Control+k')
    await expect(quickAdd).toBeVisible()
    await expect(page.getByLabel("What's on your mind?")).toBeFocused()

    // Already open, focus in its input: nothing new opens.
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('dialog')).toHaveCount(1)

    await page.keyboard.press('Escape')
    await expect(quickAdd).toBeHidden()
    await expect(page.getByRole('button', { name: 'Quick add' })).toBeVisible()
  })

  await test.step('a project page shows Areas › area › project', async () => {
    await rail.getByRole('link', { name: 'Areas' }).click()
    await page.getByRole('button', { name: '+ New' }).click()
    await page.getByLabel('Name').fill('Desk')
    await page.getByRole('button', { name: 'Create area' }).click()
    await expect(page.getByRole('link', { name: /Desk/ })).toBeVisible()
    await page.getByRole('link', { name: /Desk/ }).click()

    const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(crumbs.getByText('Desk', { exact: true })).toHaveAttribute('aria-current', 'page')

    await page.getByRole('button', { name: '+ New project' }).click()
    await page.getByLabel('Title').fill('Desk project')
    await page.getByRole('button', { name: 'Create project' }).click()
    await page.getByRole('link', { name: 'Desk project' }).click()
    await expect(page.getByRole('heading', { name: 'Desk project' })).toBeVisible()

    await expect(crumbs).toContainText('Areas')
    // "Areas" is text, not a link: a second link with that name would collide with the rail's.
    await expect(crumbs.getByRole('link', { name: 'Areas' })).toHaveCount(0)
    await expect(crumbs.getByText('Desk project', { exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await crumbs.getByRole('link', { name: 'Desk', exact: true }).click()
    await expect(page).toHaveURL(/\/areas\/[0-9a-f-]+$/)
  })

  await test.step('the rail shows a running timer once, and the in-progress task', async () => {
    const rail = page.getByRole('complementary')
    const timers = page.getByRole('region', { name: 'Running timers' })

    await page.getByRole('main').getByRole('link', { name: 'Desk project' }).click()
    await page.getByRole('textbox', { name: 'New task' }).fill('Rail task')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.getByRole('button', { name: 'Start a timer on Rail task' }).click()

    // One deck, and it is the rail's: the phone's bar is not mounted on desktop.
    await expect(timers).toHaveCount(1)
    await expect(rail.getByRole('region', { name: 'Running timers' })).toHaveCount(1)

    await page.getByRole('radio', { name: 'Status for Rail task: In progress' }).click()
    await expect(
      rail.getByRole('region', { name: 'In progress' }).getByRole('link', { name: /Rail task/ }),
    ).toBeVisible()

    await timers.getByRole('button', { name: 'Stop', exact: true }).click()
    await expect(timers).toHaveCount(0)
  })
})
