<script lang="ts">
	import type { SvelteMap } from 'svelte/reactivity';
	import type { View, Id, SplitConfig, KeyboardControls, TabGroupConfig } from './types.ts';
	import { getModifier } from './internal-utils.ts';
	import HorizonLayoutNode from './LayoutNode.svelte';
	import { type Snippet } from 'svelte';
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
		config: SplitConfig;
		views: SvelteMap<Id, View>;
		tabgroupControls: Snippet<[Id]>[];
		disableResizeSplits: boolean;
		disableDragAndDrop: boolean;
		isDragging: boolean;
		onStartTabDrag: (event: DragEvent, tabGroup: TabGroupConfig, tabIds: Id[]) => void;
		onHoverEnter: (tabGroup: TabGroupConfig, target: DropTarget) => void;
		onHoverExit: (tabGroup: TabGroupConfig) => void;
		canDrop: (tabGroup: TabGroupConfig, target: DropTarget) => boolean;
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

	let splitContainer = $state<HTMLElement | null>(null);

	let activeResizer = $state<number | null>(null);

	let isHorizontal = $derived(config.direction === 'horizontal');
	let minRatio = $derived(isHorizontal ? minWidthRatio : minHeightRatio);

	let posConstraints = $derived(
		config.splitPoints.map((_, i) => ({
			min: (config.splitPoints[i - 1] ?? 0) + minRatio,
			max: (config.splitPoints[i + 1] ?? 1) - minRatio
		}))
	);

	let splitRatioStyles = $derived(
		config.splitPoints.map((_, i) => {
			const ratio = config.splitPoints[i] ?? 0;
			return isHorizontal ? `left: ${ratio * 100}%;` : `top: ${ratio * 100}%;`;
		})
	);

	function startResize(event: PointerEvent, index: number) {
		event.preventDefault();
		event.stopPropagation();
		if (disableResizeSplits) return;

		const target = event.currentTarget as HTMLElement;
		target.setPointerCapture(event.pointerId);
		activeResizer = index;

		const rect = splitContainer!.getBoundingClientRect();

		function move(event: PointerEvent) {
			const ratio = isHorizontal
				? (event.clientX - rect.left) / rect.width
				: (event.clientY - rect.top) / rect.height;
			const { min, max } = posConstraints[index]!;
			const clamped = Number(Math.min(Math.max(ratio, min), max).toFixed(4));
			if (clamped !== config.splitPoints[index]) config.splitPoints[index] = clamped;
		}

		function stop(event: PointerEvent) {
			activeResizer = null;
			if (target.hasPointerCapture(event.pointerId)) {
				target.releasePointerCapture(event.pointerId);
			}
			target.removeEventListener('pointermove', move);
			target.removeEventListener('pointerup', stop);
			target.removeEventListener('pointercancel', stop);
		}

		target.addEventListener('pointermove', move);
		target.addEventListener('pointerup', stop);
		target.addEventListener('pointercancel', stop);
	}

	function equalizeAdjacentPanes(index: number) {
		if (disableResizeSplits) return;
		const { min, max } = posConstraints[index]!;
		const midpoint =
			((config.splitPoints[index - 1] ?? 0) + (config.splitPoints[index + 1] ?? 1)) / 2;
		const clamped = Number(Math.min(Math.max(midpoint, min), max).toFixed(4));
		if (clamped !== config.splitPoints[index]) config.splitPoints[index] = clamped;
	}

	function handleKeyDown(event: KeyboardEvent, index: number) {
		const modifier = getModifier(event);
		for (const control of keyboardControls.splitControls ?? []) {
			for (const shortcut of control.shortcuts) {
				if (modifier === (shortcut.modifier ?? null) && event.key === shortcut.key) {
					event.preventDefault();
					event.stopPropagation();
					control.action({ config, index }, event);
					return;
				}
			}
		}
	}
</script>

<div
	class="{baseClass}-split {baseClass}-split--{config.direction}"
	style="display: flex !important;"
	bind:this={splitContainer}
>
	{#each config.views as view, i (view)}
		{@const splitPoint = config.splitPoints[i]}
		<div
			class="{baseClass}-split__pane {baseClass}-split__pane--{config.direction}"
			style={`flex: ${(splitPoint ?? 1) - (config.splitPoints[i - 1] ?? 0)} 1 0 !important;`}
			data-hl-pane-first={i === 0 ? '' : undefined}
			data-hl-pane-last={i === config.views.length - 1 ? '' : undefined}
		>
			<HorizonLayoutNode
				bind:config={config.views[i]!}
				{views}
				{tabgroupControls}
				{disableResizeSplits}
				{disableDragAndDrop}
				{onStartTabDrag}
				{onHoverEnter}
				{onHoverExit}
				{canDrop}
				{isDragging}
				{remainingDepth}
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
			></HorizonLayoutNode>
		</div>

		{#if i < config.splitPoints.length}
			{@const isActive = activeResizer === i}
			{@const constraints = posConstraints[i]!}
			<div
				class="{baseClass}-split__resizer {baseClass}-split__resizer--{config.direction}{isActive
					? ` ${baseClass}-split__resizer--active`
					: ''}"
			>
				<span
					class="{baseClass}-split__resizer-handle {baseClass}-split__resizer-handle--{config.direction}{isActive
						? ` ${baseClass}-split__resizer-handle--active`
						: ''}"
					role="slider"
					tabindex={0}
					aria-label="Resize pane {i + 1}"
					aria-orientation={config.direction}
					aria-valuemin={formatRatioForAria(constraints.min)}
					aria-valuemax={formatRatioForAria(constraints.max)}
					aria-valuenow={formatRatioForAria(splitPoint!)}
					aria-valuetext={formatRatio(splitPoint!)}
					onpointerdown={(event) => startResize(event, i)}
					ondblclick={() => equalizeAdjacentPanes(i)}
					onfocus={() => {
						if (!disableResizeSplits) activeResizer = i;
					}}
					onblur={() => (activeResizer = null)}
					onkeydown={(event) => handleKeyDown(event, i)}
				></span>
			</div>

			{#if showSplitRatio}
				<div
					class="{baseClass}-split__ratio {baseClass}-split__ratio--{config.direction}{isActive
						? ` ${baseClass}-split__ratio--active`
						: ''}"
					style={splitRatioStyles[i]}
				>
					{formatRatio(splitPoint!)}
				</div>
			{/if}
		{/if}
	{/each}
</div>
