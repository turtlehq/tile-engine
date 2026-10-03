import type { ShortcutContext } from './shortcutContext.ts';

/**
 * Platform-primary modifier token: `mod` is ⌘ on macOS and Ctrl elsewhere.
 * Compound tokens describe the full modifier set of a chord.
 */
export type Mod =
	| 'mod'
	| 'mod+alt'
	| 'mod+shift'
	| 'mod+alt+ctrl'
	| 'mod+alt+shift'
	| 'alt'
	| 'shift'
	| 'ctrl'
	| 'ctrl+alt'
	| 'ctrl+shift'
	| 'alt+shift'
	| 'ctrl+alt+shift';

export interface ShortcutChord {
	modifier?: Mod;
	key: string;
}

export interface ShortcutRegistration {
	id: string;
	chords: ShortcutChord[];
	/** When true, suppressed inside editor/content surfaces. Default: false. */
	allowInContent?: boolean;
	when?: (context: ShortcutContext) => boolean;
	handler: (event: KeyboardEvent) => void;
	/** Higher priority wins when multiple shortcuts match. */
	priority?: number;
}

/** Handle returned by {@link createShortcutRoot}. */
export interface ShortcutRoot {
	register: (registration: ShortcutRegistration) => void;
	unregister: (id: string) => void;
	invokeById: (id: string, source?: 'menu' | 'keydown') => void;
	destroy: () => void;
}
