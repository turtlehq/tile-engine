import { allowsShellShortcuts, resolveShortcutContext } from './shortcutContext.ts';
import { matchShortcutKey } from './matchKey.ts';
import { getNormalizedModifier, hasChordPrefix } from './mod.ts';
import type { ShortcutChord, ShortcutRegistration, ShortcutRoot } from './types.ts';

const DEDUP_MS = 100;

function chordKey(chord: ShortcutChord): string {
	return `${chord.modifier ?? ''}|${chord.key}`;
}

function isScoped(reg: ShortcutRegistration): boolean {
	return reg.when !== undefined || reg.priority !== undefined;
}

function assertNoChordConflicts(registrations: ShortcutRegistration[]) {
	const seen = new Map<string, ShortcutRegistration>();
	for (const reg of registrations) {
		for (const chord of reg.chords) {
			const key = chordKey(chord);
			const existing = seen.get(key);
			if (existing && existing.id !== reg.id && !isScoped(existing) && !isScoped(reg)) {
				console.warn(
					`[horizon-layout:shortcuts] chord conflict: "${key}" registered by both "${existing.id}" and "${reg.id}"`
				);
			}
			seen.set(key, reg);
		}
	}
}

/**
 * Create a window-level shortcut dispatcher that matches normalized chords in
 * the capture phase. Registrations are de-duplicated within a short window and
 * scoped by {@link resolveShortcutContext}.
 */
export function createShortcutRoot(): ShortcutRoot {
	const hasWindow = typeof window !== 'undefined';
	const registrations: ShortcutRegistration[] = [];
	const recentHandled = new Map<string, number>();
	let destroyed = false;

	function sorted(): ShortcutRegistration[] {
		return [...registrations].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
	}

	function isDuplicate(id: string): boolean {
		const at = recentHandled.get(id);
		return at !== undefined && Date.now() - at < DEDUP_MS;
	}

	function markHandled(id: string) {
		recentHandled.set(id, Date.now());
	}

	function onKeyDown(event: KeyboardEvent) {
		if (destroyed || event.repeat) return;
		if (!hasChordPrefix(event)) return;

		const modifier = getNormalizedModifier(event);
		const context = resolveShortcutContext(event.target);

		for (const reg of sorted()) {
			for (const chord of reg.chords) {
				if (chord.modifier !== modifier) continue;
				if (!matchShortcutKey(event, chord.key)) continue;

				if (reg.allowInContent !== true && !allowsShellShortcuts(context)) continue;
				if (reg.when && !reg.when(context)) continue;
				if (isDuplicate(reg.id)) continue;

				event.preventDefault();
				event.stopImmediatePropagation();
				reg.handler(event);
				markHandled(reg.id);
				return;
			}
		}
	}

	if (hasWindow) window.addEventListener('keydown', onKeyDown, { capture: true });

	return {
		register(registration) {
			registrations.push(registration);
			assertNoChordConflicts(registrations);
		},
		unregister(id) {
			const index = registrations.findIndex((reg) => reg.id === id);
			if (index >= 0) registrations.splice(index, 1);
		},
		invokeById(id) {
			if (destroyed || isDuplicate(id)) return;
			const reg = registrations.find((entry) => entry.id === id);
			if (!reg) return;
			reg.handler(new KeyboardEvent('keydown'));
			markHandled(id);
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			if (hasWindow) window.removeEventListener('keydown', onKeyDown, { capture: true });
			registrations.length = 0;
			recentHandled.clear();
		}
	};
}
