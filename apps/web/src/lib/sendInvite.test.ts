import { describe, expect, it, vi } from 'vitest'
import {
  handleInvite,
  parseInviteRequest,
  renderInvite,
  type InviteDeps,
} from '../../../../supabase/functions/send-invite/invite'

const body = { target_type: 'project', target_id: 'p1', role: 'editor', email: 'n@example.com' }

function deps(over: Partial<InviteDeps> = {}): InviteDeps {
  return {
    appUrl: 'https://quest.example.com',
    isUser: vi.fn(async () => true),
    createInvite: vi.fn(async () => ({
      data: { invite_id: 'i1', token: 'tok', email: 'n@example.com' },
      error: null,
    })),
    revokeInvite: vi.fn(async () => ({ error: null })),
    sendMail: vi.fn(async () => {}),
    ...over,
  }
}

const post = (payload: unknown, auth: string | null = 'Bearer jwt') =>
  new Request('https://fn.example.com/send-invite', {
    method: 'POST',
    headers: auth ? { Authorization: auth } : {},
    body: JSON.stringify(payload),
  })

describe('send-invite', () => {
  it('rejects a request without a JWT before touching the database', async () => {
    const d = deps()
    const res = await handleInvite(post(body, null), d)
    expect(res.status).toBe(401)
    expect(d.createInvite).not.toHaveBeenCalled()
  })

  it('rejects the anon / publishable key (no user behind it) with 401', async () => {
    const d = deps({ isUser: vi.fn(async () => false) })
    const res = await handleInvite(post(body, 'Bearer anon-key'), d)
    expect(res.status).toBe(401)
    expect(d.isUser).toHaveBeenCalledWith('Bearer anon-key')
    expect(d.createInvite).not.toHaveBeenCalled()
  })

  it('answers the CORS preflight for the app origin only', async () => {
    const res = await handleInvite(
      new Request('https://fn.example.com/send-invite', { method: 'OPTIONS' }),
      deps(),
    )
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://quest.example.com')
  })

  it('rejects a malformed body with 400', async () => {
    const d = deps()
    for (const bad of [
      null,
      { ...body, target_type: 'task' },
      { ...body, email: 1 },
      { ...body, role: 'owner' },
    ]) {
      expect((await handleInvite(post(bad), d)).status).toBe(400)
    }
    expect(d.createInvite).not.toHaveBeenCalled()
  })

  it('maps a database error to a friendly message without leaking SQL', async () => {
    const res = await handleInvite(
      post(body),
      deps({
        createInvite: async () => ({
          data: null,
          error: { code: '42501', message: 'not allowed', details: 'select ... from invites' } as {
            code: string
          },
        }),
      }),
    )
    expect(res.status).toBe(403)
    const text = await res.text()
    expect(text).not.toMatch(/not allowed|invites|select/)
  })

  it('mails the RPC-approved address with the token link and returns only the invite id', async () => {
    const d = deps()
    const res = await handleInvite(post({ ...body, email: 'attacker@evil.test' }), d)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ invite_id: 'i1' })
    expect(d.sendMail).toHaveBeenCalledWith(
      'n@example.com',
      expect.any(String),
      expect.stringContaining('https://quest.example.com/invite/tok'),
    )
  })

  it('revokes the invite when the mail cannot be sent', async () => {
    const d = deps({
      sendMail: async () => {
        throw new Error('resend down')
      },
    })
    const res = await handleInvite(post(body), d)
    expect(res.status).toBe(502)
    expect(d.revokeInvite).toHaveBeenCalledWith('Bearer jwt', 'i1')
  })

  it('defaults the role to viewer and escapes the link', () => {
    expect(parseInviteRequest({ ...body, role: undefined })?.role).toBe('viewer')
    expect(renderInvite('https://x/"><script>').html).not.toContain('<script>')
  })
})
