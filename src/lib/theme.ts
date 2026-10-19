import { applyChrome } from './telegram-web'

export type ThemePreference = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'physlane-theme'

export const THEME_PREFERENCE_CHANGE = 'physlane-theme-change'

export const THEME_COLORS = {
  light: '#F7F4EE',
  dark: '#101112',
} as const

export const themeBootstrapScript = `(function(){try{var k='${THEME_STORAGE_KEY}';var p=localStorage.getItem(k)||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);var t=d?'dark':'light';var r=document.documentElement;r.setAttribute('data-theme',t);r.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',d?'${THEME_COLORS.dark}':'${THEME_COLORS.light}');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'dark') return 'dark'
  if (preference === 'light') return 'light'
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export function readThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

export function subscribeThemePreference(onStoreChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) onStoreChange()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(THEME_PREFERENCE_CHANGE, onStoreChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(THEME_PREFERENCE_CHANGE, onStoreChange)
  }
}

export function setThemePreference(preference: ThemePreference) {
  localStorage.setItem(THEME_STORAGE_KEY, preference)
  window.dispatchEvent(new Event(THEME_PREFERENCE_CHANGE))
}

export function applyResolvedTheme(resolved: 'light' | 'dark') {
  const root = document.documentElement
  root.setAttribute('data-theme', resolved)
  root.style.colorScheme = resolved
  const themeColor = resolved === 'dark' ? THEME_COLORS.dark : THEME_COLORS.light
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', themeColor)
  applyChrome(themeColor)
}

export function applyThemePreference(preference: ThemePreference) {
  applyResolvedTheme(resolveTheme(preference))
}
