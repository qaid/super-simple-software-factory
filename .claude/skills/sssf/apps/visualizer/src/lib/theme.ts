/**
 * Theme state: three-way, system by default.
 *
 * "system" writes NO data-theme attribute, so the prefers-color-scheme media
 * query in style.css decides. "light" / "dark" stamp the attribute and win over
 * the query in both directions. The choice persists in localStorage.
 */
import { ref, watchEffect } from 'vue'

export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

const KEY = 'sssf.theme'

/** Labels for the toggle button; the glyph is the whole control. */
export const THEME_META: Record<Theme, { glyph: string; label: string }> = {
  system: { glyph: '◐', label: 'system theme' },
  light: { glyph: '☀', label: 'light theme' },
  dark: { glyph: '☾', label: 'dark theme' },
}

function read(): Theme {
  try {
    const raw = localStorage.getItem(KEY)
    return (THEMES as readonly string[]).includes(raw ?? '') ? (raw as Theme) : 'system'
  } catch {
    // Private-mode or blocked storage: fall back to following the system.
    return 'system'
  }
}

export const theme = ref<Theme>(read())

/** Applies the attribute and persists, on load and on every change. */
watchEffect(() => {
  const root = document.documentElement
  if (theme.value === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme.value)
  try {
    localStorage.setItem(KEY, theme.value)
  } catch {
    /* persistence is a nicety; the applied theme still holds for the session */
  }
})

export function cycleTheme(): void {
  const i = THEMES.indexOf(theme.value)
  theme.value = THEMES[(i + 1) % THEMES.length] ?? 'system'
}
