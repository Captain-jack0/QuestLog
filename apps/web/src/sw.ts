/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

interface PushBody {
  title?: string
  body?: string
  url?: string
}

// App shell only — the data never gets precached.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Supabase REST/auth/functions: try the network, fall back to the last good answer.
registerRoute(
  ({ url }) => /\/(rest|auth|functions)\/v1\//.test(url.pathname),
  new NetworkFirst({ cacheName: 'supabase-api', networkTimeoutSeconds: 5 }),
)

self.addEventListener('install', () => {
  void self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload: PushBody = {}
  try {
    payload = (event.data?.json() as PushBody) ?? {}
  } catch {
    // a push without JSON still deserves a notification
    payload = { body: event.data?.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'QuestLog', {
      body: payload.body ?? 'A thread is waiting for you.',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: 'questlog-reminder',
      data: { url: payload.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data as { url?: string })?.url ?? '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Reuse an open tab when there is one; only open a new one as a last resort.
      for (const client of clients) {
        if ('focus' in client) {
          void client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
