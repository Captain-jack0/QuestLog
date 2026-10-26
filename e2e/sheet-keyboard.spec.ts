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

    await test.step('radio groups are a single Tab stop with arrow key navigation', async () => {
      // The Status radio group has several options (six in this compact sheet) but is a single
      // Tab stop: Tab lands on the selected option, arrows move between them.
      const statusGroup = taskSheet.locator('[role="radiogroup"][aria-label*="Status"]')

      // Status is the last stop in the sheet: Shift+Tab wraps onto it, a second one steps off
      // it, and the Tab loop below walks back in from there.
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Shift+Tab')

      // Count tabs to reach the Status group - should be just one Tab stop
      let tabCount = 0
      const maxTabs = 15
      while (tabCount < maxTabs) {
        await page.keyboard.press('Tab')
        tabCount++
        const focusedInStatus = await statusGroup.evaluate((group) => {
          return group.contains(document.activeElement)
        })
        if (focusedInStatus) break
      }

      expect(tabCount, 'Status group was not reachable via Tab').toBeLessThan(maxTabs)

      // Tab again - should leave the group entirely (not land on next status option)
      const initialStatus = await statusGroup.evaluate((group) =>
        group.querySelector('[role="radio"][aria-checked="true"]')?.textContent?.trim(),
      )

      await page.keyboard.press('Tab')
      const stillInStatus = await statusGroup.evaluate((group) => {
        return group.contains(document.activeElement)
      })
      expect(stillInStatus, 'Tab landed on another status instead of leaving the group').toBe(false)

      // Go back to Status and test arrow keys. A status is a write (XP, the resume sheet), so
      // an arrow only moves focus; nothing is picked until Space/Enter or a tap.
      const focusedLabel = () =>
        statusGroup.evaluate((group) =>
          group.contains(document.activeElement)
            ? document.activeElement?.textContent?.trim()
            : null,
        )
      const checkedLabel = () =>
        statusGroup.evaluate((group) =>
          group.querySelector('[role="radio"][aria-checked="true"]')?.textContent?.trim(),
        )

      await page.keyboard.press('Shift+Tab')
      expect(await focusedLabel(), 'Shift+Tab came back to the checked status').toBe(initialStatus)

      await page.keyboard.press('ArrowRight')
      const afterArrow = await focusedLabel()
      expect(afterArrow, 'Arrow key did not move focus').not.toBe(initialStatus)
      expect(afterArrow, 'Arrow key moved focus out of the group').not.toBeNull()
      expect(await checkedLabel(), 'Arrow key changed the status by itself').toBe(initialStatus)

      // Arrow left should go back
      await page.keyboard.press('ArrowLeft')
      expect(await focusedLabel()).toBe(initialStatus)
      expect(await checkedLabel()).toBe(initialStatus)

      // The Tab stop travels with focus: after an arrow, Tab leaves the group instead of
      // landing on the checked status, and Shift+Tab comes back to the checked one.
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('Tab')
      expect(await focusedLabel(), 'Tab after an arrow stayed inside the group').toBeNull()
      await page.keyboard.press('Shift+Tab')
      expect(await focusedLabel(), 'Shift+Tab did not return to the checked status').toBe(
        initialStatus,
      )

      // Walk to Paused with the arrows; Space is what picks it.
      for (let i = 0; i < 8 && (await focusedLabel()) !== 'Paused'; i++) {
        await page.keyboard.press('ArrowRight')
      }
      expect(await focusedLabel()).toBe('Paused')
      expect(await checkedLabel(), 'walking to Paused picked a status on the way').toBe(
        initialStatus,
      )
    })

    // Space picks Paused, which closes the task sheet and opens the resume sheet in one commit.
    await page.keyboard.press('Space')
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

  // Sort has no side effect, so there an arrow picks as well as moves (the default mode).
  await test.step('an arrow in the sort group picks the next order', async () => {
    const sort = page.getByRole('radiogroup', { name: 'Sort tasks' })
    const checked = sort.getByRole('radio', { checked: true })
    const before = (await checked.textContent())?.trim()
    await checked.focus()
    await page.keyboard.press('ArrowRight')
    const now = sort.getByRole('radio', { checked: true })
    await expect(now).not.toHaveText(before ?? '')
    await expect(now).toBeFocused()
  })
})
