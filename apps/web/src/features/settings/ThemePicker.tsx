import { useState } from 'react'
import { applyTheme, storedTheme, type Theme } from '../../lib/theme'

const OPTIONS: { value: Theme; label: string; hint: string; swatch: string }[] = [
  {
    value: 'quest',
    label: 'Quest',
    hint: 'Night sky, gamified',
    swatch: 'linear-gradient(140deg,#081230 0%,#173A7A 60%,#4C8DFF 100%)',
  },
  {
    value: 'calm',
    label: 'Calm',
    hint: 'Daylight, quiet',
    swatch: 'linear-gradient(140deg,#FAFAF7 0%,#FFFFFF 60%,#2F4FB5 100%)',
  },
]

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
            className={`rounded-xl border p-3 text-left ${
              active ? 'border-accent ring-2 ring-accent' : 'border-line'
            }`}
          >
            <span
              aria-hidden
              className="block h-12 w-full rounded-lg"
              style={{ backgroundImage: option.swatch }}
            />
            <span className="mt-2 block font-semibold">{option.label}</span>
            <span className="block text-xs text-muted">{option.hint}</span>
          </button>
        )
      })}
    </div>
  )
}
