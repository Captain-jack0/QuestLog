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

// Tables whose updated_at the touch triggers re-stamp on every write (#67). Children first, so
// a parent is set last and nothing below it can move it again.
const TOUCHED = ['tasks', 'projects', 'life_areas']

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
}

/**
 * The upserts above went through the touch triggers, which stamp now() on each row and carry
 * it up to the parent, so every area and project now reads "touched just now". This writes the
 * backup's values back through an RPC that holds the triggers off, then reads them to prove it.
 */
async function restoreUpdatedAt(bundle) {
  for (const table of TOUCHED) {
    const rows = (bundle.tables?.[table] ?? []).map(({ id, updated_at }) => ({ id, updated_at }))
    if (rows.length === 0) continue

    const response = await fetch(`${url}/rest/v1/rpc/rpc_restore_updated_at`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_table: table, p_rows: rows }),
    })
    if (!response.ok) {
      throw new Error(
        `${table} updated_at: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`,
      )
    }

    const wanted = new Map(rows.map((row) => [row.id, Date.parse(row.updated_at)]))
    const drifted = []
    for (const chunk of chunks([...wanted.keys()], 200)) {
      const read = await fetch(
        `${url}/rest/v1/${table}?select=id,updated_at&id=in.(${chunk.join(',')})`,
        { headers },
      )
      if (!read.ok) throw new Error(`${table} verify: HTTP ${read.status}`)
      for (const row of await read.json()) {
        if (Date.parse(row.updated_at) !== wanted.get(row.id)) drifted.push(row.id)
      }
    }
    if (drifted.length > 0) {
      throw new Error(`${table}: updated_at differs from the backup for ${drifted.join(', ')}`)
    }
    console.log(`  ${table.padEnd(20)} updated_at korundu (${rows.length})`)
  }
}

function chunks(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

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
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    })
    if (!response.ok) {
      throw new Error(`${table}: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`)
    }
    console.log(`  ${table.padEnd(20)} ${rows.length} upserted`)
  }
  if (!dryRun) await restoreUpdatedAt(bundle)
  console.log('\ndone')
}

main().catch((error) => {
  console.error('restore failed:', error.message)
  process.exit(1)
})
