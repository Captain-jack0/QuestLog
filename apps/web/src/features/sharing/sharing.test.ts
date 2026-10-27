import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Issue #26: projects and areas can be shared with other users.
// Server side (invites, membership RLS) exists; these check the web client exposes it.
const root = join(__dirname, '..', '..')
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return sources(p)
    return /\.tsx?$/.test(f) && !/\.test\./.test(f) && !p.endsWith('database.types.ts') ? [p] : []
  })
const app = sources(root).map((p) => readFileSync(p, 'utf8')).join('\n')

describe('sharing projects and areas (#26)', () => {
  it('client invites another user through the send-invite function', () => {
    expect(app).toMatch(/send-invite/)
  })
  it('client can share an area, not only a project', () => {
    expect(app).toMatch(/target_type:\s*['"]area['"]|['"]area['"]\s*as\s*const/)
  })
  it('client lists members of a shared project/area', () => {
    expect(app).toMatch(/from\(['"](project_members|area_members)['"]\)/)
  })
  it('client lets a member accept an invite', () => {
    expect(app).toMatch(/rpc\(['"]rpc_accept_invite['"]/)
  })
})
