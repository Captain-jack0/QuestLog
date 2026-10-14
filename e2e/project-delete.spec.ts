import { expect, test } from '@playwright/test'

/**
 * Issue #60: the owner deletes a project from the area grid or from its edit sheet, confirming by
 * typing its name, and can undo from the toast. Runs against the local Supabase stack, like
 * smoke.spec.ts.
 */
test('delete a project, undo it, then delete it from its page', async ({ page }) => {
  await test.step('sign up and create a project', async () => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.getByLabel('Email').fill(`delete-${Date.now()}@example.com`)
    await page.getByLabel('Password').fill('questlog-delete-1234')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()

    await page.getByRole('link', { name: 'Areas' }).click()
    await page.getByRole('button', { name: '+ New' }).click()
    await page.getByLabel('Name').fill('Harbour')
    await page.getByRole('button', { name: 'Create area' }).click()
    await page.getByRole('link', { name: /Harbour/ }).click()
    await page.getByRole('button', { name: '+ New project' }).click()
    await page.getByLabel('Title').fill('Doomed ship')
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page.getByRole('link', { name: 'Doomed ship' })).toBeVisible()
  })

  await test.step('the confirm button waits for the full name', async () => {
    await page.getByRole('button', { name: 'Delete project Doomed ship' }).click()
    const dialog = page.getByRole('dialog', { name: 'Delete project?' })
    const confirm = dialog.getByRole('button', { name: 'Delete project' })
    await expect(confirm).toBeDisabled()
    await dialog.getByLabel(/to confirm/).fill('Doomed')
    await expect(confirm).toBeDisabled()
    await dialog.getByLabel(/to confirm/).fill('Doomed ship')
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect(page.getByRole('link', { name: 'Doomed ship' })).toHaveCount(0)
  })

  await test.step('focus lands on Undo, and the toast waits while the pointer is on it', async () => {
    const undo = page.getByRole('button', { name: 'Undo' })
    await expect(undo).toBeFocused()
    // Past the 8 s an unheld toast lives (Toast.tsx): hover holds it (WCAG 2.2.1).
    await undo.hover()
    await page.waitForTimeout(9000)
    await expect(undo).toBeVisible()
  })

  await test.step('undo brings it back', async () => {
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByText('Project restored')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Doomed ship' })).toBeVisible()
  })

  await test.step('delete from the edit sheet lands back on the area', async () => {
    await page.getByRole('link', { name: 'Doomed ship' }).click()
    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    await page
      .getByRole('dialog', { name: 'Edit project' })
      .getByRole('button', { name: 'Delete project' })
      .click()
    const dialog = page.getByRole('dialog', { name: 'Delete project?' })
    await dialog.getByLabel(/to confirm/).fill('Doomed ship')
    await dialog.getByRole('button', { name: 'Delete project' }).click()
    await expect(page.getByRole('heading', { name: /Harbour/ })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Doomed ship' })).toHaveCount(0)
    await expect(page.getByText('Project deleted')).toBeVisible()
  })

  await test.step('the code’s own focus on Undo does not pin the toast', async () => {
    await expect(page.getByRole('button', { name: 'Undo' })).toBeFocused()
    // The pointer that clicked confirm may sit where the toast appeared; hover is a hold.
    await page.mouse.move(0, 0)
    await page.waitForTimeout(9000)
    await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0)
  })
})
