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
 *   node scripts/verify-deploy.mjs [url]
 */

const target = process.argv[2] ?? process.env.DEPLOY_URL ?? 'https://quest.captainmery.com'
const checks = []

function record(name, ok, detail) {
  checks.push({ name, ok, detail })
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`)
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
