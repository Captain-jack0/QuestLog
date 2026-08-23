import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
// Prefer the new-style secret key; the legacy service_role is the fallback until it is revoked.
const SERVICE_KEY = Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hello@questlog.app'

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

interface Recipient {
  user_id: string
  endpoint: string
  keys: { p256dh: string; auth: string }
  display_name: string
  streak_current: number
}

function messageFor(recipient: Recipient): string {
  return recipient.streak_current > 0
    ? `🔥 Your ${recipient.streak_current}-day streak is waiting — 2-minute check-in?`
    : 'A thread is waiting for you — 2-minute check-in?'
}

async function pushOne(recipient: Recipient): Promise<'sent' | 'expired'> {
  try {
    await webpush.sendNotification(
      { endpoint: recipient.endpoint, keys: recipient.keys },
      JSON.stringify({
        title: 'QuestLog 🧭',
        body: messageFor(recipient),
        url: '/',
      }),
    )
    return 'sent'
  } catch (error) {
    // 404/410 mean the browser threw the subscription away; stop mailing a dead endpoint.
    const status = (error as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) {
      await admin.from('push_subscriptions').delete().eq('endpoint', recipient.endpoint)
      return 'expired'
    }
    throw error
  }
}

Deno.serve(async (request) => {
  if (CRON_SECRET.length === 0 || request.headers.get('X-Cron-Secret') !== CRON_SECRET) {
    return Response.json({ error: 'scheduler only' }, { status: 401 })
  }

  try {
    const { data, error } = await admin.rpc('push_recipients')
    if (error) throw error

    const recipients = data as Recipient[]
    const results = await Promise.allSettled(recipients.map((r) => pushOne(r)))

    const sent = results.filter((r) => r.status === 'fulfilled' && r.value === 'sent').length
    const expired = results.filter((r) => r.status === 'fulfilled' && r.value === 'expired').length
    const failed = results.filter((r) => r.status === 'rejected')
    for (const failure of failed) console.error('push failed:', failure.reason)

    return Response.json({ due: recipients.length, sent, expired, failed: failed.length })
  } catch (error) {
    console.error(error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'failed' },
      { status: 500 },
    )
  }
})
