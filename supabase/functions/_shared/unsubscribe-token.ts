/**
 * Unsubscribe links are clicked from an inbox, so they carry no session — the token is the
 * whole authorisation. It is an HMAC over the user id with a server-side secret, which
 * means a link cannot be forged or edited to unsubscribe somebody else.
 */
const encoder = new TextEncoder()

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

function toBase64Url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function signUserId(userId: string, secret: string): Promise<string> {
  const mac = await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(userId))
  return `${userId}.${toBase64Url(mac)}`
}

/** Returns the user id only when the signature checks out. */
export async function verifyToken(token: string, secret: string): Promise<string | null> {
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const userId = token.slice(0, dot)
  const expected = await signUserId(userId, secret)
  // constant-time-ish: same length compare, no early exit on content
  if (expected.length !== token.length) return null
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i)
  return diff === 0 ? userId : null
}
