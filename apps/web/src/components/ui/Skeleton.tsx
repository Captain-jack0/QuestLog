/** Placeholder blocks that keep the layout still while data lands. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-line/50 ${className}`} />
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  )
}
