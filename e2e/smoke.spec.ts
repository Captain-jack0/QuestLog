import { expect, test } from '@playwright/test'

/**
 * The one flow that has to keep working: sign up, build a thread, park its project,
 * and see the task waiting on Today. Runs against the local Supabase stack.
 */
test('a captain can sign up, log a thread and find it waiting on Today', async ({ page }) => {
  // mobile-safari ran 29-38s of the 45s limit, and the toast wait below adds ~2.6s.
  test.slow()
  const email = `smoke-${Date.now()}@example.com`

  await test.step('sign up', async () => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('questlog-smoke-1234')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
  })

  await test.step('the tab bar holds the five places; Quick add is up top', async () => {
    const tabs = page.getByRole('navigation', { name: 'Main' })
    await expect(tabs.getByRole('link')).toHaveText([
      'Today',
      'Threads',
      'Areas',
      'Progress',
      'Settings',
    ])
    // The old raised "+" tab is gone: nothing in the bar but the five links.
    await expect(tabs.getByRole('button')).toHaveCount(0)
    await expect(page.getByRole('banner').getByRole('button', { name: 'Quick add' })).toBeVisible()
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

    // 10 check-in + 25 for an M task on the first action of the day (next_step_task.sql:145,152;
    // the quick-add form posts 'M', ProjectDetail.tsx:78). Toasts live 2600ms (Toast.tsx:29) and
    // stack, so a bare '✨' matches whichever XP toasts happen to overlap; the exact amount picks
    // out one and fails loudly if the award ever changes.
    await expect(page.getByRole('status').filter({ hasText: '+35 ✨' })).toBeVisible()
    await expect(page.getByText('1/1 done')).toBeVisible()
  })

  await test.step('start a second task', async () => {
    await page.getByRole('textbox', { name: 'New task' }).fill('Hanging task')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.getByRole('radio', { name: 'Status for Hanging task: In progress' }).click()
    // In progress needs no resume sheet, so it goes straight to the RPC: a flat progress_update 8
    // (next_step_task.sql:159), the check-in having fired on the completion above. Wait the toast
    // out (Toast.tsx:29) — the pause below also pays +8, and two of them on screen at once would
    // make the next assertion ambiguous.
    const started = page.getByRole('status').filter({ hasText: '+8 ✨' })
    await expect(started).toBeVisible()
    await expect(started).toHaveCount(0)
  })

  await test.step('park the project so its task hangs', async () => {
    await page.getByRole('radio', { name: 'Project status: Paused' }).click()
    await page.getByLabel('Where did you leave off?').fill('first task done')
    await page.getByLabel("What's the next step?").fill('plan the second one')
    await page.getByRole('button', { name: /Mark as paused/i }).click()
    // Pausing is not a completion, so it pays the flat progress_update 8 (next_step_task.sql:159)
    // and the check-in already fired above — 8 is the whole award.
    await expect(page.getByRole('status').filter({ hasText: '+8 ✨' })).toBeVisible()
  })

  await test.step('the project page takes a micro-note and a focus timer', async () => {
    // The park step's +8 toast is still up (Toast.tsx:29); wait it out so the micro-note's own +8
    // below is the only one on screen.
    await expect(page.getByRole('status').filter({ hasText: '+8 ✨' })).toHaveCount(0)

    // The resume box's next step: the <p> right under its heading (History repeats the words
    // as "Next: ...", so a bare getByText would match twice).
    const nextStep = page
      .getByRole('heading', { name: 'Next step', exact: true })
      .locator('xpath=following-sibling::p[1]')
    await expect(nextStep).toHaveText('plan the second one')

    await page.getByRole('button', { name: /Micro-note/ }).click()
    await page.getByLabel('Micro-note').fill('rigged the mainsail')
    await page.getByRole('button', { name: 'Save note' }).click()

    // A micro-note is a progress update: the flat 8, the check-in having fired long ago.
    const noted = page.getByRole('status').filter({ hasText: '+8 ✨' })
    await expect(noted).toBeVisible()
    await expect(noted).toHaveCount(0)

    await expect(
      page.getByRole('region', { name: 'History' }).getByText('rigged the mainsail'),
    ).toBeVisible()
    // The note rides along; it must not rewrite the context it was added beside.
    await expect(nextStep).toHaveText('plan the second one')
    // The header's XP chip reads this user's own events on the project (sr-only wording): check-in
    // 10 + M task 25 + three progress updates (in progress, pause, this note) 8 each = 59.
    await expect(page.getByText('You earned 59 XP here')).toHaveCount(1)

    // The resume box's focus start swaps for the header's Stop on the same clock. A stop this
    // soon discards the session (too short, no XP), so nothing leaks into the steps after.
    await page.getByRole('button', { name: 'Start 25m focus on Test project' }).click()
    await expect(page.getByRole('button', { name: 'Stop the timer on Test project' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start 25m focus on Test project' })).toHaveCount(
      0,
    )

    await page.getByRole('button', { name: 'Stop the timer on Test project' }).click()
    await expect(page.getByRole('button', { name: 'Stop the timer on Test project' })).toHaveCount(
      0,
    )
    await expect(
      page.getByRole('button', { name: 'Start 25m focus on Test project' }),
    ).toBeVisible()
  })

  await test.step('Today shows the task, parked with its project', async () => {
    await page.getByRole('link', { name: 'Today' }).click()
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
    // The task is in progress, but its project is paused, so it reads as paused (display_status)
    // and sits under the parked heading with that status spelled out and where it lives. With
    // nothing else in progress, the Active list drops its heading rather than showing an empty one.
    const parked = page.getByRole('region', { name: 'Paused & blocked' })
    await expect(parked.getByText('Hanging task')).toBeVisible()
    await expect(parked.getByText('Paused', { exact: true })).toBeVisible()
    await expect(parked.getByText('Work · Test project')).toBeVisible()
    // Hanging threads are tasks only: the paused project itself, and its next step, stay off.
    await expect(page.getByText('plan the second one')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Drop project: Test project' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Active', exact: true })).toHaveCount(0)
    await expect(page.getByText(/1-day streak/)).toBeVisible()
  })

  await test.step('focus can be picked and is worth 5 XP', async () => {
    await page.getByRole('button', { name: /Pick up to 3/ }).click()
    // Scoped to the sheet, not the page: every thread card behind the overlay carries its own
    // buttons ("Drop task: Hanging task"), and the overlay eats clicks that land on them, so a
    // page-wide name match is one project rename away from picking the wrong one. No `.first()`
    // either — if a second match ever appears in here, this should fail loudly rather than
    // quietly pick one.
    const picker = page.getByRole('dialog', { name: "Pick today's focus" })
    await picker.getByRole('button', { name: /Test project/ }).click()
    await picker.getByRole('button', { name: /Focus on 1 today/ }).click()
    await expect(page.getByRole('status').filter({ hasText: '+5 ✨' })).toBeVisible()
  })

  await test.step('Today leads the focus card with its next step and a start button', async () => {
    // Scoped to the focus region: the hanging list above never shows the project's own next step.
    const focus = page.getByRole('region', { name: "Today's focus" })
    await expect(focus.getByText('plan the second one')).toBeVisible()
    await expect(
      focus.getByRole('button', { name: 'Start 25m focus on Test project' }),
    ).toBeVisible()

    // The capture field opens the shell's Quick add sheet and Escape closes it again.
    await page.getByRole('button', { name: /Capture a thread/ }).click()
    const quickAdd = page.getByRole('dialog', { name: 'Quick add' })
    await expect(quickAdd).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(quickAdd).toHaveCount(0)
  })

  // After the focus pick, before the sheet step (which navigates from Areas by name itself): the
  // paused project's hanging task is what the Work card offers to resume.
  await test.step('the area card resumes its waiting thread', async () => {
    await page.getByRole('link', { name: 'Areas' }).click()
    await expect(page.getByRole('link', { name: /Work/ })).toHaveCount(1)
    await page.getByRole('button', { name: 'Resume Test project' }).click()
    await expect(page.getByRole('heading', { name: 'Test project' })).toBeVisible()
  })

  // Last, not beside 'add a task': a second task here would turn the '1/1 done' the completion
  // step asserts into '1/2'. The quick row is exercised above; this is the other door, and the
  // only check that the description the sheet collects actually reaches the row.
  await test.step('the task sheet adds a task with a description', async () => {
    await page.getByRole('link', { name: 'Areas' }).click()
    await page.getByRole('link', { name: /Work/ }).click()
    await page.getByRole('link', { name: 'Test project' }).click()
    // Still 59 although the account now holds 64: pick_focus carries no project, so this only
    // passes while the chip sums the project's own events rather than the user's total.
    await expect(page.getByText('You earned 59 XP here')).toHaveCount(1)

    // Typed in the quick row first: the sheet is supposed to carry it over, not start empty.
    await page.getByRole('textbox', { name: 'New task' }).fill('Second task')
    await page.getByRole('button', { name: 'Add task with description' }).click()

    // Scoped to the dialog: 'Title' and 'Description' are labels the page uses elsewhere too.
    const sheet = page.getByRole('dialog', { name: 'Add task' })
    await expect(sheet.getByLabel('Title')).toHaveValue('Second task')
    await sheet.getByLabel('Description').fill('the long version')
    await sheet.getByRole('button', { name: 'Add task' }).click()

    await expect(page.getByRole('radiogroup', { name: 'Status for Second task' })).toBeVisible()
    await expect(page.getByText('the long version')).toBeVisible()
    // Seeded the sheet, so it must not still be sitting there offering the same task again.
    await expect(page.getByRole('textbox', { name: 'New task' })).toHaveValue('')
  })

  // Last of all: it adds a second area and a second project, and every step above picks its
  // target by name on screens where there was exactly one of each. Neither new name contains
  // 'Work', 'Test project', 'Areas' or 'Today', the strings those selectors match on.
  await test.step('areas and projects list least recently touched first', async () => {
    // The cards, by where they link: the nav link is '/areas' with nothing after it, and no
    // timer is running, so the timer bar's project link is not on the page.
    const areaCards = page.locator('a[href^="/areas/"]')
    const projectCards = page.locator('a[href^="/projects/"]')

    await page.getByRole('link', { name: 'Areas' }).click()
    await page.getByRole('button', { name: '+ New' }).click()
    await page.getByLabel('Name').fill('Garden')
    await page.getByRole('button', { name: 'Create area' }).click()
    // 'Work' was last touched when 'Second task' landed in it; 'Garden' is newer.
    await expect(areaCards).toHaveText([/Work/, /Garden/])

    await page.getByRole('link', { name: /Work/ }).click()
    await page.getByRole('button', { name: '+ New project' }).click()
    await page.getByLabel('Title').fill('Quiet sibling')
    await page.getByRole('button', { name: 'Create project' }).click()
    // The new project is the most recently touched one, so it goes last, not first.
    await expect(projectCards).toHaveText([/Test project/, /Quiet sibling/])

    // Touching the older project through one of its tasks is what has to move it.
    await page.getByRole('link', { name: 'Test project' }).click()
    await page.getByRole('textbox', { name: 'New task' }).fill('Third task')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByRole('radiogroup', { name: 'Status for Third task' })).toBeVisible()

    // Everything since 'Garden' was created happened inside 'Work', so the two have swapped.
    await page.getByRole('link', { name: 'Areas' }).click()
    await expect(areaCards).toHaveText([/Garden/, /Work/])

    await page.getByRole('link', { name: /Work/ }).click()
    await expect(projectCards).toHaveText([/Quiet sibling/, /Test project/])
  })
})
