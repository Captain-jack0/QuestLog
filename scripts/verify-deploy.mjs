#!/usr/bin/env node
/**
 * Post-deploy smoke check.
 *
 * A build can look perfectly healthy and still be dead: if the Supabase credentials never
 * reach the bundle (a mistyped env var, a CLI that silently refuses to store one, a
 * revoked key), the site serves a blank page and nobody can sign in. This walks the same
 * path a visitor does — fetch the page, read the credentials the browser would use, and
 * make sure Supabase actually accepts them.
 *
 * It also asks the live database whether it has the columns the code expects. CI runs
 * migrations against its own throwaway instance, so a fully green pipeline says nothing about
 * production — a `tasks.priority` migration that never got pushed shipped exactly that way.
 *
 *   node scripts/verify-deploy.mjs [url]
 */

import { readFileSync } from 'node:fs'

const target = process.argv[2] ?? process.env.DEPLOY_URL ?? 'https://quest.captainmery.com'
const checks = []

function record(name, ok, detail) {
  checks.push({ name, ok, detail })
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`)
}

/**
 * Every table and column the app expects, read out of the generated types — the same file
 * `lib/schemas.ts` builds its row types on.
 *
 * Nothing to hand-maintain here on purpose: a per-column list is a list somebody forgets, and
 * then this check quietly stops covering the newest column, which is the only one likely to be
 * missing. THE LIST LIVES IN `apps/web/src/lib/database.types.ts` — regenerate it
 * (`supabase gen types typescript`) when a migration adds a column and the column is covered.
 * A migration whose types were never regenerated is the one gap left.
 */
function expectedColumns() {
  const source = readFileSync(
    new URL('../apps/web/src/lib/database.types.ts', import.meta.url),
    'utf8',
  ).replace(/\r\n/g, '\n')

  // `public.Tables` only: views are derived from the same columns and functions have none.
  const start = source.indexOf('\n    Tables: {', source.indexOf('\n  public: {'))
  const tables = source.slice(start, source.indexOf('\n    Views: {', start))

  return [...tables.matchAll(/^ {6}(\w+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/gm)].map(
    ([, table, rows]) => [table, [...rows.matchAll(/^ {10}(\w+):/gm)].map(([, column]) => column)],
  )
}

async function main() {
  console.log(`\nQuestLog deploy check → ${target}\n`)

  const page = await fetch(target, { redirect: 'follow' })
  record('page responds', page.ok, `HTTP ${page.status}`)
  const html = await page.text()

  const headers = page.headers
  record(
    'security headers',
    Boolean(headers.get('content-security-policy')) &&
      headers.get('x-content-type-options') === 'nosniff',
    `csp=${Boolean(headers.get('content-security-policy'))} nosniff=${headers.get('x-content-type-options')}`,
  )

  const bundlePath = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0]
  record('bundle referenced', Boolean(bundlePath), bundlePath ?? 'no script tag found')
  if (!bundlePath) return finish()

  const bundle = await (await fetch(new URL(`/${bundlePath}`, target))).text()

  // The credentials the browser will actually use, read out of the shipped code.
  const supabaseUrl = bundle.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0]
  const key = bundle.match(
    /sb_publishable_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]+/,
  )?.[0]

  record('supabase url in bundle', Boolean(supabaseUrl), supabaseUrl ?? 'missing')
  record(
    'api key in bundle',
    Boolean(key),
    key ? `${key.slice(0, 18)}…` : 'missing — the app will throw on boot',
  )
  if (!supabaseUrl || !key) return finish()

  // The key existing is not the same as the key working: a revoked one looks identical.
  const settings = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: key } })
  const body = await settings.text()
  record(
    'supabase accepts the key',
    settings.ok,
    settings.ok ? 'auth reachable' : `HTTP ${settings.status} ${body.slice(0, 80)}`,
  )

  if (settings.ok) {
    const config = JSON.parse(body)
    record('signups', true, config.disable_signup ? 'closed' : 'OPEN to anyone')
    record(
      'email confirmation',
      !config.mailer_autoconfirm,
      config.mailer_autoconfirm ? 'DISABLED' : 'required',
    )
  }

  // RLS is what keeps one account out of another's rows; prove it from the outside.
  const leak = await fetch(`${supabaseUrl}/rest/v1/projects?select=id&limit=1`, {
    headers: { apikey: key },
  })
  const rows = leak.ok ? await leak.json() : null
  record(
    'rls blocks anonymous reads',
    Array.isArray(rows) && rows.length === 0,
    Array.isArray(rows) ? `${rows.length} rows returned` : `HTTP ${leak.status}`,
  )

  // Schema drift. PostgREST resolves the column list before RLS ever filters a row, so asking
  // for every expected column and reading the error is enough to tell "that column does not
  // exist" from "no rows for you" — with the anonymous key, no write access, nothing to grant
  // CI. This is the check that would have caught the priority column that never got pushed.
  const missing = []
  let verified = 0
  let unreadable = 0

  for (const [table, columns] of expectedColumns()) {
    const probe = await fetch(
      `${supabaseUrl}/rest/v1/${table}?select=${columns.join(',')}&limit=1`,
      {
        headers: { apikey: key },
      },
    )
    if (probe.ok) {
      verified += 1
      continue
    }
    const failure = await probe.json().catch(() => ({}))
    // 42501 is "no grant for anon": a table sealed off from the outside is correct, not broken,
    // and there is no way to inspect it from out here. Everything else — 42703 undefined
    // column, PGRST204 stale schema cache — is the drift we came for, and the message names it.
    if (failure.code === '42501') unreadable += 1
    else missing.push(`${table}: ${failure.message ?? `HTTP ${probe.status}`}`)
  }

  record(
    'live schema has the columns the code expects',
    // `verified > 0` is not padding: if every table came back unreadable this check has proven
    // nothing, and passing on no evidence at all is how the last broken deploy got through.
    missing.length === 0 && verified > 0,
    missing.length > 0
      ? missing.join(' · ')
      : `${verified} tables checked, ${unreadable} not readable anonymously`,
  )

  finish()
}

function finish() {
  const failed = checks.filter((c) => !c.ok)
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`)
  if (failed.length) {
    console.error('Deploy is not healthy:', failed.map((f) => f.name).join(', '))
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('check crashed:', error.message)
  process.exit(1)
})
