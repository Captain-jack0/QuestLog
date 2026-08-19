export interface DigestPayload {
  display_name: string
  streak: { current: number; best: number }
  focus: { title: string; completed: boolean }[]
  threads: {
    title: string
    project_title: string
    area_name: string | null
    next_step: string | null
    last_activity_at: string
  }[]
}

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return map[c]
  })

export function subjectFor(payload: DigestPayload): string {
  const count = payload.threads.length
  if (count === 0) return 'QuestLog — a clean slate today'
  return `QuestLog — ${count} thread${count === 1 ? '' : 's'} waiting`
}

/** Inlined styles only: every mail client strips <style> sooner or later. */
export function renderDigest(payload: DigestPayload, unsubscribeUrl: string): string {
  const { display_name, streak, focus, threads } = payload

  const greeting =
    threads.length === 0
      ? 'Nothing is hanging. Enjoy the quiet, or start something new.'
      : `${threads.length} thread${threads.length === 1 ? '' : 's'} ${threads.length === 1 ? 'is' : 'are'} waiting for you.`

  const focusHtml = focus.length
    ? `<p style="margin:24px 0 8px;font:600 12px/1.4 -apple-system,Segoe UI,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#6B7280">Today's focus</p>
       <ul style="margin:0;padding-left:20px;font:400 15px/1.6 -apple-system,Segoe UI,sans-serif;color:#1F2933">
         ${focus
           .map((item) => `<li>${item.completed ? '✓ ' : ''}${escape(item.title)}</li>`)
           .join('')}
       </ul>`
    : ''

  const threadsHtml = threads
    .map(
      (thread) => `
      <tr><td style="padding:12px 0;border-bottom:1px solid #EEE">
        <div style="font:600 16px/1.3 -apple-system,Segoe UI,sans-serif;color:#1F2933">${escape(thread.title)}</div>
        <div style="font:400 12px/1.5 -apple-system,Segoe UI,sans-serif;color:#6B7280">${escape(
          [thread.area_name, thread.project_title].filter(Boolean).join(' · '),
        )}</div>
        ${
          thread.next_step
            ? `<div style="margin-top:6px;font:500 15px/1.5 -apple-system,Segoe UI,sans-serif;color:#5B5BD6">Next: ${escape(thread.next_step)}</div>`
            : ''
        }
      </td></tr>`,
    )
    .join('')

  return `<!doctype html>
<html><body style="margin:0;background:#FAFAF7;padding:24px">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#FFF;border-radius:16px;padding:24px">
    <tr><td>
      <h1 style="margin:0 0 4px;font:700 20px/1.3 -apple-system,Segoe UI,sans-serif;color:#1F2933">
        Good morning, ${escape(display_name)} 🧭
      </h1>
      <p style="margin:0;font:400 15px/1.5 -apple-system,Segoe UI,sans-serif;color:#1F2933">${greeting}</p>
      <p style="margin:8px 0 0;font:600 13px/1.5 -apple-system,Segoe UI,sans-serif;color:#E8833A">
        🔥 ${streak.current}-day streak${streak.best > streak.current ? ` · best ${streak.best}` : ''}
      </p>
      ${focusHtml}
      ${
        threads.length
          ? `<p style="margin:24px 0 4px;font:600 12px/1.4 -apple-system,Segoe UI,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#6B7280">Hanging threads</p>
             <table role="presentation" width="100%">${threadsHtml}</table>`
          : ''
      }
      <p style="margin:28px 0 0;font:400 12px/1.5 -apple-system,Segoe UI,sans-serif;color:#6B7280">
        <a href="${unsubscribeUrl}" style="color:#6B7280">Stop these emails</a>
      </p>
    </td></tr>
  </table>
</body></html>`
}
