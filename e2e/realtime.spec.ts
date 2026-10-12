import { expect, test, type Page, type WebSocket } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'

/**
 * Issue #78: a member's change reaches the other members' screens without a reload, and RLS —
 * not the client — decides who hears it. Runs against the local Supabase stack.
 *
 * O owns the project, E is invited as editor, S is a stranger. Membership is set up through the
 * #75 RPCs (create + accept an email invite), not the share UI, which lands in #76.
 */

// Same values the dev server reads: .env* at the repo root, or VITE_* from the environment.
const env = loadEnv('', process.cwd(), 'VITE_')
const PASSWORD = 'questlog-realtime-1234'

interface User {
  id: string
  email: string
  db: SupabaseClient
}

async function signUp(tag: string): Promise<User> {
  const email = `rt-${tag}-${Date.now()}@example.com`
  const db = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  // Local auth confirms on signup (config.toml enable_confirmations = false), so this is a session.
  const { data, error } = await db.auth.signUp({ email, password: PASSWORD })
  if (error) throw error
  db.realtime.setAuth(data.session!.access_token)
  return { id: data.user!.id, email, db }
}

async function ok<T>(query: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await query
  if (error) throw error
  return data
}

async function project(owner: User, title: string): Promise<string> {
  const area = await ok(
    owner.db
      .from('life_areas')
      .insert({ name: `${title} area`, user_id: owner.id })
      .select()
      .single(),
  )
  const row = await ok(
    owner.db
      .from('projects')
      .insert({ title, area_id: area.id, user_id: owner.id })
      .select()
      .single(),
  )
  return row.id
}

async function shareAsEditor(owner: User, projectId: string, member: User) {
  const invite = await ok(
    owner.db.rpc('rpc_create_invite', {
      p_target_type: 'project',
      p_target_id: projectId,
      p_role: 'editor',
      p_email: member.email,
    }),
  )
  await ok(member.db.rpc('rpc_accept_invite', { p_token: (invite as { token: string }).token }))
}

async function addTask(user: User, projectId: string, title: string): Promise<string> {
  const row = await ok(
    user.db
      .from('tasks')
      .insert({ title, project_id: projectId, user_id: user.id })
      .select()
      .single(),
  )
  return row.id
}

interface Heard {
  table: string
  type: string
  row: Record<string, unknown>
}

/** Subscribes the way the app does (postgres_changes, every event) and records what arrives. */
async function listen(user: User): Promise<Heard[]> {
  const heard: Heard[] = []
  const channel = user.db.channel(`listen:${user.id}`)
  for (const table of ['tasks', 'progress_logs']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) =>
      heard.push({ table, type: payload.eventType, row: payload.new as Record<string, unknown> }),
    )
  }
  // Not SUBSCRIBED: that is the channel join, and on a cold server the replication subscription
  // behind it lands a moment later. The server says so in a system message; wait for that.
  await new Promise<void>((resolve, reject) => {
    channel.on('system', {}, (message: { extension?: string; status?: string }) => {
      if (message.extension !== 'postgres_changes') return
      if (message.status === 'ok') resolve()
      else reject(new Error(JSON.stringify(message)))
    })
    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(err ?? new Error(status))
    })
  })
  return heard
}

const heardTask = (heard: Heard[], title: string) =>
  heard.some((h) => h.table === 'tasks' && h.row.title === title)
const heardNote = (heard: Heard[], note: string) =>
  heard.some((h) => h.table === 'progress_logs' && h.row.note === note)

test('RLS decides who hears a change: no stranger, no foreign project, no note from before joining', async () => {
  const [o, e, s] = await Promise.all([signUp('o'), signUp('e'), signUp('s')])
  const shared = await project(o, 'Shared')
  const priv = await project(o, 'Private')
  const strangers = await project(s, 'Elsewhere')
  await shareAsEditor(o, shared, e)

  const [oHeard, eHeard, sHeard] = await Promise.all([listen(o), listen(e), listen(s)])

  await test.step('every subscription is live', async () => {
    // A positive event per listener first, so the silences below cannot be a dead socket.
    await addTask(o, shared, 'Warm-up')
    await addTask(s, strangers, 'Own business')
    await expect.poll(() => heardTask(oHeard, 'Warm-up') && heardTask(eHeard, 'Warm-up')).toBe(true)
    await expect.poll(() => heardTask(sHeard, 'Own business')).toBe(true)
  })

  await test.step('O works in both projects and backdates a note', async () => {
    const privateTask = await addTask(o, priv, 'Private plan')
    await ok(o.db.from('tasks').update({ title: 'Private plan v2' }).eq('id', privateTask))
    // Written now, dated before E joined: progress_logs_select_member hides it from E. Two inserts,
    // not one: a bulk insert sends the union of the keys, so the second row's created_at is null.
    await ok(
      o.db.from('progress_logs').insert({
        user_id: o.id,
        project_id: shared,
        note: 'Before E',
        created_at: '2000-01-01T00:00:00Z',
      }),
    )
    await ok(
      o.db.from('progress_logs').insert({ user_id: o.id, project_id: shared, note: 'After E' }),
    )
    await addTask(o, shared, 'Shared plan')
  })

  await test.step('members hear what they may read, and only that', async () => {
    await expect
      .poll(() => heardNote(eHeard, 'After E') && heardTask(eHeard, 'Shared plan'))
      .toBe(true)
    // The owner hears all of it, so every event below was really sent.
    await expect
      .poll(() => heardNote(oHeard, 'Before E') && heardTask(oHeard, 'Private plan v2'))
      .toBe(true)
    // Different subscribers, no ordering between them: give the stragglers a moment.
    await new Promise((resolve) => setTimeout(resolve, 2_000))

    expect(heardNote(eHeard, 'Before E')).toBe(false)
    expect(eHeard.filter((h) => h.row.project_id === priv)).toEqual([])
    expect(sHeard.map((h) => h.row.title)).toEqual(['Own business'])
  })

  await Promise.all([o, e, s].map((u) => u.db.removeAllChannels()))
})

