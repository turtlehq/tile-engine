import type {
	Id,
	LayoutConfig,
	NodeConfig,
	ParentEntry,
	SplitConfig,
	TabGroupConfig
} from './types.ts';
import { buildNodeParentMap, cloneConfig, nodeConfigType, simplifyTabGroup } from './utils.ts';
import { DEFAULT_MIN_WIDTH_RATIO, DEFAULT_MIN_HEIGHT_RATIO } from './internal-utils.ts';

/** A directional command used by split operations and the layout handle. */
export type PaneDirection = 'left' | 'right' | 'up' | 'down';

/** A tab group's non-empty tab tuple. */
type TabIds = TabGroupConfig['tabs'];

export interface LayoutOperationOptions {
	/** Maximum nesting depth for splits. Default: 6. */
	maxDepth?: number;
	/** Minimum pane width fraction of its split container. Default: 0.1. */
	minWidthRatio?: number;
	/** Minimum pane height fraction of its split container. Default: 0.2. */
	minHeightRatio?: number;
}

const DEFAULT_MAX_DEPTH = 6;

function splitAxis(direction: PaneDirection): SplitConfig['direction'] {
	return direction === 'left' || direction === 'right' ? 'horizontal' : 'vertical';
}

function asTabIds(tabs: Id[]): TabIds {
	return tabs as TabIds;
}

function resolveOptions(options: LayoutOperationOptions = {}) {
	return {
		maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
		minWidthRatio: options.minWidthRatio ?? DEFAULT_MIN_WIDTH_RATIO,
		minHeightRatio: options.minHeightRatio ?? DEFAULT_MIN_HEIGHT_RATIO
	};
}

/** Depth of a node from the root (root children report 1). */
export function getNodeDepth(
	node: NodeConfig,
	nodeParentMap: ReturnType<typeof buildNodeParentMap>,
	depth = 1
): number {
	const parent = nodeParentMap.get(node);
	if (!parent) return depth;
	return getNodeDepth(parent.parent, nodeParentMap, depth + 1);
}

/** The first tab group in document order. */
export function findFirstTabGroup(node: NodeConfig): TabGroupConfig {
	if (nodeConfigType(node) === 'tabGroup') return node as TabGroupConfig;
	return findFirstTabGroup((node as SplitConfig).views[0]!);
}

/** The tab group that contains `viewId`, or null. */
export function findTabGroupForViewId(node: NodeConfig, viewId: Id): TabGroupConfig | null {
	if (nodeConfigType(node) === 'tabGroup') {
		const tabGroup = node as TabGroupConfig;
		return tabGroup.tabs.includes(viewId) ? tabGroup : null;
	}
	for (const child of (node as SplitConfig).views) {
		const found = findTabGroupForViewId(child, viewId);
		if (found) return found;
	}
	return null;
}

/** Every tab view id in the tree (does not recurse into nested layouts). */
export function collectTabViewIds(config: LayoutConfig): Id[] {
	const ids: Id[] = [];
	if (!config.root) return ids;
	const walk = (node: NodeConfig) => {
		if (nodeConfigType(node) === 'tabGroup') {
			for (const id of (node as TabGroupConfig).tabs) ids.push(id);
			return;
		}
		for (const child of (node as SplitConfig).views) walk(child);
	};
	walk(config.root);
	return ids;
}

/** Midpoint of the split-point gap that precedes `parent.index`. */
export function paneMidpoint(parent: ParentEntry): number {
	return (
		((parent.parent.splitPoints[parent.index - 1] ?? 0) +
			(parent.parent.splitPoints[parent.index] ?? 1)) /
		2
	);
}

/** Whether a tab group can be split along `splitDirection` without violating depth/min constraints. */
export function canSplitTabGroup(
	tabGroup: TabGroupConfig,
	splitDirection: SplitConfig['direction'],
	nodeParentMap: ReturnType<typeof buildNodeParentMap>,
	options: LayoutOperationOptions = {}
): boolean {
	const { maxDepth, minWidthRatio, minHeightRatio } = resolveOptions(options);
	const parent = nodeParentMap.get(tabGroup);

	if (parent?.parent.direction === splitDirection) {
		const minRatio = splitDirection === 'horizontal' ? minWidthRatio : minHeightRatio;
		return (
			((parent.parent.splitPoints[parent.index] ?? 1) -
				(parent.parent.splitPoints[parent.index - 1] ?? 0)) /
				2 >=
			minRatio
		);
	}

	return getNodeDepth(tabGroup, nodeParentMap) + 1 <= maxDepth;
}

