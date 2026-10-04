<script lang="ts">
	import type { Id, KeyboardControl, TabGroupConfig, View } from './types.ts';
	import { onDestroy, untrack, type Snippet } from 'svelte';
	import { getModifier } from './internal-utils.ts';
	import { SvelteSet, type SvelteMap } from 'svelte/reactivity';
	import type { DropSide, DropTarget } from './internal-types.ts';

	let {
		config = $bindable(),
		views,
		disableDrag,
		isDragging,
		onStartTabDrag,
		onHoverEnter,
		onHoverExit,
		canDrop,
		remainingDepth,
		hideTabBar,
		controls,
		keyboardControls,
		baseClass,
		onAddTab,
		paneToolbar,
		keepAlive = false,
		tabCycleButtons = false,
		onRenameTab,
		toolbarStart,
		toolbarEnd,
		onCloseTab,
		onActivate,
		onCycleTab
	}: {
		config: TabGroupConfig;
		views: SvelteMap<Id, View>;
		disableDrag: boolean;
		isDragging: boolean;
		onStartTabDrag: (event: DragEvent, tabGroup: TabGroupConfig, tabIds: Id[]) => void;
		onHoverEnter: (tabGroup: TabGroupConfig, target: DropTarget) => void;
		onHoverExit: (tabGroup: TabGroupConfig) => void;
		canDrop: (tabGroup: TabGroupConfig, target: DropTarget) => boolean;
		remainingDepth: number;
		hideTabBar: boolean;
		controls: Snippet<[Id]>[];
		keyboardControls: KeyboardControl<TabGroupConfig>[];
		baseClass: string;
		onAddTab?: (tabGroup: TabGroupConfig) => void;
		paneToolbar?: Snippet<[Id]>;
		/** Keep visited tabs mounted (hidden) so their state survives switches. */
		keepAlive?: boolean;
		/** Show prev/next cycle buttons when the group has more than one tab. */
		tabCycleButtons?: boolean;
		/** Enables double-click inline rename; called with the committed title. */
		onRenameTab?: (tabId: Id, title: string) => void;
		/** Content rendered at the start (left) of the pane toolbar. */
		toolbarStart?: Snippet<[Id]>;
		/** Content rendered at the end (right) of the pane toolbar. */
		toolbarEnd?: Snippet<[Id]>;
		/** When provided, each tab gets a built-in close button. */
		onCloseTab?: (viewId: Id) => void;
		/** Fired when the pane is hovered or focused; used for active-pane tracking. */
		onActivate?: (tabGroup: TabGroupConfig) => void;
		/** Optional callback for next/prev tab cycling (supports group drilling). */
		onCycleTab?: (tabGroup: TabGroupConfig, delta: -1 | 1) => void;
	} = $props();

	// Tabs that have been active at least once. With `keepAlive`, each stays
	// mounted so its component state (scroll, inputs, editors) survives.
	const visitedTabs = new SvelteSet<Id>();
	$effect(() => {
		const activeTabId = config.tabs[config.activeTabIndex];
		if (activeTabId) visitedTabs.add(activeTabId);
		const tabSet = new Set(config.tabs);
		for (const id of visitedTabs) {
			if (!tabSet.has(id)) visitedTabs.delete(id);
		}
	});

	let rename = $state<{ tabId: Id; draft: string } | null>(null);
	let renameInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (rename && renameInput) {
			renameInput.focus({ preventScroll: true });
			renameInput.select();
		}
	});

	function handleKeyDown(event: KeyboardEvent) {
		const modifier = getModifier(event);
		for (const control of keyboardControls) {
			for (const shortcut of control.shortcuts) {
				if (modifier === (shortcut.modifier ?? null) && event.key === shortcut.key) {
					event.preventDefault();
					event.stopPropagation();
					control.action(config, event);
					return;
				}
			}
		}
	}

	function cycleAdjacentTab(delta: -1 | 1) {
		if (onCycleTab) {
			onCycleTab(config, delta);
			return;
		}
		const next = config.activeTabIndex + delta;
		if (next < 0 || next >= config.tabs.length) return;
		config.activeTabIndex = next;
	}

	function beginRename(tabId: Id) {
		if (!onRenameTab || config.locked) return;
		rename = { tabId, draft: views.get(tabId)?.title ?? '' };
	}

	function commitRename() {
		if (!rename) return;
		const { tabId, draft } = rename;
		rename = null;
		const trimmed = draft.trim();
		if (trimmed) onRenameTab?.(tabId, trimmed);
	}

	function cancelRename() {
		rename = null;
	}

	function startTabDrag(event: DragEvent, tabIds: Id[]) {
		if (!event.dataTransfer) return;
		event.stopPropagation();
		event.dataTransfer.dropEffect = 'move';
		const currentTarget = event.currentTarget as HTMLElement;
		event.dataTransfer.setDragImage(
			currentTarget,
			currentTarget.offsetWidth / 2,
			currentTarget.offsetHeight / 2
		);
		onStartTabDrag(event, config, tabIds);
	}

	// The dedicated `__tab-bar-drag` fill moves the whole group when dragged.
	function handleBarDragStart(event: DragEvent) {
		if (disableDrag || config.locked) return;
		startTabDrag(event, [...config.tabs]);
	}

	function handleAddTab(event: MouseEvent) {
		event.stopPropagation();
		onAddTab?.(config);
		(event.currentTarget as HTMLElement | null)?.dispatchEvent(
			new CustomEvent('hl-tab-add', {
				bubbles: true,
				composed: true,
				detail: { activeTabId: config.tabs[config.activeTabIndex] }
			})
		);
	}

	// Track which target (if any) we are currently hovering over and which config
	// object we reported to the parent, so we can reliably fire the exit callback
	// even if the component's config reference changes mid-drag.
	let hoverData: {
		target: DropTarget;
		reportedConfig: TabGroupConfig;
	} | null = $state(null);

	function handleHoverExit() {
		if (!hoverData) return;
		const reported = hoverData.reportedConfig;
		hoverData = null;
		onHoverExit(reported);
	}

	function handleHoverEnter(target: DropTarget) {
		if (!isDragging || !canDrop(config, target)) {
			handleHoverExit();
			return;
		}

		if (
			hoverData &&
			hoverData.reportedConfig === config &&
			hoverData.target.side === target.side &&
			hoverData.target.tabIndex === target.tabIndex
		) {
			return;
		}

		handleHoverExit();
		hoverData = { target, reportedConfig: config };
		onHoverEnter(config, target);
	}

	function handleDragOver(event: DragEvent, target: DropTarget) {
		event.preventDefault();
		event.stopPropagation();
		event.dataTransfer!.dropEffect = 'move';
		handleHoverEnter(target);
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		handleHoverExit();
	}

	// Re-emit hover events if config or drag state changes while hovering,
	// so the parent always has up-to-date references.
	$effect(() => {
		void config;
		void isDragging;
		void remainingDepth;
		if (!isDragging) {
			handleHoverExit();
			return;
		}
		const target = untrack(() => hoverData?.target);
		if (target) handleHoverEnter(target);
	});

	// Horizontal tab overflow calculation & auto-scroll
	let tabsEl = $state<HTMLElement | null>(null);
	let overflowLeft = $state(0);
	let overflowRight = $state(0);

	function computeOverflow() {
		if (!tabsEl) return;
		if (tabsEl.scrollWidth <= tabsEl.clientWidth + 1) {
			overflowLeft = 0;
			overflowRight = 0;
			return;
		}
		const viewLeft = tabsEl.getBoundingClientRect().left;
		const viewRight = viewLeft + tabsEl.clientWidth;
		let left = 0;
		let right = 0;
		tabsEl.querySelectorAll<HTMLElement>(`.${baseClass}__tab`).forEach((t) => {
			const r = t.getBoundingClientRect();
			if (r.left < viewLeft - 1) left++;
			if (r.right > viewRight + 1) right++;
		});
		overflowLeft = left;
		overflowRight = right;
	}

	$effect(() => {
		const el = tabsEl;
		if (!el) return;
		void config.tabs.length;
		computeOverflow();
		el.addEventListener('scroll', computeOverflow, { passive: true });
		const ro = new ResizeObserver(computeOverflow);
		ro.observe(el);
		return () => {
			el.removeEventListener('scroll', computeOverflow);
			ro.disconnect();
		};
	});

	function scrollTabIntoContainer(container: HTMLElement, tab: HTMLElement) {
		const c = container.getBoundingClientRect();
		const t = tab.getBoundingClientRect();
		const wrap = container.parentElement;
		const padLeft =
			wrap?.querySelector<HTMLElement>(`.${baseClass}__tab-scroll--left`)?.getBoundingClientRect()
				.width ?? 0;
		const padRight =
			wrap?.querySelector<HTMLElement>(`.${baseClass}__tab-scroll--right`)?.getBoundingClientRect()
				.width ?? 0;
		const leftBound = c.left + padLeft;
		const rightBound = c.right - padRight;
		let delta = 0;
		if (t.left < leftBound) delta = t.left - leftBound;
		else if (t.right > rightBound) delta = t.right - rightBound;
		if (Math.abs(delta) < 1) return;
		container.scrollBy({
			left: delta,
			behavior: 'smooth'
		});
	}

	$effect(() => {
		const el = tabsEl;
		if (!el) return;
		void config.activeTabIndex;
		const tab = el.querySelector<HTMLElement>(`.${baseClass}__tab--active`);
		if (!tab) return;
		scrollTabIntoContainer(el, tab);
	});

	function scrollTabs(dir: 1 | -1) {
		if (tabsEl) {
			tabsEl.scrollBy({ left: dir * tabsEl.clientWidth * 0.75, behavior: 'smooth' });
		}
	}

	onDestroy(handleHoverExit);
