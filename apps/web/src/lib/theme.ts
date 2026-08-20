export const THEMES = ['quest', 'calm'] as const
export type Theme = (typeof THEMES)[number]

const STORAGE_KEY = 'questlog:theme'
const DEFAULT: Theme = 'quest'

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

export function storedTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY)
  return isTheme(saved) ? saved : DEFAULT
}

/** Paints the theme and remembers it. Called on boot before React renders. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'quest' ? '#1A143D' : '#FAFAF7')
  localStorage.setItem(STORAGE_KEY, theme)
}
