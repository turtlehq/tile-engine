import type { Mod } from './types.ts';

/** True on Apple platforms, where the primary modifier is ⌘ rather than Ctrl. */
export function isMacPlatform(): boolean {
	if (typeof navigator === 'undefined') return false;
	return /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
}

/** Map keyboard state to a normalized modifier token (`mod` = ⌘ / Ctrl). */
export function getNormalizedModifier(event: KeyboardEvent): Mod | null {
	const mac = isMacPlatform();
	const { metaKey, ctrlKey, altKey, shiftKey } = event;
	const mod = mac ? metaKey : ctrlKey;

	if (mod && altKey && ctrlKey && !shiftKey) return 'mod+alt+ctrl';
	if (mod && altKey && shiftKey) return 'mod+alt+shift';
	if (mod && altKey) return 'mod+alt';
	if (mod && shiftKey) return 'mod+shift';
	if (ctrlKey && altKey && shiftKey && !mod) return 'ctrl+alt+shift';
	if (altKey && shiftKey && !mod && !ctrlKey) return 'alt+shift';
	if (ctrlKey && shiftKey && !mod) return 'ctrl+shift';
	if (ctrlKey && altKey && !mod) return 'ctrl+alt';
	if (shiftKey && !mod && !altKey && !ctrlKey) return 'shift';
	if (altKey && !mod && !shiftKey) return 'alt';
	if (mod) return 'mod';
	if (ctrlKey) return 'ctrl';
	return null;
}

/** True when the event carries a modifier worth matching against a chord. */
export function hasChordPrefix(event: KeyboardEvent): boolean {
	return getNormalizedModifier(event) !== null;
}

const MOD_SYMBOLS: Record<string, string> = {
	mod: '⌘',
	ctrl: '⌃',
	alt: '⌥',
	shift: '⇧'
};

const KEY_LABELS: Record<string, string> = {
	ArrowLeft: '←',
	ArrowRight: '→',
	ArrowUp: '↑',
	ArrowDown: '↓',
	Enter: '↩',
	Escape: 'Esc',
	' ': 'Space',
	'\\': '\\'
};

/**
 * Render a chord (or array of chords) as a compact platform-aware label.
 * On non-Apple platforms `mod` renders as `Ctrl`.
 */
export function formatChord(chord: ShortcutChordLike, separator = '+'): string {
	const mac = isMacPlatform();
	const parts: string[] = [];
	const modifier = chord.modifier ?? '';
	if (modifier) {
		for (const token of modifier.split('+')) {
			if (token === 'mod') parts.push(mac ? '⌘' : 'Ctrl');
			else
				parts.push(mac ? (MOD_SYMBOLS[token] ?? token) : token[0]!.toUpperCase() + token.slice(1));
		}
	}
	const key = chord.key;
	parts.push(KEY_LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : key));
	return parts.join(separator);
}

export interface ShortcutChordLike {
	modifier?: string;
	key: string;
}
