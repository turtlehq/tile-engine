import type { ShortcutContext } from '../shortcuts/shortcutContext.ts';
import type { ShortcutChord } from '../shortcuts/types.ts';
import type { LayoutHandle } from '../operations.ts';

export type ActionCategoryId = 'layout' | 'tab' | 'navigation' | 'editor' | 'system';

/**
 * A single command that can be surfaced as a keyboard shortcut, a command
 * palette entry, or a menu item. `chord`/`altChords` drive shortcut binding.
 */
export interface ActionDef {
	id: string;
	label: string;
	category: ActionCategoryId;
	/** Primary chord, shown in keybinding UIs. */
	chord?: ShortcutChord;
	/** Aliases / platform-specific chords. */
	altChords?: ShortcutChord[];
	keywords?: string[];
	/** Omit from palette/menu surfaces; shortcut-only. */
	hidden?: boolean;
	allowInContent?: boolean;
	when?: (context: ShortcutContext) => boolean;
	priority?: number;
	run: () => void;
}

export interface LayoutActionOptions {
	/** Resolve the layout handle that subsequent actions target. */
	resolveLayout: () => LayoutHandle | null;
	/**
	 * Per-action chord overrides. `null` keeps the action available (palette /
	 * menu) but unbinds it; omit a key to keep the built-in default.
	 */
	chords?: Record<string, ShortcutChord | null>;
	/** Register a new tab in the active group. Omit to hide `tab.new`. */
	onNewTab?: () => void;
	/** Open the host settings surface. Omit to hide `settings.open`. */
	onOpenSettings?: () => void;
	/** Open the host command palette. Omit to hide `commandPalette.toggle`. */
	onCommandPalette?: () => void;
	/** Cycle the host appearance theme. Omit to hide `theme.toggle`. */
	onToggleTheme?: () => void;
}
