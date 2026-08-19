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
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: edgeColor }}
        />
      )}
      {children}
    </div>
  )
}
