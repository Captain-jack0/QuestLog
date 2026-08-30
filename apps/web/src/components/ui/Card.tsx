import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Thin colour edge, used for life-area colours. */
  edgeColor?: string | null
  children: ReactNode
}

export function Card({ edgeColor, className = '', children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={`relative overflow-hidden rounded-card bg-surface p-4 shadow-sm ${className}`}
    >
      {edgeColor && (
        // The area palette is pastel, so on the calm (white) theme the bare fill sits at
        // ~1.3:1 against the surface — invisible, and this edge is the only signal of which
        // area a card belongs to. A 1px `--ink` border bounds it: the token flips with the
        // theme, so it reads dark on paper and light on the night sky. 6px wide keeps the
        // pastel core at the original 4px once both borders are taken out (border-box).
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1.5 border border-ink/55"
          style={{ backgroundColor: edgeColor }}
        />
      )}
      {children}
    </div>
  )
}
