import { expect, test } from '@playwright/test'

/**
 * Bottom sheets are modal dialogs, so the keyboard has to behave like one: Tab stays inside,
 * Escape closes, and focus goes back to whatever opened the sheet. There is no jsdom in this
 * project, so this is the only place those checks — and the body scroll lock below — can run
 * against a real browser.
 */
test('a bottom sheet traps Tab, hands focus back, and freezes the page behind it', async ({
  page,
}) => {
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
  // page that cannot scroll would let a broken lock pass with everything at 0. The filler goes
  // *above* the content so the opener can stay on screen at a non-zero scroll offset — with the
  // filler below, clicking an opener that had scrolled out of view made Playwright scroll the
  // page back to 0 first, and the lock then had nothing to preserve. It is a real element and
  // not a `body::before`, which the app already spends on its star field (`position: fixed`,
  // so a pseudo-element spacer takes up no room and the page never scrolls at all).
  //
  // `overflow-anchor` is off because scroll anchoring hides the bug being tested: the browser
  // restores the offset on its own when the pin comes off, which would keep the closing step
  // green even if the sheet never handed the scroll position back. That reasoning is about
  // Chromium; the mobile-safari project has not been shown to go red when the restore is
  // deleted, so read it as exercising the lock, not as a gate on the restore.
  await page.addStyleTag({ content: 'html{overflow-anchor:none}' })
  await page.evaluate(() => {
    const filler = document.createElement('div')
    filler.style.height = '2000px'
    document.body.prepend(filler)
  })

  // Opened from the keyboard on purpose. Safari does not focus a button when it is clicked, so
  // a mouse-opened sheet has no opener focus to hand back — the restoring half of the trap only
  // means anything for a keyboard user, and clicking would make this step assert nothing here.
  const opener = page.getByRole('button', { name: /Pick up to 3/ })
  await opener.focus()
  await opener.evaluate((el) => el.scrollIntoView({ block: 'center' }))
  const scrolledTo = await page.evaluate(() => window.scrollY)
  expect(scrolledTo, 'the page never scrolled, so the lock proves nothing').toBeGreaterThan(0)

  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()

  await test.step('the page behind is pinned where it was', async () => {
    // The symptom first: whatever the lock is made of, the page behind must not move. This is
    // the assertion that survives a different implementation of the same promise.
    await page.evaluate(() => window.scrollTo(0, 1500))
    expect(await page.evaluate(() => window.scrollY)).toBe(0)

    // Then the mechanism, because `overflow: hidden` alone is the half iOS Safari ignores.
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

  // One sheet can hand over to another: picking a status inside the task sheet closes it and
  // opens the resume sheet in the same commit (TaskSheet.tsx). That hand-off is the only way
  // two locks meet, and it is where an unlock landing after the next lock would strand the
  // body pinned — with no sheet left to unpin it, the page would be frozen for good.
  await test.step('build a task to hand a sheet over with', async () => {
    await page.getByRole('link', { name: 'Areas' }).click()
    await page.getByRole('button', { name: '+ New' }).click()
    await page.getByLabel('Name').fill('Locks')
    await page.getByRole('button', { name: 'Create area' }).click()

    await page.getByRole('link', { name: /Locks/ }).click()
    await page.getByRole('button', { name: '+ New project' }).click()
    await page.getByLabel('Title').fill('Lock project')
    await page.getByRole('button', { name: 'Create project' }).click()

    await page.getByRole('link', { name: 'Lock project' }).click()
    await page.getByRole('textbox', { name: 'New task' }).fill('Locked task')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Open Locked task' })).toBeVisible()
    // Visible is satisfied by the optimistic row, whose id is fake. Opening the sheet on that
    // row snapshots it (ProjectDetail `setEditingTask`), the real id never reaches the
    // snapshot, and the status picker stays disabled for good. Wait for the saved row.
    await expect(page.getByRole('button', { name: 'Task title: Locked task' })).toBeEnabled()
  })

  await test.step('a sheet handing over to another never unpins the body in between', async () => {
    const taskOpener = page.getByRole('button', { name: 'Open Locked task' })
    await taskOpener.focus()
    await taskOpener.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    const before = await page.evaluate(() => window.scrollY)
    expect(before, 'the project page never scrolled').toBeGreaterThan(0)

    await page.keyboard.press('Enter')
    const taskSheet = page.getByRole('dialog', { name: 'Edit task' })
    await expect(taskSheet).toBeVisible()

    // Closes the task sheet and opens the resume sheet in one commit.
    await taskSheet.getByRole('radio', { name: 'Status: Paused' }).click()
    await expect(page.getByLabel('Where did you leave off?')).toBeVisible()

    const pinned = await page.evaluate(() => document.body.style.position)
    expect(pinned, 'the hand-off let the body off its pin').toBe('fixed')

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    const after = await page.evaluate(() => ({
      position: document.body.style.position,
      scrollY: window.scrollY,
    }))
    expect(after.position, 'the body stayed pinned with no sheet left to unpin it').toBe('')
    expect(after.scrollY).toBe(before)
  })
})
