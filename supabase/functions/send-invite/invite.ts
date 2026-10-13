/** Pure core of send-invite: no Deno, no network of its own, so it can be tested anywhere. */

export interface InviteRequest {
  target_type: 'project' | 'area'
  target_id: string
  role: 'viewer' | 'editor' | 'admin'
  email: string
  project_ids: string[] | null
}

/** Shape check only; the RPC owns every rule (who may invite, which projects, the daily cap). */
export function parseInviteRequest(body: unknown): InviteRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  if (b.target_type !== 'project' && b.target_type !== 'area') return null
  if (typeof b.target_id !== 'string' || typeof b.email !== 'string') return null
  const role = b.role ?? 'viewer'
  if (role !== 'viewer' && role !== 'editor' && role !== 'admin') return null
  const ids = b.project_ids ?? null
  if (ids !== null && !(Array.isArray(ids) && ids.every((id) => typeof id === 'string')))
    return null
  return {
    target_type: b.target_type,
    target_id: b.target_id,
    role,
    email: b.email,
    project_ids: ids,
  }
}

/** SQLSTATE → what the user sees. The raw database message never leaves the server. */
export function friendlyError(code: string | undefined): { status: number; message: string } {
  // PGRST3xx: PostgREST rejected the JWT itself (expired, bad signature).
  if (code?.startsWith('PGRST3')) return { status: 401, message: 'not authenticated' }
  switch (code) {
    case '28000':
      return { status: 401, message: 'not authenticated' }
    case '42501':
      return { status: 403, message: 'You can only invite people to things you administer.' }
    case '54000':
      return { status: 429, message: 'You have sent 20 email invites today — try again tomorrow.' }
    case '22023':
    case '22P02': // malformed uuid
      return { status: 400, message: 'Please check the invite details and try again.' }
    default:
      return { status: 500, message: 'Could not create the invite. Please try again.' }
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export function renderInvite(link: string): { subject: string; html: string } {
  const href = escapeHtml(link)
  return {
    subject: "You've been invited to QuestLog",
    html: `<p>You've been invited to collaborate on QuestLog.</p>
<p><a href="${href}">Accept the invite</a></p>
<p>The link works for 7 days and only for this email address.</p>`,
  }
}

type DbError = { code?: string } | null

export interface InviteDeps {
  /** The web app's base URL, no trailing slash. Also the only CORS origin. */
  appUrl: string
  /** True only for a signed-in user's JWT (not the anon / publishable key). */
  isUser: (authorization: string) => Promise<boolean>
  /** rpc_create_invite as the caller (their Authorization header). */
  createInvite: (
    authorization: string,
    input: InviteRequest,
  ) => Promise<{ data: unknown; error: DbError }>
  revokeInvite: (authorization: string, inviteId: string) => Promise<{ error: DbError }>
  /** Throws when the mail was not accepted. */
  sendMail: (to: string, subject: string, html: string) => Promise<void>
}

export async function handleInvite(request: Request, deps: InviteDeps): Promise<Response> {
  const cors = {
    'Access-Control-Allow-Origin': new URL(deps.appUrl).origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors })

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (request.method !== 'POST') return reply({ error: 'method not allowed' }, 405)

  const authorization = request.headers.get('Authorization') ?? ''
  if (!/^Bearer \S+$/.test(authorization) || !(await deps.isUser(authorization))) {
    return reply({ error: 'not authenticated' }, 401)
  }

  const input = parseInviteRequest(await request.json().catch(() => null))
  if (!input) return reply({ error: friendlyError('22023').message }, 400)

  const { data, error } = await deps.createInvite(authorization, input)
  if (error) {
    console.error('rpc_create_invite failed:', error)
    const { status, message } = friendlyError(error.code)
    return reply({ error: message }, status)
  }

  // Recipient and link come from the invite the RPC approved, not from the request.
  const invite = data as { invite_id: string; token: string; email: string }
  const { subject, html } = renderInvite(`${deps.appUrl}/invite/${invite.token}`)

  try {
    await deps.sendMail(invite.email, subject, html)
  } catch (sendError) {
    console.error('invite mail failed:', sendError)
    // A token nobody received should not stay redeemable.
    const { error: revokeError } = await deps.revokeInvite(authorization, invite.invite_id)
    if (revokeError) console.error('revoking the unsent invite failed:', revokeError)
    return reply({ error: 'Could not send the invite email. Please try again.' }, 502)
  }

  return reply({ invite_id: invite.invite_id })
}
