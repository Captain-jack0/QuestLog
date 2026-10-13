import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * The Threads screen lists every waiting thread, narrows it by area (kept in the URL, so it
 * survives a reload) and by search, and says so when nothing matches. Runs in the two mobile
 * projects against the local Supabase stack, like smoke.spec.ts.
 */

// No name here contains another, nor any nav label, so each selector has exactly one target.
const AREAS = [
  { area: 'Harbor', project: 'Dock repairs', task: 'Caulk the hull' },
  { area: 'Garden', project: 'Spring beds', task: 'Turn the compost' },
]

// The timer bar is pinned over the bottom of a phone-sized page and can eat a click on a row
// button; a focused button takes Enter whatever is drawn over it (parallel-timers.spec.ts).
const press = async (button: Locator) => {
  await button.focus()
  await button.press('Enter')
}

async function hangThread(page: Page, { area, project, task }: (typeof AREAS)[number]) {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Areas' }).click()
  await page.getByRole('button', { name: '+ New' }).click()
  await page.getByLabel('Name').fill(area)
  await page.getByRole('button', { name: 'Create area' }).click()
  await page.getByRole('link', { name: new RegExp(area) }).click()
  await page.getByRole('button', { name: '+ New project' }).click()
  await page.getByLabel('Title').fill(project)
  await page.getByRole('button', { name: 'Create project' }).click()
  await page.getByRole('link', { name: project }).click()
  await page.getByRole('textbox', { name: 'New task' }).fill(task)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  // In progress needs no resume sheet: straight to the RPC, and the task starts hanging.
  await page.getByRole('radio', { name: `Status for ${task}: In progress` }).click()
  await expect(page.getByRole('radio', { name: `Status for ${task}: In progress` })).toBeChecked()
}

test('threads filter by area and search, and say when nothing matches', async ({ page }) => {
  test.slow()

  await test.step('sign up and leave a thread hanging in two areas', async () => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Create account' }).click()
    await page.getByLabel('Email').fill(`threads-${Date.now()}@example.com`)
    await page.getByLabel('Password').fill('questlog-threads-1234')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
    for (const thread of AREAS) await hangThread(page, thread)
  })

  const waiting = page.getByRole('region', { name: 'Waiting threads' })
  const [harbor, garden] = AREAS

  await test.step('Threads shows both', async () => {
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Threads' })
      .click()
    await expect(page.getByRole('heading', { name: 'Threads', exact: true })).toBeVisible()
    await expect(page.getByText('2 to revive')).toBeVisible()
    await expect(waiting.getByRole('link', { name: harbor.task })).toBeVisible()
    await expect(waiting.getByRole('link', { name: garden.task })).toBeVisible()
  })

  await test.step('an area chip hides the other area, and a reload keeps it', async () => {
    const filter = page.getByRole('group', { name: 'Filter by area' })
    await filter.getByRole('button', { name: new RegExp(harbor.area) }).click()
    await expect(page).toHaveURL(/[?&]area=/)
    await expect(waiting.getByRole('link', { name: harbor.task })).toBeVisible()
    await expect(waiting.getByRole('link', { name: garden.task })).toHaveCount(0)

    await page.reload()
    await expect(waiting.getByRole('link', { name: harbor.task })).toBeVisible()
    await expect(waiting.getByRole('link', { name: garden.task })).toHaveCount(0)

    await filter.getByRole('button', { name: /All/ }).click()
    await expect(page).not.toHaveURL(/[?&]area=/)
    await expect(waiting.getByRole('link', { name: garden.task })).toBeVisible()
  })

  await test.step('search narrows by text, and an unmatched one says so', async () => {
    const search = page.getByRole('searchbox', { name: 'Search threads' })
    await search.fill('COMPOST')
    await expect(waiting.getByRole('link', { name: garden.task })).toBeVisible()
    await expect(waiting.getByRole('link', { name: harbor.task })).toHaveCount(0)

    await search.fill('no thread says this')
    await expect(page.getByText('Nothing matches')).toBeVisible()
    await expect(waiting.getByRole('link', { name: garden.task })).toHaveCount(0)
  })

  const goThreads = async () => {
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Threads' })
      .click()
    await expect(page.getByRole('heading', { name: 'Threads', exact: true })).toBeVisible()
  }
  const ledger = page.getByRole('region', { name: 'Zero-guilt ledger' })

  await test.step('pausing with a note shows where you left off, and the ledger counts the next step', async () => {
    await page.getByRole('searchbox', { name: 'Search threads' }).fill('')
    await waiting.getByRole('link', { name: garden.task }).click()
    await page.getByRole('radio', { name: `Status for ${garden.task}: Paused` }).click()
    await page.getByLabel('Where did you leave off?').fill('compost half turned')
    await page.getByLabel("What's the next step?").fill('finish the far bin')
    await page.getByRole('button', { name: /Mark as paused/i }).click()
    await expect(
      page.getByRole('radio', { name: `Status for ${garden.task}: Paused` }),
    ).toBeChecked()

    await goThreads()
    // Only the paused thread has a note, so each of these has one target.
    await expect(waiting.getByText('Where you left off')).toBeVisible()
    await expect(waiting.getByText('compost half turned')).toBeVisible()
    // Only the paused one names a next step: 1 of the 2 waiting.
    await expect(ledger.getByText('50%')).toBeVisible()
    await expect(ledger.getByText(/1 of 2 waiting threads name a next step/)).toBeVisible()
  })

  await test.step('a running timer shows under Running now, until it stops', async () => {
    await waiting.getByRole('link', { name: harbor.task }).click()
    await press(page.getByRole('button', { name: `Start a timer on ${harbor.task}` }))
    await expect(
      page.getByRole('button', { name: `Stop the timer on ${harbor.task}` }),
    ).toBeVisible()

    await goThreads()
    const running = page.getByRole('region', { name: 'Running now' })
    await expect(running).toContainText(harbor.task)
    await expect(running.getByText('this session')).toBeVisible()

    await running.getByRole('link', { name: /View/ }).click()
    await press(page.getByRole('button', { name: `Stop the timer on ${harbor.task}` }))
    await expect(
      page.getByRole('button', { name: `Stop the timer on ${harbor.task}` }),
    ).toHaveCount(0)
    await goThreads()
    await expect(page.getByRole('region', { name: 'Running now' })).toHaveCount(0)
  })

  await test.step('finishing a thread settles it in the ledger', async () => {
    await waiting.getByRole('link', { name: harbor.task }).click()
    await page.getByRole('radio', { name: `Status for ${harbor.task}: Done` }).click()
    await page.getByRole('button', { name: /Mark as done/i }).click()
    await expect(page.getByRole('radio', { name: `Status for ${harbor.task}: Done` })).toBeChecked()

    await goThreads()
    await expect(waiting.getByRole('link', { name: harbor.task })).toHaveCount(0)
    await expect(ledger.getByText(/thread settled/)).toBeVisible()
    await expect(ledger).toHaveText(/1\s*thread settled/)
    // The one waiting thread left is the paused one, and it names its next step.
    await expect(ledger.getByText('100%')).toBeVisible()
    await expect(ledger.getByText(/1 of 1 waiting thread names a next step/)).toBeVisible()
  })
})
