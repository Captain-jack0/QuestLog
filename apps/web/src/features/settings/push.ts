import { supabase } from '../../lib/supabase'
import { urlBase64ToUint8Array } from './vapid'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * Asks for permission, subscribes through the service worker and stores the subscription.
 * Throws with a readable message so Settings can show it and roll the toggle back.
 */
export async function subscribeToPush(userId: string): Promise<void> {
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidKey) throw new Error('Push is not configured — VITE_VAPID_PUBLIC_KEY is missing')
  if (!pushSupported()) throw new Error('This browser cannot do web push')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notifications are blocked — allow them in your browser settings')
  }

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      // BufferSource: TS types Uint8Array over a generic buffer, PushManager does not care
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    }))

  const json = subscription.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      keys: json.keys ?? {},
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}
