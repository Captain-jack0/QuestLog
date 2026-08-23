#!/usr/bin/env node
/**
 * Dumps every user-owned table to one JSON file.
 *
 * Reads through the REST API with the secret key rather than pg_dump, so it needs no
 * database password and no network access beyond HTTPS — which is what makes it runnable
 * from a scheduled GitHub Action.
 *
 *   SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/backup.mjs [outfile]
 */

import { TABLES } from './tables.mjs'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY

if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SECRET_KEY are required')
  process.exit(1)
}

const PAGE = 1000

async function fetchAll(table) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&order=id.asc`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${from}-${from + PAGE - 1}`,
      },
    })
    if (!response.ok) {
      throw new Error(`${table}: HTTP ${response.status} ${(await response.text()).slice(0, 120)}`)
    }
    const page = await response.json()
    rows.push(...page)
    if (page.length < PAGE) return rows
  }
}

async function main() {
  const out = process.argv[2] ?? `questlog-backup-${new Date().toISOString().slice(0, 10)}.json`
  const bundle = { exported_at: new Date().toISOString(), source: url, tables: {} }

  for (const table of TABLES) {
    // streaks has no id column; order by its own primary key instead
    const rows = await fetchAll(table).catch(async (error) => {
      if (!String(error.message).includes('42703')) throw error
      const response = await fetch(`${url}/rest/v1/${table}?select=*`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      })
      return response.json()
    })
    bundle.tables[table] = rows
    console.log(`  ${table.padEnd(20)} ${rows.length}`)
  }

  const total = Object.values(bundle.tables).reduce((sum, rows) => sum + rows.length, 0)
  if (total === 0) {
    console.error('refusing to write an empty backup — the credentials may be wrong')
    process.exit(1)
  }

  const { writeFileSync } = await import('node:fs')
  writeFileSync(out, JSON.stringify(bundle, null, 1), 'utf8')
  console.log(`\n${total} rows → ${out}`)
}

main().catch((error) => {
  console.error('backup failed:', error.message)
  process.exit(1)
})
