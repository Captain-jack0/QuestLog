import { createClient } from 'jsr:@supabase/supabase-js@2'
import { handleInvite } from './invite.ts'

function required(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`send-invite: ${name} is not set`)
  return value
}

// Fail at boot, not on the first invite.
const SUPABASE_URL = required('SUPABASE_URL')
// Prefer the new-style publishable key; the legacy anon key is the fallback.
const ANON_KEY = Deno.env.get('SB_PUBLISHABLE_KEY') ?? required('SUPABASE_ANON_KEY')
const RESEND_API_KEY = required('RESEND_API_KEY')
const APP_URL = required('APP_URL').replace(/\/+$/, '')
const INVITE_FROM = Deno.env.get('INVITE_FROM') ?? 'QuestLog <invites@questlog.app>'

// The caller's own JWT: rpc_create_invite decides who may invite whom, as that user.
const asCaller = (authorization: string) =>
  createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authorization } },
  })

Deno.serve((request) =>
  handleInvite(request, {
    appUrl: APP_URL,
    // An anon / publishable key has no user behind it, so auth.getUser fails for it.
    isUser: async (authorization) => {
      const { data, error } = await asCaller(authorization).auth.getUser(authorization.slice(7))
      return !error && data.user !== null
    },
    createInvite: (authorization, input) =>
      asCaller(authorization).rpc('rpc_create_invite', {
        p_target_type: input.target_type,
        p_target_id: input.target_id,
        p_role: input.role,
        p_email: input.email,
        p_project_ids: input.project_ids,
      }),
    revokeInvite: (authorization, inviteId) =>
      asCaller(authorization).rpc('rpc_revoke_invite', { p_invite_id: inviteId }),
    sendMail: async (to, subject, html) => {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: INVITE_FROM, to, subject, html }),
      })
      if (!response.ok) {
        throw new Error(`Resend rejected the mail (${response.status}): ${await response.text()}`)
      }
    },
  }),
)
