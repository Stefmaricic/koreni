import { create } from 'zustand'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'koreni.theme'

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // ignore (private browsing, etc.) and fall through to system preference
  }
  return systemPrefersDark() ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

interface ThemeState {
  theme: Theme
  toggle: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // best-effort persistence only
    }
    set({ theme: next })
  },
}))

/** Applies the resolved theme before first paint's worth of layout; call once at app startup. */
export function initTheme() {
  const theme = readStoredTheme()
  applyTheme(theme)
  useThemeStore.setState({ theme })
}
