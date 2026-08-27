import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type Tone = 'info' | 'xp' | 'error'

interface Toast {
  id: number
  message: string
  tone: Tone
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {})

// Toasts float over arbitrary content, so every tone stays fully opaque — a tinted
// background would borrow whatever is behind it and lose its contrast. Text is `paper`,
// the theme's own backdrop colour, which is the far end of the scale from any fill.
export const tones: Record<Tone, string> = {
  info: 'bg-ink text-paper',
  xp: 'bg-accent text-paper',
  error: 'bg-alert-ink text-paper',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const show = useCallback((message: string, tone: Tone = 'info') => {
    const id = nextId.current++
    setToasts((all) => [...all, { id, message, tone }])
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), 2600)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            // Errors are assertive; a polite `status` region can sit unread while a save
            // silently failed. The tone decides, so the rest stay polite.
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`animate-[slide-up_180ms_ease-out] rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${tones[t.tone]}`}
          >
            {/* A second, non-colour channel: hue alone separates error from info by only
                1.69:1 in luminance, which colour-blind eyes cannot rely on. The role above
                already carries the meaning, so the glyph is decorative to a screen reader. */}
            {t.tone === 'error' && (
              <span aria-hidden="true" className="mr-1.5">
                ⚠
              </span>
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