function repairSplitPoints(node: NodeConfig, options: LayoutOperationOptions = {}): void {
	const { minWidthRatio, minHeightRatio } = resolveOptions(options);
	if (nodeConfigType(node) === 'tabGroup') return;
	const split = node as SplitConfig;
	const minRatio = split.direction === 'horizontal' ? minWidthRatio : minHeightRatio;
	for (let i = 0; i < split.splitPoints.length; i++) {
		const lower = (split.splitPoints[i - 1] ?? 0) + minRatio;
		const upper = (split.splitPoints[i + 1] ?? 1) - minRatio;
		const clamped = Number(Math.min(Math.max(split.splitPoints[i]!, lower), upper).toFixed(4));
		split.splitPoints[i] = clamped;
	}
	for (const child of split.views) repairSplitPoints(child, options);
}

/**
 * Split a single tab group in `direction`, inserting `newViewId` as the new pane.
 * Mutates `config` (pass a clone) and returns the created view id.
 */
function splitSingleTabGroupInLayout(
	config: LayoutConfig,
	tabGroup: TabGroupConfig,
	direction: PaneDirection,
	newViewId: Id,
	options: LayoutOperationOptions = {}
): { config: LayoutConfig; newViewId: Id | null } {
	if (!config.root) return { config, newViewId: null };

	const splitDirection = splitAxis(direction);
	const nodeParentMap = buildNodeParentMap(config.root);
	if (!canSplitTabGroup(tabGroup, splitDirection, nodeParentMap, options)) {
		return { config, newViewId: null };
	}

	const newGroup: TabGroupConfig = { tabs: [newViewId], activeTabIndex: 0 };
	const parent = nodeParentMap.get(tabGroup);
	const isFirst = direction === 'left' || direction === 'up';

	if (!parent || parent.parent.direction !== splitDirection) {
		const split: SplitConfig = {
			direction: splitDirection,
			views: isFirst ? [newGroup, tabGroup] : [tabGroup, newGroup],
			splitPoints: [0.5]
		};
		if (parent) {
			parent.parent.views[parent.index] = split;
		} else {
			config.root = split;
		}
	} else {
		const insertIndex = parent.index + (isFirst ? 0 : 1);
		parent.parent.views.splice(insertIndex, 0, newGroup);
		parent.parent.splitPoints.splice(parent.index, 0, paneMidpoint(parent));
	}

	if (config.root) repairSplitPoints(config.root, options);
	return { config, newViewId };
}

/**
 * Create a new pane by splitting the tab group that holds `activeTabId`.
 * Set `newViewId` to the view registered by the caller for the new pane.
 */
export function splitNewPaneInLayout(
	config: LayoutConfig,
	activeTabId: Id,
	direction: PaneDirection,
	newViewId: Id,
	options: LayoutOperationOptions = {}
): { config: LayoutConfig; newViewId: Id | null } {
	if (!config.root) return { config, newViewId: null };
	const group = findTabGroupForViewId(config.root, activeTabId);
	if (!group) return { config, newViewId: null };

	const next = cloneConfig(config);
	const clonedGroup = findTabGroupForViewId(next.root!, activeTabId);
	if (!clonedGroup) return { config, newViewId: null };
	return splitSingleTabGroupInLayout(next, clonedGroup, direction, newViewId, options);
}

/**
 * Fibonacci new-pane split: horizontal at odd depth, vertical at even depth,
 * so successive splits tile the space.
 */
export function splitFibonacciNewPaneInLayout(
	config: LayoutConfig,
	activeTabId: Id,
	newViewId: Id,
	options: LayoutOperationOptions = {}
): { config: LayoutConfig; newViewId: Id | null } {
	if (!config.root) return { config, newViewId: null };
	const group = findTabGroupForViewId(config.root, activeTabId);
	if (!group) return { config, newViewId: null };

	const next = cloneConfig(config);
	const clonedGroup = findTabGroupForViewId(next.root!, activeTabId);
	if (!clonedGroup) return { config, newViewId: null };

	const nodeParentMap = buildNodeParentMap(next.root!);
	const depth = getNodeDepth(clonedGroup, nodeParentMap);
	const direction: PaneDirection = depth % 2 === 1 ? 'right' : 'down';
	return splitSingleTabGroupInLayout(next, clonedGroup, direction, newViewId, options);
}

