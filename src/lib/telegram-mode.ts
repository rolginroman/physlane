import { useEffect, useState } from 'react'
import {
	applyChrome,
	disableVerticalSwipes,
	getWebApp,
	isTelegram,
	safeReady,
} from './telegram-web'
import { readThemePreference, resolveTheme, THEME_COLORS } from './theme'

/**
 * True once the app has mounted inside the Telegram client.
 * Returns false during SSR and the first paint (no hydration mismatch);
 * Telegram-only UI appears right after mount.
 */
export function useTelegramMode(): boolean {
	const [mode, setMode] = useState(false)
	useEffect(() => setMode(isTelegram()), [])
	return mode
}

/**
 * Telegram layout chrome for the shell: signal ready, expand, match the TG
 * chrome to our bg, disable closing vertical swipes, and publish the
 * safe-area insets as CSS vars (--tg-safe-top / --tg-safe-bottom) that the
 * shell uses for padding. No-op outside Telegram.
 */
export function useTelegramChrome(): void {
	useEffect(() => {
		const tg = getWebApp()
		if (!tg || !isTelegram()) return
		safeReady()
		applyChrome(THEME_COLORS[resolveTheme(readThemePreference())])
		disableVerticalSwipes()

		const publishInsets = () => {
			const inset = tg.safeAreaInset
			const root = document.documentElement
			root.style.setProperty('--tg-safe-top', `${inset?.top ?? 0}px`)
			root.style.setProperty('--tg-safe-bottom', `${inset?.bottom ?? 0}px`)
		}
		publishInsets()
		// Insets change on rotation/resize; viewportChanged is the signal.
		try {
			tg.onEvent?.('viewportChanged', publishInsets)
		} catch {
			// Pre-events clients keep the mount-time insets.
		}
		return () => {
			try {
				tg.offEvent?.('viewportChanged', publishInsets)
			} catch {
				// Ignore.
			}
		}
	}, [])
}
