/**
 * Where a key event originated. Global layout shortcuts are suppressed inside
 * content surfaces (editors, terminals, previews) unless they opt in.
 */
export type ShortcutContext =
	| 'code'
	| 'markdown'
	| 'terminal'
	| 'preview'
	| 'browser'
	| 'chrome'
	| 'pane-toolbar'
	| 'global';

const CONTENT_CONTEXTS: ReadonlySet<ShortcutContext> = new Set([
	'code',
	'markdown',
	'terminal',
	'preview',
	'browser'
]);

/** Resolve the context of an event target, honouring `data-shortcut-context`. */
export function resolveShortcutContext(target: EventTarget | null): ShortcutContext {
	const el = target instanceof HTMLElement ? target : null;
	if (!el) return 'global';

	const marked = el.closest('[data-shortcut-context]');
	if (marked instanceof HTMLElement && marked.dataset['shortcutContext']) {
		return marked.dataset['shortcutContext'] as ShortcutContext;
	}

	if (el.closest('.xterm')) return 'terminal';
	if (el.closest('.cm-editor')) return 'code';
	if (el.closest('.ProseMirror')) return 'markdown';
	if (el.closest('iframe')) return 'preview';

	return 'global';
}

/** True when layout/shell shortcuts may run (i.e. not inside editor surfaces). */
export function allowsShellShortcuts(context: ShortcutContext): boolean {
	return !CONTENT_CONTEXTS.has(context);
}