/** Split `viewId` out of a multi-tab group into an adjacent pane. */
export function splitViewInLayout(
	config: LayoutConfig,
	viewId: Id,
	direction: PaneDirection,
	options: LayoutOperationOptions = {}
): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root) return config;

	const tabGroup = findTabGroupForViewId(next.root, viewId);
	if (!tabGroup || tabGroup.tabs.length <= 1) return config;

	const tabIndex = tabGroup.tabs.indexOf(viewId);
	if (tabIndex === -1) return config;

	const splitDirection = splitAxis(direction);
	const nodeParentMap = buildNodeParentMap(next.root);
	if (!canSplitTabGroup(tabGroup, splitDirection, nodeParentMap, options)) return config;

	const tabToSplitOut = tabGroup.tabs[tabIndex]!;
	const oldActiveTabIndex = tabGroup.activeTabIndex;
	const newTabGroup: TabGroupConfig = { tabs: [tabToSplitOut], activeTabIndex: 0 };
	const parent = nodeParentMap.get(tabGroup);
	const isCurrentTabFirst = direction === 'left' || direction === 'up';
	const createsNestedSplit = !parent || parent.parent.direction !== splitDirection;

	tabGroup.tabs = asTabIds(tabGroup.tabs.filter((_, index) => index !== tabIndex));
	tabGroup.activeTabIndex = Math.min(oldActiveTabIndex, tabGroup.tabs.length - 1);

	if (createsNestedSplit) {
		const split: SplitConfig = {
			direction: splitDirection,
			views: isCurrentTabFirst ? [newTabGroup, tabGroup] : [tabGroup, newTabGroup],
			splitPoints: [0.5]
		};
		const tabgroupParent = nodeParentMap.get(tabGroup);
		if (tabgroupParent) {
			tabgroupParent.parent.views[tabgroupParent.index] = split;
		} else {
			next.root = split;
		}
	} else if (parent) {
		const insertIndex = parent.index + (isCurrentTabFirst ? 0 : 1);
		parent.parent.views.splice(insertIndex, 0, newTabGroup);
		parent.parent.splitPoints.splice(parent.index, 0, paneMidpoint(parent));
	}

	if (next.root) repairSplitPoints(next.root, options);
	return next;
}

/** Toggle a view between maximized and normal. */
export function toggleMaximizedView(config: LayoutConfig, viewId: Id): LayoutConfig {
	const next = cloneConfig(config);
	if (next.maximizedView === viewId) {
		delete next.maximizedView;
	} else {
		next.maximizedView = viewId;
	}
	return next;
}

/** Activate `viewId`; when already maximized, keep it maximized. */
export function activateTabInLayout(
	config: LayoutConfig,
	viewId: Id,
	options?: { maximize?: boolean }
): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root || !findTabGroupForViewId(next.root, viewId)) return config;
	const group = findTabGroupForViewId(next.root, viewId)!;
	group.activeTabIndex = group.tabs.indexOf(viewId);
	if (options?.maximize || next.maximizedView) next.maximizedView = viewId;
	return next;
}

/** Cycle the active tab within the group that holds `activeTabId`. */
export function selectAdjacentTabInLayout(
	config: LayoutConfig,
	activeTabId: Id,
	delta: -1 | 1
): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root) return config;

	const group = findTabGroupForViewId(next.root, activeTabId);
	if (!group || group.tabs.length <= 1) return config;

	const currentIndex = group.tabs.indexOf(activeTabId);
	const from = currentIndex >= 0 ? currentIndex : group.activeTabIndex;
	group.activeTabIndex = (from + delta + group.tabs.length) % group.tabs.length;
	const nextId = group.tabs[group.activeTabIndex]!;
	// Keep fullscreen focused on the newly active sibling.
	if (next.maximizedView) next.maximizedView = nextId;
	return next;
}

export const GROUP_VIEW_PREFIX = 'group:';

export function isGroupViewId(id: string): boolean {
	return typeof id === 'string' && id.startsWith(GROUP_VIEW_PREFIX);
}

export function toGroupViewId(id: string): string {
	return `${GROUP_VIEW_PREFIX}${id}`;
}

export function toGroupId(viewId: string): string | null {
	return isGroupViewId(viewId) ? viewId.slice(GROUP_VIEW_PREFIX.length) : null;
}

