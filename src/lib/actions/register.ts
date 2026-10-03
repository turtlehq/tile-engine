import type { ShortcutRoot } from '../shortcuts/types.ts';
import type { ActionDef } from './types.ts';

/**
 * Bind every catalog action that declares a chord to a shortcut root.
 * Actions without a chord are menu/palette-only. Returns an unbind function.
 */
export function registerActionShortcuts(root: ShortcutRoot, actions: ActionDef[]): () => void {
	const bound: string[] = [];

	for (const action of actions) {
		if (!action.chord && !(action.altChords?.length ?? 0)) continue;
		const chords = action.chord
			? [action.chord, ...(action.altChords ?? [])]
			: (action.altChords ?? []);

		root.register({
			id: action.id,
			chords,
			allowInContent: action.allowInContent ?? false,
			when: action.when,
			priority: action.priority,
			handler: () => action.run()
		});
		bound.push(action.id);
	}

	return () => {
		for (const id of bound) root.unregister(id);
	};
}
