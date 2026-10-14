import { levelProgress } from './areaSummary'

const RADIUS = 20
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** An area's level as a ring filling towards the next one (lib/xp curve, v_area_stats XP). */
export function LevelRing({ totalXp }: { totalXp: number }) {
  const { level, ceiling, ratio } = levelProgress(totalXp)
  return (
    <svg
      viewBox="0 0 48 48"
      className="h-12 w-12 shrink-0"
      role="img"
      aria-label={`Level ${level}, ${totalXp} of ${ceiling} XP`}
    >
      <circle cx="24" cy="24" r={RADIUS} fill="none" strokeWidth="4" className="stroke-line" />
      <circle
        cx="24"
        cy="24"
        r={RADIUS}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
        transform="rotate(-90 24 24)"
        className="stroke-accent"
      />
      <text
        x="24"
        y="24"
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-ink text-caption font-bold"
      >
        L{level}
      </text>
    </svg>
  )
}