</script>

<section
	class="{baseClass}{config.locked ? ` ${baseClass}__locked` : ''}"
	role="group"
	onpointerenter={() => onActivate?.(config)}
	onfocusin={() => onActivate?.(config)}
>
	{#if !hideTabBar}
		<div class="{baseClass}__tab-bar">
			{#if tabCycleButtons && config.tabs.length > 1}
				<div class="{baseClass}__tab-cycle">
					<button
						type="button"
						class="{baseClass}__tab-cycle-btn{!onCycleTab && config.activeTabIndex === 0
							? ` ${baseClass}__tab-cycle-btn--at-edge`
							: ''}"
						aria-label="Previous tab"
						disabled={!onCycleTab && config.activeTabIndex === 0}
						onclick={() => cycleAdjacentTab(-1)}
					>
						<svg
							class="{baseClass}__tab-cycle-icon"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M19 12H5M12 19l-7-7 7-7" />
						</svg>
					</button>
					<button
						type="button"
						class="{baseClass}__tab-cycle-btn{!onCycleTab &&
						config.activeTabIndex === config.tabs.length - 1
							? ` ${baseClass}__tab-cycle-btn--at-edge`
							: ''}"
						aria-label="Next tab"
						disabled={!onCycleTab && config.activeTabIndex === config.tabs.length - 1}
						onclick={() => cycleAdjacentTab(1)}
					>
						<svg
							class="{baseClass}__tab-cycle-icon"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M5 12h14M12 5l7 7-7 7" />
						</svg>
					</button>
				</div>
			{/if}
			<!-- Tabs wrap with scroll overflow number indicators -->
			<div class="{baseClass}__tabs-wrap">
				<!-- Tab list - keyboard navigation is handled on the list container. -->
				<div
					bind:this={tabsEl}
					role="tablist"
					tabindex={0}
					class="{baseClass}__tabs"
					onkeydown={handleKeyDown}
				>
				{#each config.tabs as tabId, index (tabId)}
					{@const tab = views.get(tabId)}
					{@const isActive = index === config.activeTabIndex}
					{@const isFirst = index === 0}
					{@const isPrevActive = index > 0 && config.activeTabIndex === index - 1}
					{#if isDragging}
						<div
							class="{baseClass}__tab-drop-hint {baseClass}__tab-drop-hint--{index}{hoverData?.target
								.tabIndex === index
								? ` ${baseClass}__tab-drop-hint--hover`
								: ''}"
							aria-hidden="true"
						></div>
						<div
							class="{baseClass}__tab-drop-zone {baseClass}__tab-drop-zone--{index}"
							aria-hidden="true"
							ondragenter={(event) => handleDragOver(event, { tabIndex: index })}
							ondragover={(event) => handleDragOver(event, { tabIndex: index })}
							ondragleave={handleDragLeave}
						></div>
					{/if}
					<div
						role="tab"
						class="{baseClass}__tab{isActive ? ` ${baseClass}__tab--active` : ''}"
						data-view-id={tabId}
						data-tone={tab?.tone ?? 'accent'}
						data-busy={tab?.busy ? 'true' : undefined}
						data-tab-inactive={!isActive ? '' : undefined}
						data-hl-tab-first={isFirst ? '' : undefined}
						data-hl-prev-active={isPrevActive ? '' : undefined}
						aria-busy={tab?.busy ? 'true' : undefined}
						tabindex={-1}
						draggable={!disableDrag && !config.locked}
						onclick={() => {
							config.activeTabIndex = index;
							onActivate?.(config);
						}}
						ondblclick={() => beginRename(tabId)}
						onkeydown={null}
					>
						{#if tab?.busy}
							<span class="{baseClass}__tab-spinner" aria-hidden="true"></span>
						{:else if tab?.icon}
							<span class="{baseClass}__tab-icon" aria-hidden="true">
								{@render tab.icon()}
							</span>
						{/if}
						{#if rename?.tabId === tabId}
							<input
								class="{baseClass}__tab-rename"
								bind:this={renameInput}
								bind:value={rename.draft}
								aria-label="Rename tab"
								onclick={(event) => event.stopPropagation()}
								ondblclick={(event) => event.stopPropagation()}
								onkeydown={(event) => {
									event.stopPropagation();
									if (event.key === 'Enter') {
										event.preventDefault();
										commitRename();
									} else if (event.key === 'Escape') {
										event.preventDefault();
										cancelRename();
									}
								}}
								onblur={commitRename}
							/>
						{:else}
							<span class="{baseClass}__tab-title">{tab?.title}</span>
						{/if}
						{#if tab?.badge !== undefined && tab?.badge !== ''}
							<span class="{baseClass}__tab-badge">{tab.badge}</span>
						{/if}
						<div class="{baseClass}__tab-controls">
							{#each tab?.tabControls ?? [] as control (control)}
								<span class="{baseClass}__tab-control">
									{@render control(tabId)}
								</span>
							{/each}
						</div>
						{#if onCloseTab && tab?.closable !== false}
							<button
								type="button"
								class="{baseClass}__tab-close"
								aria-label="Close tab"
								title="Close tab"
								onclick={(event) => {
									event.stopPropagation();
									onCloseTab(tabId);
								}}
								ondblclick={(event) => event.stopPropagation()}
							>
								<svg
									viewBox="0 0 24 24"
									width="12"
									height="12"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									aria-hidden="true"
								>
									<path d="M18 6 6 18M6 6l12 12" />
								</svg>
							</button>
						{/if}
					</div>
				{/each}
					{#if isDragging}
						<div
							class="{baseClass}__tab-drop-hint {baseClass}__tab-drop-hint--{config.tabs
								.length} {baseClass}__tab-drop-hint--end{hoverData?.target.tabIndex ===
							config.tabs.length
								? ` ${baseClass}__tab-drop-hint--hover`
								: ''}"
							aria-hidden="true"
						></div>
						<div
							class="{baseClass}__tab-drop-zone {baseClass}__tab-drop-zone--{config.tabs
								.length} {baseClass}__tab-drop-zone--end"
							aria-hidden="true"
							ondragenter={(event) => handleDragOver(event, { tabIndex: config.tabs.length })}
							ondragover={(event) => handleDragOver(event, { tabIndex: config.tabs.length })}
							ondragleave={handleDragLeave}
						></div>
					{/if}
				</div>

				{#if overflowLeft > 0}
					<button
						type="button"
						class="{baseClass}__tab-scroll {baseClass}__tab-scroll--left"
						aria-label="{overflowLeft} {overflowLeft === 1 ? 'tab' : 'tabs'} off-screen to the left"
						title="{overflowLeft} {overflowLeft === 1 ? 'tab' : 'tabs'} off-screen to the left"
						onclick={() => scrollTabs(-1)}
					>
						<svg
							viewBox="0 0 24 24"
							width="11"
							height="11"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="m15 18-6-6 6-6" />
						</svg>
						<span>{overflowLeft}</span>
					</button>
				{/if}

				{#if overflowRight > 0}
					<button
						type="button"
						class="{baseClass}__tab-scroll {baseClass}__tab-scroll--right"
						aria-label="{overflowRight} {overflowRight === 1 ? 'tab' : 'tabs'} off-screen to the right"
						title="{overflowRight} {overflowRight === 1 ? 'tab' : 'tabs'} off-screen to the right"
						onclick={() => scrollTabs(1)}
					>
						<span>{overflowRight}</span>
						<svg
							viewBox="0 0 24 24"
							width="11"
							height="11"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="m9 18 6-6-6-6" />
						</svg>
					</button>
				{/if}
			</div>

			<button
				type="button"
				class="{baseClass}__tab-add"
				onclick={handleAddTab}
				title="New tab"
				aria-label="New tab"
			>
				<svg
					class="{baseClass}__tab-add-icon"
					viewBox="0 0 24 24"
					width="14"
					height="14"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M12 5v14M5 12h14" />
				</svg>
			</button>

			{#if !disableDrag && !config.locked}
				<div
					class="{baseClass}__tab-bar-drag"
					draggable="true"
					aria-hidden="true"
					ondragstart={handleBarDragStart}
				></div>
			{/if}

			<div class="{baseClass}__controls">
				{#each controls as control (control)}
					<div class="{baseClass}__control">
						{#if config.tabs[config.activeTabIndex]}
							{@render control(config.tabs[config.activeTabIndex]!)}
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="{baseClass}__body">
		{#if (paneToolbar || toolbarStart || toolbarEnd) && config.tabs[config.activeTabIndex] !== undefined}
			{@const activeId = config.tabs[config.activeTabIndex]!}
			{#if views.get(activeId)?.hideToolbar !== true}
				<div class="{baseClass}__toolbar">
					{#if toolbarStart}
						<div class="{baseClass}__toolbar-start">{@render toolbarStart(activeId)}</div>
					{/if}
					{#if paneToolbar}
						<div class="{baseClass}__toolbar-main">{@render paneToolbar(activeId)}</div>
					{/if}
					{#if toolbarEnd}
						<div class="{baseClass}__toolbar-end">{@render toolbarEnd(activeId)}</div>
					{/if}
				</div>
			{/if}
		{/if}
		{#if keepAlive}
			{#each config.tabs as tabId, index (tabId)}
				{#if visitedTabs.has(tabId)}
					<div
						class="{baseClass}__content{index === config.activeTabIndex
							? ''
							: ` ${baseClass}__content--hidden`}"
						style={index === config.activeTabIndex ? '' : 'display: none !important;'}
						aria-hidden={index === config.activeTabIndex ? undefined : 'true'}
					>
						{@render views.get(tabId)?.snippet()}
					</div>
				{/if}
			{/each}
		{:else}
			<div class="{baseClass}__content">
				{@render views.get(config.tabs[config.activeTabIndex]!)?.snippet()}
			</div>
		{/if}
	</div>

	{#if isDragging}
		<div class="{baseClass}__drop-zones">
			{#each ['top', 'right', 'bottom', 'left'] as side (side)}
				<div
					class="{baseClass}__drop-zone {baseClass}__drop-zone--{side}"
					role="region"
					ondragenter={(event) => handleDragOver(event, { side: side as DropSide })}
					ondragover={(event) => handleDragOver(event, { side: side as DropSide })}
					ondragleave={handleDragLeave}
				></div>
			{/each}
		</div>
		{#if hoverData?.target.side}
			<div class="{baseClass}__drop-hint {baseClass}__drop-hint--{hoverData.target.side}"></div>
		{/if}
	{/if}
</section>
