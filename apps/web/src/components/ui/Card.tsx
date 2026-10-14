import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Thin colour edge, used for life-area colours. */
  edgeColor?: string | null
  children: ReactNode
}

// Depth is a 1px hairline, not a shadow: on the night sky a shadow has nothing darker to fall
// on, and on paper the line is what separates white card from cream page (DESIGN.md,
// "Elevation & Depth").
export function Card({ edgeColor, className = '', children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={`relative overflow-hidden rounded-card border border-line bg-surface p-4 ${className}`}
    >
      {edgeColor && (
        // The area palette is light — pastels and the brighter spectrum hues alike sit at
        // ~1.3–2.5:1 against the calm (white) surface: invisible, and this edge is the only
        // signal of which area a card belongs to. A 1px `--ink` border bounds it: the token
        // flips with the theme, so it reads dark on paper and light on the night sky. 6px wide
        // keeps the colour core at the original 4px once both borders are taken out (border-box).
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