export interface TabNavLeaf {
	viewId: string;
	groupViewId: string | null;
}

export type SelectAdjacentTabDrillingResult = {
	config: LayoutConfig;
	groupUpdates: Record<string, LayoutConfig>;
	focusViewId: string;
	focusGroupViewId: string | null;
};

function collectTabsInOrder(node: NodeConfig): string[] {
	const tabs: string[] = [];
	const walk = (n: NodeConfig) => {
		if (nodeConfigType(n) === 'tabGroup') {
			for (const id of (n as TabGroupConfig).tabs) tabs.push(id);
			return;
		}
		for (const child of (n as SplitConfig).views) walk(child);
	};
	walk(node);
	return tabs;
}

export function primaryActiveTabId(config: LayoutConfig): string | null {
	if (!config.root) return null;
	if (config.maximizedView) return config.maximizedView;
	const group = findFirstTabGroup(config.root);
	if (!group || group.tabs.length === 0) return null;
	return group.tabs[group.activeTabIndex] ?? group.tabs[0] ?? null;
}

function resolveOuterScopeGroup(
	config: LayoutConfig,
	activeViewId: string,
	groupLayouts: Readonly<Record<string, LayoutConfig>>,
	activeGroupViewId?: string | null
): TabGroupConfig | null {
	if (!config.root) return null;

	if (activeGroupViewId && (activeGroupViewId.startsWith(GROUP_VIEW_PREFIX) || groupLayouts[activeGroupViewId])) {
		return findTabGroupForViewId(config.root, activeGroupViewId);
	}
	if (activeViewId.startsWith(GROUP_VIEW_PREFIX) || groupLayouts[activeViewId]) {
		return findTabGroupForViewId(config.root, activeViewId);
	}
	for (const [groupId, inner] of Object.entries(groupLayouts)) {
		if (!inner?.root || !findTabGroupForViewId(inner.root, activeViewId)) continue;
		const groupViewId = groupId.startsWith(GROUP_VIEW_PREFIX) ? groupId : `${GROUP_VIEW_PREFIX}${groupId}`;
		const found = findTabGroupForViewId(config.root, groupViewId) ?? findTabGroupForViewId(config.root, groupId);
		if (found) return found;
	}
	return findTabGroupForViewId(config.root, activeViewId);
}

/** Flatten one outer tab row, expanding each group into its container tab order. */
export function flattenTabNavigationOrder(
	scopeGroup: TabGroupConfig,
	groupLayouts: Readonly<Record<string, LayoutConfig>>
): TabNavLeaf[] {
	const result: TabNavLeaf[] = [];
	for (const tabId of scopeGroup.tabs) {
		const isPrefixed = tabId.startsWith(GROUP_VIEW_PREFIX);
		const groupId = isPrefixed ? tabId.slice(GROUP_VIEW_PREFIX.length) : tabId;
		const inner = groupLayouts[groupId] ?? groupLayouts[tabId];
		if (!inner?.root) {
			result.push({ viewId: tabId, groupViewId: null });
			continue;
		}
		for (const innerId of collectTabsInOrder(inner.root)) {
			result.push({ viewId: innerId, groupViewId: tabId });
		}
	}
	return result;
}

function resolveTabNavCursor(
	order: readonly TabNavLeaf[],
	activeViewId: string,
	groupLayouts: Readonly<Record<string, LayoutConfig>>,
	activeGroupViewId?: string | null
): TabNavLeaf | null {
	if (order.length === 0) return null;

	const groupContext =
		activeGroupViewId && (activeGroupViewId.startsWith(GROUP_VIEW_PREFIX) || groupLayouts[activeGroupViewId])
			? activeGroupViewId
			: activeViewId.startsWith(GROUP_VIEW_PREFIX) || groupLayouts[activeViewId]
				? activeViewId
				: null;

	if (groupContext) {
		const groupId = groupContext.startsWith(GROUP_VIEW_PREFIX)
			? groupContext.slice(GROUP_VIEW_PREFIX.length)
			: groupContext;
		const inner = groupLayouts[groupId] ?? groupLayouts[groupContext];
		const leafId =
			activeViewId === groupContext || activeViewId.startsWith(GROUP_VIEW_PREFIX)
				? (inner ? primaryActiveTabId(inner) : null)
				: activeViewId;
		if (leafId) {
			const exact = order.find((entry) => entry.groupViewId === groupContext && entry.viewId === leafId);
			if (exact) return exact;
		}
		return order.find((entry) => entry.groupViewId === groupContext) ?? null;
	}

	for (const [groupId, inner] of Object.entries(groupLayouts)) {
		if (!inner?.root || !findTabGroupForViewId(inner.root, activeViewId)) continue;
		const groupViewId = groupId.startsWith(GROUP_VIEW_PREFIX) ? groupId : `${GROUP_VIEW_PREFIX}${groupId}`;
		const exact = order.find(
			(entry) => (entry.groupViewId === groupViewId || entry.groupViewId === groupId) && entry.viewId === activeViewId
		);
		if (exact) return exact;
	}

	return order.find((entry) => entry.groupViewId === null && entry.viewId === activeViewId) ?? null;
}

