#!/usr/bin/env node
/**
 * Puts a backup back.
 *
 * Rows are upserted in dependency order, so running it against a database that still has
 * some of the data is safe: what is there gets refreshed, what is missing comes back. It
 * never deletes anything — recovering from a mistake should not be able to cause one.
 *
 *   SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/restore.mjs backup.json [--dry-run]
 */

import { readFileSync } from 'node:fs'
import { TABLES } from './tables.mjs'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
const file = process.argv[2]
const dryRun = process.argv.includes('--dry-run')

if (!url || !key || !file) {
  console.error(
    'usage: SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/restore.mjs <file> [--dry-run]',
  )
  process.exit(1)
}

// The catalogue ships with the schema; restoring it would only fight the migration.
const SKIP = new Set(['badges'])

async function main() {
  const bundle = JSON.parse(readFileSync(file, 'utf8'))
  console.log(`\nrestoring ${file} (taken ${bundle.exported_at}) → ${url}`)
  if (dryRun) console.log('DRY RUN — nothing will be written\n')

  for (const table of TABLES) {
    const rows = bundle.tables?.[table] ?? []
    if (rows.length === 0 || SKIP.has(table)) {
      console.log(`  ${table.padEnd(20)} ${SKIP.has(table) ? 'skipped' : 'empty'}`)
      continue
    }
    if (dryRun) {
      console.log(`  ${table.padEnd(20)} would upsert ${rows.length}`)
      continue
    }

    const response = await fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    })
    if (!response.ok) {
      throw new Error(`${table}: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`)
    }
    console.log(`  ${table.padEnd(20)} ${rows.length} upserted`)
  }
  console.log('\ndone')
}

main().catch((error) => {
  console.error('restore failed:', error.message)
  process.exit(1)
})
