/**
 * The mark: a compass needle drawn as one unbroken thread that loops back on itself.
 * A thread you can follow back to where you were — which is the whole product — and it
 * reads as a Q at a glance.
 */
export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" role="img" aria-label="QuestLog" className={className}>
      <defs>
        <linearGradient id="questlog-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgb(var(--accent))" />
          <stop offset="100%" stopColor="rgb(var(--success))" />
        </linearGradient>
      </defs>
      <circle
        cx="16"
        cy="16"
        r="13"
        fill="none"
        stroke="url(#questlog-mark)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="61 20"
        transform="rotate(-45 16 16)"
      />
      {/* the needle: one stroke out, one stroke back */}
      <path
        d="M22 10 L14.5 17.5 L10 22 L17.5 14.5 Z"
        fill="url(#questlog-mark)"
        stroke="url(#questlog-mark)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="1.6" fill="rgb(var(--paper))" />
    </svg>
  )
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <LogoMark className="h-7 w-7" />
      <span className="text-lg font-semibold tracking-tight">QuestLog</span>
    </span>
  )
}
