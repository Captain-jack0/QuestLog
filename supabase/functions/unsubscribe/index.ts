import { createClient } from 'jsr:@supabase/supabase-js@2'
import { verifyToken } from '../_shared/unsubscribe-token.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const UNSUBSCRIBE_SECRET = Deno.env.get('UNSUBSCRIBE_SECRET')!

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

function page(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html><body style="margin:0;background:#FAFAF7;font:400 16px/1.5 -apple-system,Segoe UI,sans-serif;color:#1F2933">
       <div style="max-width:420px;margin:15vh auto;background:#FFF;border-radius:16px;padding:24px;text-align:center">
         <h1 style="margin:0 0 8px;font-size:20px">${title}</h1>
         <p style="margin:0;color:#6B7280">${body}</p>
       </div>
     </body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

// Deployed with --no-verify-jwt: the link is clicked straight from an inbox, and the
// signed token is what authorises the change.
Deno.serve(async (request) => {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  const userId = await verifyToken(token, UNSUBSCRIBE_SECRET)

  if (!userId) {
    return page('That link is not valid', 'Turn the digest off from Settings instead.', 400)
  }

  const { error } = await admin.from('profiles').update({ digest_enabled: false }).eq('id', userId)

  if (error) {
    console.error(error)
    return page('Something went wrong', 'Try again, or turn it off from Settings.', 500)
  }

  return page('Digest turned off 🧭', 'You can switch it back on any time in Settings.')
})
