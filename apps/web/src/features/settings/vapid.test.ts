import { describe, expect, it } from 'vitest'
import { urlBase64ToUint8Array } from './vapid'

describe('urlBase64ToUint8Array', () => {
  it('decodes a padded base64 string byte for byte', () => {
    expect([...urlBase64ToUint8Array(btoa('hey'))]).toEqual([104, 101, 121])
  })

  it('restores the padding VAPID keys leave off', () => {
    // "QuestLog" -> UXVlc3RMb2c= ; the URL-safe form drops the trailing '='
    expect([...urlBase64ToUint8Array('UXVlc3RMb2c')]).toEqual([
      ...urlBase64ToUint8Array('UXVlc3RMb2c='),
    ])
  })

  it('accepts the URL-safe alphabet', () => {
    const bytes = urlBase64ToUint8Array('-_-_')
    expect([...bytes]).toEqual([...urlBase64ToUint8Array('+/+/')])
    expect(bytes).toHaveLength(3)
  })
})
