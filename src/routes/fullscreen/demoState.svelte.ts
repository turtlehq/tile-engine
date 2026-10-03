import { browser } from '$app/environment';
import type { LayoutConfig } from '$lib/types.js';
import type { ShortcutChord } from '$lib/shortcuts/types.js';
import { parseLayoutConfig } from '$lib/utils.js';

export type DemoTheme = 'dark' | 'light' | 'studio';
export type DemoStyle = 'border' | 'soft' | 'accent' | 'thin';
export type DemoSurface = 'flush' | 'card' | 'inset';

export interface DemoSettings {
	theme: DemoTheme;
	style: DemoStyle;
	surface: DemoSurface;
	accent: string;
	pad: number;
	inset: number;
	tabGap: number;
	tabH: number;
	toolbarH: number;
	minWidthRatio: number;
	minHeightRatio: number;
	maxDepth: number;
	disableResizeSplits: boolean;
	disableDragAndDrop: boolean;
	hideTabBar: boolean;
	keepAlive: boolean;
	tabCycleButtons: boolean;
}

export const DEFAULT_SETTINGS: DemoSettings = {
	theme: 'dark',
	style: 'accent',
	surface: 'flush',
	accent: '#3db8ff',
	pad: 6,
	inset: 8,
	tabGap: 4,
	tabH: 28,
	toolbarH: 28,
	minWidthRatio: 0.1,
	minHeightRatio: 0.2,
	maxDepth: 6,
	disableResizeSplits: false,
	disableDragAndDrop: false,
	hideTabBar: false,
	keepAlive: true,
	tabCycleButtons: true
};

const SETTINGS_KEY = 'horizon-layout:fullscreen:settings:v1';
const CHORDS_KEY = 'horizon-layout:fullscreen:chords:v1';
const LAYOUT_KEY = 'horizon-layout:fullscreen:layout:v1';

function readJson<T>(key: string): T | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : null;
	} catch {
		return null;
	}
}

function writeJson(key: string, value: unknown) {
	if (!browser) return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// ignore quota / private-mode failures
	}
}

/** Reactive demo settings. Mutate properties directly. */
export const settings = $state<DemoSettings>({
	...DEFAULT_SETTINGS,
	...(readJson<Partial<DemoSettings>>(SETTINGS_KEY) ?? {})
});

/** Per-action chord overrides keyed by action id (`null` unbinds). */
export const chordOverrides = $state<Record<string, ShortcutChord | null>>(
	readJson<Record<string, ShortcutChord | null>>(CHORDS_KEY) ?? {}
);

export function persistSettings() {
	writeJson(SETTINGS_KEY, { ...settings });
}

export function persistChords() {
	writeJson(CHORDS_KEY, { ...chordOverrides });
}

export function resetSettings() {
	Object.assign(settings, DEFAULT_SETTINGS);
	persistSettings();
}

export function loadSavedLayout(): LayoutConfig | null {
	const raw = readJson<unknown>(LAYOUT_KEY);
	if (!raw) return null;
	try {
		return parseLayoutConfig(raw);
	} catch {
		return null;
	}
}

export function persistLayout(config: LayoutConfig) {
	writeJson(LAYOUT_KEY, config);
}

export function clearSavedLayout() {
	if (!browser) return;
	try {
		localStorage.removeItem(LAYOUT_KEY);
	} catch {
		// ignore
	}
}
