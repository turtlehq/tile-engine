import type { ActionDef, LayoutActionOptions } from './types.ts';
import type { ShortcutChord } from '../shortcuts/types.ts';

/** Filter an action list to those that declare at least one chord. */
export function chordedActions(actions: ActionDef[]): ActionDef[] {
	return actions.filter((action) => action.chord ?? action.altChords?.length);
}

/**
 * The built-in layout action catalog: tab navigation/reordering, pane splits,
 * framing (maximize), and optional host hooks (new tab, settings, palette,
 * theme). Every layout action resolves its target lazily through
 * `options.resolveLayout`, so a single catalog can drive whichever pane is
 * active at invocation time.
 */
export function buildLayoutActionCatalog(options: LayoutActionOptions): ActionDef[] {
	const { resolveLayout, onNewTab, onOpenSettings, onCommandPalette, onToggleTheme } = options;
	const overrides = options.chords;
	const actions: ActionDef[] = [];

	const layout = () => resolveLayout();

	/**
	 * Resolve an action's effective chord, honouring overrides (null = unbind).
	 * The override is read unconditionally so reactive callers re-derive when a
	 * previously-absent override key is added.
	 */
	const chord = (id: string, fallback: ShortcutChord): ShortcutChord | undefined => {
		const override = overrides ? overrides[id] : undefined;
		if (overrides && Object.prototype.hasOwnProperty.call(overrides, id)) {
			return override ?? undefined;
		}
		return fallback;
	};

	const push = (action: ActionDef | null) => {
		if (action) actions.push(action);
	};

	push({
		id: 'tab.close',
		label: 'Close tab',
		category: 'tab',
		chord: chord('tab.close', { modifier: 'alt', key: 'x' }),
		allowInContent: true,
		keywords: ['close', 'kill'],
		run: () => layout()?.closeActiveTab()
	});

	push({
		id: 'tab.next',
		label: 'Next tab',
		category: 'tab',
		chord: chord('tab.next', { modifier: 'mod', key: '.' }),
		allowInContent: true,
		run: () => layout()?.selectAdjacentTab(1)
	});

	push({
		id: 'tab.prev',
		label: 'Previous tab',
		category: 'tab',
		chord: chord('tab.prev', { modifier: 'mod', key: ',' }),
		allowInContent: true,
		run: () => layout()?.selectAdjacentTab(-1)
	});

	push({
		id: 'tab.moveRight',
		label: 'Move tab right',
		category: 'tab',
		chord: chord('tab.moveRight', { modifier: 'alt', key: '.' }),
		allowInContent: true,
		keywords: ['reorder', 'shift'],
		run: () => layout()?.moveActiveTab(1)
	});

	push({
		id: 'tab.moveLeft',
		label: 'Move tab left',
		category: 'tab',
		chord: chord('tab.moveLeft', { modifier: 'alt', key: ',' }),
		allowInContent: true,
		keywords: ['reorder', 'shift'],
		run: () => layout()?.moveActiveTab(-1)
	});

	push({
		id: 'tab.appendPane',
		label: 'New pane right',
		category: 'tab',
		chord: chord('tab.appendPane', { modifier: 'mod', key: '/' }),
		allowInContent: true,
		keywords: ['split', 'pane', 'blank', 'right', 'horizontal'],
		run: () => layout()?.appendActivePane()
	});

	push(
		onNewTab
			? {
					id: 'tab.new',
					label: 'New tab',
					category: 'tab',
					chord: chord('tab.new', { modifier: 'mod', key: ' ' }),
					allowInContent: true,
					keywords: ['blank', 'empty', 'pane', 'tab'],
					run: () => onNewTab()
				}
			: null
	);

	push({
		id: 'layout.splitRight',
		label: 'Split right',
		category: 'layout',
		chord: chord('layout.splitRight', { modifier: 'mod', key: '\\' }),
		allowInContent: true,
		keywords: ['split', 'horizontal', 'right'],
		run: () => layout()?.splitActivePane('right')
	});

	push({
		id: 'layout.splitDown',
		label: 'Split down',
		category: 'layout',
		chord: chord('layout.splitDown', { modifier: 'mod+alt', key: '\\' }),
		allowInContent: true,
		keywords: ['split', 'vertical', 'down'],
		run: () => layout()?.splitActivePane('down')
	});

	push({
		id: 'layout.splitFibonacci',
		label: 'Fibonacci split',
		category: 'layout',
		chord: chord('layout.splitFibonacci', { modifier: 'mod+shift', key: '/' }),
		allowInContent: true,
		keywords: ['split', 'fibonacci', 'spiral'],
		run: () => layout()?.splitActivePaneFibonacci()
	});

	push({
		id: 'layout.frame',
		label: 'Frame active pane',
		category: 'layout',
		chord: chord('layout.frame', { modifier: 'mod', key: 'g' }),
		allowInContent: true,
		keywords: ['maximize', 'fullscreen', 'focus'],
		run: () => layout()?.frameActive()
	});

	push(
		onOpenSettings
			? {
					id: 'settings.open',
					label: 'Open settings',
					category: 'system',
					chord: chord('settings.open', { modifier: 'mod+shift', key: ',' }),
					allowInContent: true,
					keywords: ['preferences', 'options', 'keybindings'],
					run: () => onOpenSettings()
				}
			: null
	);

	push(
		onCommandPalette
			? {
					id: 'commandPalette.toggle',
					label: 'Command palette',
					category: 'system',
					chord: chord('commandPalette.toggle', { modifier: 'mod', key: 'k' }),
					allowInContent: true,
					keywords: ['search', 'commands'],
					run: () => onCommandPalette()
				}
			: null
	);

	push(
		onToggleTheme
			? {
					id: 'theme.toggle',
					label: 'Toggle theme',
					category: 'system',
					chord: chord('theme.toggle', { modifier: 'alt', key: 't' }),
					allowInContent: true,
					keywords: ['theme', 'appearance', 'color', 'dark', 'light'],
					run: () => onToggleTheme()
				}
			: null
	);

	return actions;
}
