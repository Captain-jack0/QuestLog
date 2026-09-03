import { expect, test } from '@playwright/test'

/**
 * The one flow that has to keep working: sign up, build a thread, park it with context,
 * and see it waiting on Today. Runs against the local Supabase stack.
 */
test('a captain can sign up, log a thread and find it waiting on Today', async ({ page }) => {
  const email = `smoke-${Date.now()}@example.com`

  await test.step('sign up', async () => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('questlog-smoke-1234')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
  })

  await test.step('create an area', async () => {
    await page.getByRole('link', { name: 'Areas' }).click()
    await page.getByRole('button', { name: '+ New' }).click()
    await page.getByLabel('Name').fill('Work')
    await page.getByRole('button', { name: 'Create area' }).click()
    await expect(page.getByRole('link', { name: /Work/ })).toBeVisible()
  })

  await test.step('create a project', async () => {
    await page.getByRole('link', { name: /Work/ }).click()
    await page.getByRole('button', { name: '+ New project' }).click()
    await page.getByLabel('Title').fill('Test project')
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page.getByText('Test project')).toBeVisible()
  })

  await test.step('add a task', async () => {
    await page.getByRole('link', { name: 'Test project' }).click()
    await expect(page.getByRole('heading', { name: 'Test project' })).toBeVisible()
    await page.getByRole('textbox', { name: 'New task' }).fill('First task')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByRole('radiogroup', { name: 'Status for First task' })).toBeVisible()
  })

  await test.step('complete it with resume context and collect XP', async () => {
    await page.getByRole('radio', { name: 'Status for First task: Done' }).click()
    await page.getByLabel('Where did you leave off?').fill('task finished')
    await page.getByLabel("What's the next step?").fill('review it tomorrow')
    await page.getByRole('button', { name: /Mark as done/i }).click()

    // 10 check-in + 25 for an M task on the first action of the day
    await expect(page.getByRole('status').filter({ hasText: '✨' })).toBeVisible()
    await expect(page.getByText('1/1 done')).toBeVisible()
  })

  await test.step('park the project so it hangs', async () => {
    await page.getByRole('radio', { name: 'Project status: Paused' }).click()
    await page.getByLabel('Where did you leave off?').fill('first task done')
    await page.getByLabel("What's the next step?").fill('plan the second one')
    await page.getByRole('button', { name: /Mark as paused/i }).click()
    await expect(page.getByRole('status').filter({ hasText: '✨' })).toBeVisible()
  })

  await test.step('Today shows the thread with its next step', async () => {
    await page.getByRole('link', { name: 'Today' }).click()
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
    await expect(page.getByText('plan the second one')).toBeVisible()
    await expect(page.getByText(/1-day streak/)).toBeVisible()
  })

  await test.step('focus can be picked and is worth 5 XP', async () => {
    await page.getByRole('button', { name: /Pick up to 3/ }).click()
    // Scoped to the sheet, not the page: every thread card behind the overlay carries a
    // "Drop project: Test project" button that /Test project/ matches too, and the overlay
    // eats the click. No `.first()` either — if a second match ever appears in here, this
    // should fail loudly rather than quietly pick one.
    const picker = page.getByRole('dialog', { name: "Pick today's focus" })
    await picker.getByRole('button', { name: /Test project/ }).click()
    await picker.getByRole('button', { name: /Focus on 1 today/ }).click()
    await expect(page.getByRole('status').filter({ hasText: '+5 ✨' })).toBeVisible()
  })
})
