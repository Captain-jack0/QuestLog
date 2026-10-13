import { expect, test } from '@playwright/test'

/**
 * Login mode switching: Sign in / Create account / magic link. The current mode is plain text in
 * the segment, so exactly one control is named "Create account" at any time (smoke.spec.ts and
 * the others press it to switch, then again to submit). No account is created here.
 */
test('login modes keep one "Create account" button and keep focus in the form', async ({
  page,
}) => {
  const createAccount = page.getByRole('button', { name: 'Create account' })

  await test.step('sign in mode: one Create account button, password shown', async () => {
    await page.goto('/login')
    await expect(createAccount).toHaveCount(1)
    await expect(page.getByLabel('Password')).toBeVisible()
  })

  await test.step('create account mode: still exactly one (the submit button)', async () => {
    await createAccount.click()
    await expect(createAccount).toHaveCount(1)
    await expect(page.getByLabel('Password')).toBeVisible()
  })

  await test.step('magic link mode: no password, one Create account, Send magic link', async () => {
    await page.getByRole('button', { name: 'Email me a magic link instead' }).click()
    await expect(page.getByLabel('Password')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Send magic link' })).toBeVisible()
    await expect(createAccount).toHaveCount(1)
  })

  await test.step('"Use a password instead" returns to sign in', async () => {
    await page.getByRole('button', { name: 'Use a password instead' }).click()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCount(1)
    await expect(createAccount).toHaveCount(1)
  })

  await test.step('keyboard: Enter on Create account leaves focus in Email, not on body', async () => {
    await createAccount.focus()
    await createAccount.press('Enter')
    await expect(page.getByLabel('Email')).toBeFocused()
  })
})
