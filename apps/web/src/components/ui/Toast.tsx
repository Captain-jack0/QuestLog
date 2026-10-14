import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type Tone = 'info' | 'xp' | 'error'

/** One button on the toast, e.g. "Undo". The toast stays up longer so it can be reached. */
export interface ToastAction {
  label: string
  onClick: () => void
}

interface Toast {
  id: number
  message: string
  tone: Tone
  action?: ToastAction
}

type ShowToast = (message: string, tone?: Tone, action?: ToastAction) => void

const ToastContext = createContext<ShowToast>(() => {})

// Toasts float over arbitrary content, so every tone stays fully opaque — a tinted
// background would borrow whatever is behind it and lose its contrast. Text is `paper`,
// the theme's own backdrop colour, which is the far end of the scale from any fill.
export const tones: Record<Tone, string> = {
  info: 'bg-ink text-paper',
  xp: 'bg-accent text-paper',
  error: 'bg-alert-ink text-paper',
}

/**
 * A dismiss timer that can be held — while the pointer is over a toast, or the user has put focus
 * on its button —
 * so a toast with a button cannot vanish under the hand reaching for it (WCAG 2.2.1). Holds
 * stack (hover and focus at once); the last release restarts the full time.
 */
export function holdableTimer(ms: number, onDone: () => void) {
  let handle: ReturnType<typeof setTimeout> | undefined
  let holds = 0
  const start = () => {
    clearTimeout(handle)
    handle = setTimeout(onDone, ms)
  }
  start()
  return {
    hold: () => {
      holds += 1
      clearTimeout(handle)
    },
    release: () => {
      holds = Math.max(holds - 1, 0)
      if (holds === 0) start()
    },
    cancel: () => clearTimeout(handle),
  }
}

type HoldableTimer = ReturnType<typeof holdableTimer>

/**
 * Focus holds the timer only when the user brought it (Tab, click) — not when the code did. A
 * focus the app hands over on its own would otherwise pin the toast for good (iOS sends no blur
 * until something else is touched) and leave Space/Enter one stray press from the action.
 * `focusFromCode` marks the focus event it dispatches (synchronously) as the code's.
 */
export function focusHolder(timer: Pick<HoldableTimer, 'hold' | 'release'> | undefined) {
  let fromCode = false
  let held = false
  return {
    focusFromCode: (focus: () => void) => {
      fromCode = true
      try {
        focus()
      } finally {
        fromCode = false
      }
    },
    onFocus: () => {
      if (fromCode || held) return
      held = true
      timer?.hold()
    },
    onBlur: () => {
      if (!held) return
      held = false
      timer?.release()
    },
  }
}

/**
 * Takes focus when it appears: the button that started the action is usually gone by then (a
 * closed sheet, a deleted card), and focus would otherwise drop to <body>. Taken in an effect,
 * after the closing sheet has handed focus back to its opener in the same commit. That focus is
 * the code's, so the toast still closes on time; Enter undoes within it.
 */
function ToastActionButton({
  action,
  timer,
  onDone,
}: {
  action: ToastAction
  timer: HoldableTimer | undefined
  onDone: () => void
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const holder = useRef(focusHolder(timer)).current
  useEffect(() => holder.focusFromCode(() => ref.current?.focus()), [holder])
  return (
    <button
      ref={ref}
      type="button"
      className="min-h-[44px] rounded-full px-3 underline underline-offset-2"
      onFocus={holder.onFocus}
      onBlur={holder.onBlur}
      onClick={() => {
        onDone()
        action.onClick()
      }}
    >
      {action.label}
    </button>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof holdableTimer>>())

  const dismiss = useCallback((id: number) => {
    timers.current.get(id)?.cancel()
    timers.current.delete(id)
    setToasts((all) => all.filter((t) => t.id !== id))
  }, [])

  const show = useCallback<ShowToast>(
    (message, tone = 'info', action) => {
      const id = nextId.current++
      setToasts((all) => [...all, { id, message, tone, action }])
      timers.current.set(
        id,
        holdableTimer(action ? 8000 : 2600, () => dismiss(id)),
      )
    },
    [dismiss],
  )

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
            className={`animate-[slide-up_180ms_ease-out] rounded-full px-4 py-2 text-sm font-semibold shadow-lg ${tones[t.tone]} ${t.action ? 'pointer-events-auto flex items-center gap-2 py-0 pr-1' : ''}`}
            // Only a toast with a button can be hovered (the rest are pointer-events-none), so
            // this only ever holds that kind. Focus is held by the button itself (focusHolder).
            onMouseEnter={() => timers.current.get(t.id)?.hold()}
            onMouseLeave={() => timers.current.get(t.id)?.release()}
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
            {t.action && (
              <ToastActionButton
                action={t.action}
                timer={timers.current.get(t.id)}
                onDone={() => dismiss(t.id)}
              />
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
