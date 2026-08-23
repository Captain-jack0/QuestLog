import { createClient } from 'jsr:@supabase/supabase-js@2'
import { renderDigest, subjectFor, type DigestPayload } from './render.ts'
import { signUserId } from '../_shared/unsubscribe-token.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
// Prefer the new-style secret key; the legacy service_role is the fallback until it is revoked.
const SERVICE_KEY = Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const DIGEST_FROM = Deno.env.get('DIGEST_FROM') ?? 'QuestLog <digest@questlog.app>'
const UNSUBSCRIBE_SECRET = Deno.env.get('UNSUBSCRIBE_SECRET')!
const FUNCTIONS_URL = Deno.env.get('FUNCTIONS_URL') ?? `${SUPABASE_URL}/functions/v1`

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

interface Recipient {
  user_id: string
  email: string
  display_name: string
  timezone: string
}

async function sendOne(recipient: Recipient): Promise<'sent' | 'skipped'> {
  const { data, error } = await admin.rpc('digest_payload', { p_user: recipient.user_id })
  if (error) throw error
  const payload = data as unknown as DigestPayload

  // Nothing waiting and no streak to celebrate: silence beats a pointless email.
  if (payload.threads.length === 0 && payload.focus.length === 0 && payload.streak.current === 0) {
    return 'skipped'
  }

  const token = await signUserId(recipient.user_id, UNSUBSCRIBE_SECRET)
  const html = renderDigest(payload, `${FUNCTIONS_URL}/unsubscribe?token=${token}`)

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: DIGEST_FROM,
      to: recipient.email,
      subject: subjectFor(payload),
      html,
    }),
  })

  if (!response.ok) {
    throw new Error(`Resend rejected the mail (${response.status}): ${await response.text()}`)
  }
  return 'sent'
}

Deno.serve(async (request) => {
  const authorization = request.headers.get('Authorization') ?? ''
  // The scheduler proves itself with a secret that can do nothing else.
  const isCron = CRON_SECRET.length > 0 && request.headers.get('X-Cron-Secret') === CRON_SECRET

  try {
    // Test send: the caller's own JWT decides who gets the mail, never a body parameter.
    if (!isCron) {
      const { data, error } = await createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: authorization } },
      }).auth.getUser()
      if (error || !data.user?.email) {
        return Response.json({ error: 'not authenticated' }, { status: 401 })
      }

      const { data: profile } = await admin
        .from('profiles')
        .select('display_name, timezone')
        .eq('id', data.user.id)
        .maybeSingle()

      const result = await sendOne({
        user_id: data.user.id,
        email: data.user.email,
        display_name: profile?.display_name ?? 'Captain',
        timezone: profile?.timezone ?? 'UTC',
      })
      return Response.json({ mode: 'test', result })
    }

    const { data: recipients, error } = await admin.rpc('digest_recipients')
    if (error) throw error

    const results = await Promise.allSettled(
      (recipients as Recipient[]).map((recipient) => sendOne(recipient)),
    )
    const sent = results.filter((r) => r.status === 'fulfilled' && r.value === 'sent').length
    const skipped = results.filter((r) => r.status === 'fulfilled' && r.value === 'skipped').length
    const failed = results.filter((r) => r.status === 'rejected')

    // One bad address must not stop the rest of the run; log and report instead.
    for (const failure of failed) console.error('digest failed:', failure.reason)

    return Response.json({
      mode: 'cron',
      due: results.length,
      sent,
      skipped,
      failed: failed.length,
    })
  } catch (error) {
    console.error(error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'failed' },
      { status: 500 },
    )
  }
})