/**
 * Cycle tabs in the active outer row, drilling into group containers then continuing out.
 * Activation only — does not move tabs across group boundaries.
 */
export function selectAdjacentTabDrillingGroups(
	config: LayoutConfig,
	activeViewId: string,
	delta: -1 | 1,
	groupLayouts: Readonly<Record<string, LayoutConfig>>,
	options?: { activeGroupViewId?: string | null }
): SelectAdjacentTabDrillingResult | null {
	if (!config.root) return null;

	const scopeGroup = resolveOuterScopeGroup(
		config,
		activeViewId,
		groupLayouts,
		options?.activeGroupViewId
	);
	if (!scopeGroup) return null;

	const order = flattenTabNavigationOrder(scopeGroup, groupLayouts);
	if (order.length <= 1) return null;

	const cursor = resolveTabNavCursor(order, activeViewId, groupLayouts, options?.activeGroupViewId);
	if (!cursor) return null;

	const index = order.indexOf(cursor);
	if (index < 0) return null;
	const nextLeaf = order[(index + delta + order.length) % order.length];
	if (!nextLeaf) return null;

	const nextConfig = cloneConfig(config);
	if (!nextConfig.root) return null;
	const groupUpdates: Record<string, LayoutConfig> = {};

	if (nextLeaf.groupViewId) {
		const targetGroup = findTabGroupForViewId(nextConfig.root, nextLeaf.groupViewId);
		if (targetGroup) {
			targetGroup.activeTabIndex = targetGroup.tabs.indexOf(nextLeaf.groupViewId);
		}
		if (nextConfig.maximizedView) nextConfig.maximizedView = nextLeaf.groupViewId;

		const isPrefixed = nextLeaf.groupViewId.startsWith(GROUP_VIEW_PREFIX);
		const groupId = isPrefixed ? nextLeaf.groupViewId.slice(GROUP_VIEW_PREFIX.length) : nextLeaf.groupViewId;
		const source = groupLayouts[groupId] ?? groupLayouts[nextLeaf.groupViewId];
		if (source?.root) {
			const inner = cloneConfig(source);
			if (inner.root) {
				const innerGroup = findTabGroupForViewId(inner.root, nextLeaf.viewId);
				if (innerGroup) {
					innerGroup.activeTabIndex = innerGroup.tabs.indexOf(nextLeaf.viewId);
				}
				if (inner.maximizedView) inner.maximizedView = nextLeaf.viewId;
				groupUpdates[groupId] = inner;
				if (isPrefixed) groupUpdates[nextLeaf.groupViewId] = inner;
			}
		}
	} else {
		const targetGroup = findTabGroupForViewId(nextConfig.root, nextLeaf.viewId);
		if (targetGroup) {
			targetGroup.activeTabIndex = targetGroup.tabs.indexOf(nextLeaf.viewId);
		}
		if (nextConfig.maximizedView) nextConfig.maximizedView = nextLeaf.viewId;
	}

	return {
		config: nextConfig,
		groupUpdates,
		focusViewId: nextLeaf.viewId,
		focusGroupViewId: nextLeaf.groupViewId
	};
}

/** Swap the active tab with its neighbour in the same tab row. */
export function moveActiveTabInLayout(
	config: LayoutConfig,
	activeTabId: Id,
	delta: -1 | 1
): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root) return config;

	const group = findTabGroupForViewId(next.root, activeTabId);
	if (!group || group.tabs.length <= 1) return config;

	const index = group.tabs.indexOf(activeTabId);
	if (index < 0) return config;
	const targetIndex = index + delta;
	if (targetIndex < 0 || targetIndex >= group.tabs.length) return config;

	const tabs = [...group.tabs];
	[tabs[index], tabs[targetIndex]] = [tabs[targetIndex]!, tabs[index]!];
	group.tabs = asTabIds(tabs);
	group.activeTabIndex = targetIndex;
	return next;
}

