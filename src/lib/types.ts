import type { Snippet } from 'svelte';

// A non-empty string used as a stable identifier for a view.
export type Id<T extends string = string> = T extends '' ? never : T;

// Whether a split container lays its children side-by-side or stacked.
export type SplitDirection = 'horizontal' | 'vertical';

// Motion intensity for micro-interactions and animations. Consumers can read
// the `data-motion` attribute (set from this value) to gate their own chrome.
// - `full`: entry/zoom animations and hover micro-interactions.
// - `reduced`: micro-transitions only, no entry/zoom animations.
// - `none`: all transitions and animations disabled.
export type Motion = 'full' | 'reduced' | 'none';

// Semantic tone for a view's tab, driven by the state of the pane's content.
export type ViewTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

// Everything HorizonLayout needs to know about a single panel's content.
export interface View {
	title: string;
	// Semantic tone; colours the tab's icon, badge and active accent.
	// Default: 'accent'.
	tone?: ViewTone;
	// When true the icon slot renders a spinner (e.g. a running process).
	busy?: boolean;
	// Optional short badge rendered in the tab — a count or a compact label.
	badge?: string | number;
	// Optional icon rendered inside the tab, to the left of the title.
	icon?: Snippet;
	// The panel body. Rendered inside the active tab's content area.
	snippet: Snippet;
	// Optional controls rendered inside the tab, to the right of the title
	// (e.g. a close button or a badge).
	tabControls?: Snippet<[Id]>[];
	// When false, the built-in close button is hidden even if `onCloseTab` is
	// provided. Default true. Has no effect without `onCloseTab`.
	closable?: boolean;
	// When true, the pane toolbar is suppressed when this view is active.
	hideToolbar?: boolean;
}

// A node that splits its space among two or more children.
export interface SplitConfig {
	direction: SplitDirection;
	// At least two children are required to form a meaningful split.
	views: [NodeConfig, NodeConfig, ...NodeConfig[]];
	// One split-point per gap between views (length === views.length - 1).
	// Each value is a fraction [0, 1] of the container's width or height.
	splitPoints: [number, ...number[]];
}

// A node that holds one or more tabs and shows one at a time.
export interface TabGroupConfig {
	// At least one tab is required.
	tabs: [Id, ...Id[]];

	// Must be a valid index of the tabs array.
	activeTabIndex: number;

	// When true, the group's tabs cannot be dragged out and other tabs cannot
	// be dropped into it. Persisted through cloneConfig/parseLayoutConfig.
	locked?: boolean;
}

export type NodeConfig = SplitConfig | TabGroupConfig;

export interface LayoutConfig {
	root?: NodeConfig;
	// When set, this view fills the entire layout container, hiding everything else.
	maximizedView?: Id;
	// Views rendered in detached browser windows. HorizonLayout opens/closes
	// the windows automatically as this array changes.
	popouts?: Id[];
}

export type Modifier =
	| 'ctrl'
	| 'alt'
	| 'shift'
	| 'ctrl+alt'
	| 'ctrl+shift'
	| 'alt+shift'
	| 'ctrl+alt+shift';

export interface KeyboardShortcut {
	modifier?: Modifier;
	key: string;
}

// A single action triggered by one or more equivalent key combinations.
export interface KeyboardControl<T> {
	shortcuts: KeyboardShortcut[];
	action: (data: T, event: KeyboardEvent) => void;
}

// Controls passed to HorizonLayout. Both arrays are optional; omit either
// to keep the built-in defaults for that category.
export interface KeyboardControls {
	splitControls?: KeyboardControl<{ config: SplitConfig; index: number }>[];
	tabGroupControls?: KeyboardControl<TabGroupConfig>[];
}

// Used internally as an entry in nodeParentMap
export type ParentEntry = { parent: SplitConfig; index: number };
