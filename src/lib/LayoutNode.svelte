<script lang="ts">
	import type { Snippet } from 'svelte';
	import type {
		Id,
		KeyboardControls,
		SplitConfig,
		View,
		TabGroupConfig,
		NodeConfig
	} from './types.ts';
	import { nodeConfigType } from './utils.ts';
	import HorizonSplit from '$lib/Split.svelte';
	import HorizonTabGroup from '$lib/TabGroup.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { DropTarget } from './internal-types.ts';

	let {
		config = $bindable(),
		views,
		tabgroupControls,
		disableResizeSplits,
		disableDragAndDrop,
		isDragging,
		onStartTabDrag,
		onHoverEnter,
		onHoverExit,
		canDrop,
		remainingDepth,
		showSplitRatio,
		minWidthRatio,
		minHeightRatio,
		hideTabBar,
		keyboardControls,
		formatRatio,
		formatRatioForAria,
		baseClass,
		onAddTab,
		paneToolbar,
		keepAlive,
		tabCycleButtons,
		onRenameTab,
		toolbarStart,
		toolbarEnd,
		onCloseTab,
		onActivate,
		onCycleTab
	}: {
		config: NodeConfig;
		views: SvelteMap<Id, View>;
		tabgroupControls: Snippet<[Id]>[];
		disableResizeSplits: boolean;
		disableDragAndDrop: boolean;
		onStartTabDrag: (event: DragEvent, tabGroup: TabGroupConfig, tabIds: Id[]) => void;
		onHoverEnter: (tabGroup: TabGroupConfig, target: DropTarget) => void;
		onHoverExit: (tabGroup: TabGroupConfig) => void;
		canDrop: (tabGroup: TabGroupConfig, target: DropTarget) => boolean;
		isDragging: boolean;
		remainingDepth: number;
		showSplitRatio: boolean;
		minWidthRatio: number;
		minHeightRatio: number;
		hideTabBar: boolean;
		keyboardControls: KeyboardControls;
		formatRatio: (ratio: number) => string;
		formatRatioForAria: (ratio: number) => number;
		baseClass: string;
		onAddTab?: (tabGroup: TabGroupConfig) => void;
		paneToolbar?: Snippet<[Id]>;
		keepAlive?: boolean;
		tabCycleButtons?: boolean;
		onRenameTab?: (tabId: Id, title: string) => void;
		toolbarStart?: Snippet<[Id]>;
		toolbarEnd?: Snippet<[Id]>;
		onCloseTab?: (viewId: Id) => void;
		onActivate?: (tabGroup: TabGroupConfig) => void;
		onCycleTab?: (tabGroup: TabGroupConfig, delta: -1 | 1) => void;
	} = $props();
</script>

{#if nodeConfigType(config) === 'split'}
	<HorizonSplit
		bind:config={config as SplitConfig}
		{views}
		{tabgroupControls}
		{disableResizeSplits}
		{disableDragAndDrop}
		{isDragging}
		{onStartTabDrag}
		{onHoverEnter}
		{onHoverExit}
		{canDrop}
		remainingDepth={remainingDepth - 1}
		{showSplitRatio}
		{minWidthRatio}
		{minHeightRatio}
		{hideTabBar}
		{keyboardControls}
		{formatRatio}
		{formatRatioForAria}
		{baseClass}
		{onAddTab}
		{paneToolbar}
		{keepAlive}
		{tabCycleButtons}
		{onRenameTab}
		{toolbarStart}
		{toolbarEnd}
		{onCloseTab}
		{onActivate}
		{onCycleTab}
	></HorizonSplit>
{:else}
	<HorizonTabGroup
		bind:config={config as TabGroupConfig}
		{views}
		disableDrag={disableDragAndDrop}
		{isDragging}
		{onStartTabDrag}
		{onHoverEnter}
		{onHoverExit}
		{canDrop}
		{remainingDepth}
		{hideTabBar}
		controls={tabgroupControls}
		keyboardControls={keyboardControls.tabGroupControls ?? []}
		baseClass={`${baseClass}-tabgroup`}
		{onAddTab}
		{paneToolbar}
		{keepAlive}
		{tabCycleButtons}
		{onRenameTab}
		{toolbarStart}
		{toolbarEnd}
		{onCloseTab}
		{onActivate}
		{onCycleTab}
	></HorizonTabGroup>
{/if}