/** Insert `newViewId` immediately after `anchorViewId` in the same tab row. */
export function insertViewAfterInLayout(
	config: LayoutConfig,
	anchorViewId: Id,
	newViewId: Id
): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root) return config;

	const group = findTabGroupForViewId(next.root, anchorViewId);
	if (!group) return config;

	const index = group.tabs.indexOf(anchorViewId);
	if (index < 0) return config;

	const tabs = [...group.tabs];
	tabs.splice(index + 1, 0, newViewId);
	group.tabs = asTabIds(tabs);
	group.activeTabIndex = index + 1;
	return next;
}

/**
 * Replace `viewId` with `groupViewId` in place (wrap-in-place), keeping the
 * active slot. Returns null when the view cannot be found.
 */
export function wrapViewInGroupInLayout(
	config: LayoutConfig,
	viewId: Id,
	groupViewId: Id
): LayoutConfig | null {
	if (!config.root) return null;
	const next = cloneConfig(config);
	if (!next.root) return null;
	const group = findTabGroupForViewId(next.root, viewId);
	if (!group) return null;

	const index = group.tabs.indexOf(viewId);
	if (index < 0) return null;

	const tabs = [...group.tabs];
	tabs[index] = groupViewId;
	group.tabs = asTabIds(tabs);
	group.activeTabIndex = index;

	if (next.maximizedView === viewId) next.maximizedView = groupViewId;
	return next;
}

/** Remove `viewId` from the layout, collapsing its group/split when it empties. */
export function removeViewFromLayout(config: LayoutConfig, viewId: Id): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root) return config;

	const group = findTabGroupForViewId(next.root, viewId);
	if (!group) return config;

	const index = group.tabs.indexOf(viewId);
	if (index === -1) return config;

	group.tabs = asTabIds(group.tabs.filter((_, i) => i !== index));
	if (group.tabs.length === 0) {
		simplifyTabGroup(group, buildNodeParentMap(next.root), next);
	} else if (group.activeTabIndex >= group.tabs.length) {
		group.activeTabIndex = group.tabs.length - 1;
	}

	if (next.maximizedView === viewId) delete next.maximizedView;
	return next;
}

/** Append a new pane as a tab in the active group (or a new root when empty). */
export function addPaneToLayout(
	config: LayoutConfig,
	activeTabId: Id | null,
	newViewId: Id
): LayoutConfig {
	const next = cloneConfig(config);
	if (!next.root) {
		return { root: { tabs: [newViewId], activeTabIndex: 0 } };
	}

	const anchor =
		(activeTabId ? findTabGroupForViewId(next.root, activeTabId) : null) ??
		findFirstTabGroup(next.root);
	if (!anchor) return next;

	anchor.tabs = asTabIds([...anchor.tabs, newViewId]);
	anchor.activeTabIndex = anchor.tabs.length - 1;
	return next;
}

/**
 * Imperative operations a consumer can expose to a global shortcut catalog.
 * All methods read/write through the bound `LayoutHandleDeps`.
 */
export interface LayoutHandle {
	closeActiveTab(): void;
	splitActivePane(direction: PaneDirection): void;
	splitActivePaneFibonacci(): void;
	frameActive(): void;
	selectAdjacentTab(delta: -1 | 1): void;
	moveActiveTab(delta: -1 | 1): void;
	appendActivePane(): void;
	getActivePaneTabId(): Id | null;
	focusActiveTab(): void;
}

export interface LayoutHandleDeps {
	getConfig: () => LayoutConfig;
	setConfig: (config: LayoutConfig) => void;
	getActiveTabId: () => Id | null;
	/** Focus bookkeeping for the newly created pane; defaults to a DOM lookup. */
	setActiveTabId?: (viewId: Id) => void;
	closeTab: (viewId: Id) => void;
	/** Register a new view and return its id (used by split/append). */
	createPane?: () => Id | null;
	maxDepth?: number;
	minWidthRatio?: number;
	minHeightRatio?: number;
	getGroupLayout?: (groupId: string) => LayoutConfig | undefined | null;
	setGroupLayout?: (groupId: string, layout: LayoutConfig) => void;
	getActiveGroupViewId?: () => string | null;
}

