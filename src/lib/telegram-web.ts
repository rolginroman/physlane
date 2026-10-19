/**
 * Thin, dependency-free wrapper around the Telegram WebApp SDK
 * (telegram-web-app.js, loaded in __root head). Every call is safe outside
 * the Telegram client: getWebApp() returns null there and every SDK method
 * that can throw (ready/expand/MainButton/…) is wrapped in try/catch.
 *
 * SSR-safe: getWebApp() checks typeof window, so imports from server code
 * are fine as long as SDK calls happen in effects.
 */

export interface TelegramSafeArea {
	top?: number
	bottom?: number
	left?: number
	right?: number
}

/** Minimal local typing of the SDK surface we use (no @telegram/types dep). */
export interface TelegramWebApp {
	/** EMPTY STRING outside the Telegram client — check truthiness, not undefined. */
	initData: string
	version?: string
	platform?: string
	colorScheme?: string
	safeAreaInset?: TelegramSafeArea
	ready(): void
	expand(): void
	close?(): void
	disableVerticalSwipes?(): void
	setBackgroundColor?(color: string): void
	setHeaderColor?(color: string): void
	onEvent?(event: string, listener: () => void): void
	offEvent?(event: string, listener: () => void): void
	MainButton: {
		setText(text: string): void
		show(): void
		hide(): void
		onClick(listener: () => void): void
		offClick(listener: () => void): void
	}
	BackButton: {
		show(): void
		hide(): void
		onClick(listener: () => void): void
		offClick(listener: () => void): void
	}
	HapticFeedback: {
		impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
		notificationOccurred(type: 'error' | 'success' | 'warning'): void
	}
}

declare global {
	interface Window {
		Telegram?: { WebApp?: TelegramWebApp }
	}
}

/** The SDK object, or null outside Telegram / before the SDK loads / during SSR. */
export function getWebApp(): TelegramWebApp | null {
	if (typeof window === 'undefined') return null
	return window.Telegram?.WebApp ?? null
}

/** True only inside the Telegram client (the SDK exists everywhere but initData is '' outside). */
export function isTelegram(): boolean {
	const tg = getWebApp()
	return Boolean(tg && tg.initData)
}

/** ready() + expand(); both throw outside the Telegram client, so never call bare. */
export function safeReady(): void {
	const tg = getWebApp()
	if (!tg) return
	try {
		tg.ready()
		tg.expand()
	} catch {
		// Outside the TG client — the web app keeps its default behavior.
	}
}

/** Match Telegram header/background chrome to the app canvas color (no-op outside Telegram). */
export function applyChrome(color: string): void {
	const tg = getWebApp()
	if (!tg) return
	try {
		tg.setBackgroundColor?.(color)
		tg.setHeaderColor?.(color)
	} catch {
		// Older clients may reject hex here; the default chrome is close enough.
	}
}

/** Stop the mini app from closing on vertical swipes (scroll stays native). */
export function disableVerticalSwipes(): void {
	try {
		getWebApp()?.disableVerticalSwipes?.()
	} catch {
		// Pre-7.7 clients don't have it; nothing to do.
	}
}

/**
 * Show the MainButton with `text` wired to `onClick`.
 * Returns a cleanup that unregisters the click and hides the button.
 */
export function showMainButton(text: string, onClick: () => void): () => void {
	const tg = getWebApp()
	if (!tg) return () => {}
	try {
		tg.MainButton.setText(text)
		tg.MainButton.onClick(onClick)
		tg.MainButton.show()
	} catch {
		// Outside the TG client the button does not exist.
	}
	return () => {
		try {
			tg.MainButton.offClick(onClick)
			tg.MainButton.hide()
		} catch {
			// Ignore.
		}
	}
}

/** Hide the MainButton (listeners are cleaned up by the showMainButton cleanup). */
export function hideMainButton(): void {
	const tg = getWebApp()
	if (!tg) return
	try {
		tg.MainButton.hide()
	} catch {
		// Ignore.
	}
}

/** Light tap or success buzz. No-op outside Telegram. */
export function haptic(kind: 'light' | 'success'): void {
	const tg = getWebApp()
	if (!tg) return
	try {
		if (kind === 'success') tg.HapticFeedback.notificationOccurred('success')
		else tg.HapticFeedback.impactOccurred('light')
	} catch {
		// Ignore.
	}
}

/**
 * Show/hide the BackButton, optionally wired to `onClick`.
 * Returns a cleanup that unregisters the click and hides the button.
 */
export function backButton(show: boolean, onClick?: () => void): () => void {
	const tg = getWebApp()
	if (!tg) return () => {}
	try {
		if (show) {
			if (onClick) tg.BackButton.onClick(onClick)
			tg.BackButton.show()
		} else {
			tg.BackButton.hide()
		}
	} catch {
		// Outside the TG client the button does not exist.
	}
	return () => {
		try {
			if (onClick) tg.BackButton.offClick(onClick)
			tg.BackButton.hide()
		} catch {
			// Ignore.
		}
	}
}
