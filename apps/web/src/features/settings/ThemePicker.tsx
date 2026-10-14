import { useState } from 'react'
import { Icon, type IconName } from '../../components/ui/Icon'
import { applyTheme, storedTheme, type Theme } from '../../lib/theme'

const OPTIONS: { value: Theme; label: string; hint: string; icon: IconName }[] = [
  { value: 'quest', label: 'Quest', hint: 'Night sky, gamified', icon: 'dark_mode' },
  { value: 'calm', label: 'Calm', hint: 'Daylight, quiet', icon: 'light_mode' },
]

// A handful of the sky's stars, so the Quest thumbnail reads as night before it reads as navy.
const STARS = [
  'radial-gradient(1px 1px at 12% 22%, rgb(255 255 255 / 0.9), transparent 100%)',
  'radial-gradient(1px 1px at 84% 14%, rgb(255 255 255 / 0.7), transparent 100%)',
  'radial-gradient(1px 1px at 68% 78%, rgb(255 255 255 / 0.6), transparent 100%)',
  'radial-gradient(1px 1px at 30% 86%, rgb(255 255 255 / 0.5), transparent 100%)',
  'radial-gradient(1px 1px at 92% 58%, rgb(255 255 255 / 0.8), transparent 100%)',
].join(',')

/**
 * Each thumbnail is a tiny card painted in *its own* theme: `data-theme` on the wrapper scopes
 * that theme's tokens (index.css keys them on the attribute, not on <html>), so the preview is
 * the real palette whichever theme is active — no second copy of the colours to drift.
 */
function Preview({ theme }: { theme: Theme }) {
  return (
    <span
      aria-hidden
      data-theme={theme}
      className="relative block h-20 overflow-hidden rounded-lg border border-line bg-paper"
      style={theme === 'quest' ? { backgroundImage: STARS } : undefined}
    >
      <span className="absolute inset-x-3 top-3 block rounded-md border border-line bg-surface p-2">
        <span className="block h-1.5 w-2/3 rounded-full bg-ink/70" />
        <span className="mt-1.5 block h-1.5 w-1/3 rounded-full bg-muted/60" />
        <span className="mt-2 flex items-center gap-1.5">
          <span className="block h-1.5 w-1/2 rounded-full bg-accent" />
          <span className="block h-1.5 w-1.5 rounded-full bg-flame" />
        </span>
      </span>
    </span>
  )
}

/** Repaints immediately — no save button, because nothing else is worth a round trip. */
export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>(() => storedTheme())

  return (
    <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-3">
      {OPTIONS.map((option) => {
        const active = option.value === theme
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              setTheme(option.value)
              applyTheme(option.value)
            }}
            className={`rounded-xl border bg-surface-sunken p-3 text-left transition ${
              active ? 'border-accent ring-2 ring-accent' : 'border-line'
            }`}
          >
            <Preview theme={option.value} />
            <span className="mt-3 flex items-center gap-1.5 text-body-medium">
              <Icon name={option.icon} className="icon-lg text-muted" />
              {option.label}
              {/* aria-checked already says it; the badge is for eyes only. */}
              {active && (
                <span
                  aria-hidden
                  className="ml-auto inline-flex items-center gap-0.5 text-micro uppercase text-accent-ink"
                >
                  <Icon name="check" /> Active
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-caption text-muted">{option.hint}</span>
          </button>
        )
      })}
    </div>
  )
}