function focusView(id: Id) {
	if (typeof document === 'undefined') return;
	requestAnimationFrame(() => {
		const tab = document.querySelector(`[data-view-id="${CSS.escape(id)}"]`);
		if (tab instanceof HTMLElement) tab.focus({ preventScroll: true });
	});
}

/**
 * Build a {@link LayoutHandle} over a layout's config accessors. Intended to be
 * registered with a shortcut root so global actions can drive the active pane.
 */
export function createLayoutHandle(deps: LayoutHandleDeps): LayoutHandle {
	const options: LayoutOperationOptions = {
		maxDepth: deps.maxDepth,
		minWidthRatio: deps.minWidthRatio,
		minHeightRatio: deps.minHeightRatio
	};

	const applySplit = (direction: PaneDirection) => {
		const id = deps.getActiveTabId();
		if (!id) return;
		const newViewId = deps.createPane?.() ?? null;
		if (!newViewId) return;
		const result = splitNewPaneInLayout(deps.getConfig(), id, direction, newViewId, options);
		if (!result.newViewId || result.config === deps.getConfig()) return;
		deps.setConfig(result.config);
		deps.setActiveTabId?.(result.newViewId);
		focusView(result.newViewId);
	};

	return {
		getActivePaneTabId: () => deps.getActiveTabId(),
		closeActiveTab() {
			const id = deps.getActiveTabId();
			if (id) deps.closeTab(id);
		},
		splitActivePane(direction) {
			applySplit(direction);
		},
		splitActivePaneFibonacci() {
			const id = deps.getActiveTabId();
			if (!id) return;
			const newViewId = deps.createPane?.() ?? null;
			if (!newViewId) return;
			const result = splitFibonacciNewPaneInLayout(deps.getConfig(), id, newViewId, options);
			if (!result.newViewId || result.config === deps.getConfig()) return;
			deps.setConfig(result.config);
			deps.setActiveTabId?.(result.newViewId);
			focusView(result.newViewId);
		},
		frameActive() {
			const id = deps.getActiveTabId();
			if (id) deps.setConfig(toggleMaximizedView(deps.getConfig(), id));
		},
		selectAdjacentTab(delta) {
			const id = deps.getActiveTabId();
			if (!id) return;
			const config = deps.getConfig();

			if (deps.getGroupLayout && deps.setGroupLayout) {
				const groupLayouts: Record<string, LayoutConfig> = {};
				for (const tabId of collectTabViewIds(config)) {
					const isPrefixed = tabId.startsWith(GROUP_VIEW_PREFIX);
					const groupId = isPrefixed ? tabId.slice(GROUP_VIEW_PREFIX.length) : tabId;
					const layout = deps.getGroupLayout(groupId) ?? deps.getGroupLayout(tabId);
					if (layout) {
						groupLayouts[groupId] = layout;
						groupLayouts[tabId] = layout;
					}
				}

				const result = selectAdjacentTabDrillingGroups(config, id, delta, groupLayouts, {
					activeGroupViewId: deps.getActiveGroupViewId?.() ?? null
				});
				if (result) {
					deps.setConfig(result.config);
					for (const [groupId, layout] of Object.entries(result.groupUpdates)) {
						deps.setGroupLayout(groupId, layout);
					}
					deps.setActiveTabId?.(result.focusViewId);
					focusView(result.focusViewId);
					return;
				}
			}

			const next = selectAdjacentTabInLayout(config, id, delta);
			if (next !== config) deps.setConfig(next);
		},
		moveActiveTab(delta) {
			const id = deps.getActiveTabId();
			if (!id) return;
			const next = moveActiveTabInLayout(deps.getConfig(), id, delta);
			if (next !== deps.getConfig()) deps.setConfig(next);
		},
		appendActivePane() {
			const id = deps.getActiveTabId();
			const newViewId = deps.createPane?.() ?? null;
			if (!newViewId) return;
			const next = addPaneToLayout(deps.getConfig(), id, newViewId);
			if (next === deps.getConfig()) return;
			deps.setConfig(next);
			deps.setActiveTabId?.(newViewId);
			focusView(newViewId);
		},
		focusActiveTab() {
			const id = deps.getActiveTabId();
			if (id) focusView(id);
		}
	};
}