/** Realtime channels the page holds open, read off the socket the way the server sees them. */
function trackChannels(page: Page): () => number {
  const open = new Map<WebSocket, Set<string>>()
  page.on('websocket', (ws) => {
    const topics = new Set<string>()
    open.set(ws, topics)
    ws.on('framesent', ({ payload }) => {
      if (typeof payload !== 'string') return
      let message: unknown
      try {
        message = JSON.parse(payload)
      } catch {
        return // Vite's HMR socket, not Phoenix
      }
      // Phoenix serializer 2.0 sends [join_ref, ref, topic, event, payload]; 1.0 an object.
      const [topic, event] = Array.isArray(message)
        ? [message[2], message[3]]
        : [(message as { topic?: string }).topic, (message as { event?: string }).event]
      if (event === 'phx_join') topics.add(topic)
      if (event === 'phx_leave') topics.delete(topic)
    })
    ws.on('close', () => open.delete(ws))
  })
  return () => [...open.values()].reduce((sum, topics) => sum + topics.size, 0)
}

async function signIn(page: Page, user: User) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByLabel('Password').press('Enter')
  await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
}

test("E's changes land on O's screen without a reload; losing access sends E back to the list", async ({
  browser,
}) => {
  const [o, e] = await Promise.all([signUp('o'), signUp('e')])
  const shared = await project(o, 'Rigging')
  await shareAsEditor(o, shared, e)

  const oContext = await browser.newContext()
  const eContext = await browser.newContext()
  const oPage = await oContext.newPage()
  const ePage = await eContext.newPage()
  const oChannels = trackChannels(oPage)

  await test.step('both open the shared project', async () => {
    await signIn(oPage, o)
    // In-app navigation, not goto: a page load would start a fresh socket and prove nothing.
    await oPage.getByRole('link', { name: 'Areas' }).click()
    await oPage.getByRole('link', { name: /Rigging area/ }).click()
    await oPage.getByRole('link', { name: 'Rigging' }).click()
    await expect(oPage.getByRole('heading', { name: 'Rigging' })).toBeVisible()

    await signIn(ePage, e)
    await ePage.goto(`/projects/${shared}`)
    await expect(ePage.getByRole('heading', { name: 'Rigging' })).toBeVisible()
  })

  await test.step('one channel for the session, however many screens it crossed', async () => {
    await expect.poll(oChannels).toBe(1)
  })

  await test.step('E adds a task, O sees it', async () => {
    await ePage.getByRole('textbox', { name: 'New task' }).fill('Rope')
    await ePage.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(oPage.getByRole('radiogroup', { name: 'Status for Rope' })).toBeVisible()
  })

  await test.step('E moves it to in progress, O sees it', async () => {
    const radio = 'Status for Rope: In progress'
    await ePage.getByRole('radio', { name: radio }).click()
    await expect(oPage.getByRole('radio', { name: radio })).toHaveAttribute('aria-checked', 'true')
  })

  await test.step('O removes E, E is sent back to the list', async () => {
    await ok(
      o.db.rpc('rpc_remove_member', {
        p_target_type: 'project',
        p_target_id: shared,
        p_user: e.id,
      }),
    )
    await expect(ePage).toHaveURL(/\/areas$/)
    await expect(ePage.getByText('You no longer have access to that project.')).toBeVisible()
  })

  await test.step('signing out closes the channel', async () => {
    await oPage.getByRole('link', { name: 'Settings' }).click()
    await oPage.getByRole('button', { name: 'Sign out' }).click()
    await expect.poll(oChannels).toBe(0)
  })

  await Promise.all([oContext.close(), eContext.close()])
})
