<script lang="ts">
	import { createRawSnippet, untrack, type Snippet } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import HorizonLayout from '$lib/HorizonLayout.svelte';
	import { splitNewPaneInLayout, toggleMaximizedView } from '$lib/operations.js';
	import type { Id, LayoutConfig, TabGroupConfig, View } from '$lib/types.js';
	import SplitSquareHorizontalIcon from '@lucide/svelte/icons/split-square-horizontal';
	import SplitSquareVerticalIcon from '@lucide/svelte/icons/split-square-vertical';

	// A "Group" pane: a nested HorizonLayout living inside a parent pane body.
	// Ports shell-builder's group-tab concept (a layout within a layout).
	// The parent tab suppresses its toolbar; the inner pane renders its own toolbar.

	let {
		groupId: _groupId = 'default',
		config: parentConfig = undefined,
		onConfigChange,
		onCycleTab,
		onActivateView
	}: {
		groupId?: string;
		config?: LayoutConfig;
		onConfigChange?: (config: LayoutConfig) => void;
		onCycleTab?: (tabGroup: TabGroupConfig, delta: -1 | 1) => void;
		onActivateView?: (viewId: Id) => void;
	} = $props();

	function leaf(innerContent: string): Snippet {
		return createRawSnippet(() => ({ render: () => `<div class="leaf">${innerContent}</div>` }));
	}

	function icon(svg: string): Snippet {
		return createRawSnippet(() => ({
			render: () => `<span class="grp-ico">${svg}</span>`
		}));
	}

	const groupViews = new SvelteMap<Id, View>();

	let inner: LayoutConfig = $state(
		untrack(() => parentConfig) ?? {
			root: {
				tabs: ['g-editor', 'g-notes'],
				activeTabIndex: 0
			}
		}
	);

	$effect(() => {
		if (parentConfig && parentConfig !== inner) {
			inner = parentConfig;
		}
	});

	$effect(() => {
		void inner;
		onConfigChange?.(inner);
	});

	groupViews.set('g-editor', {
		title: 'scratch.ts',
		icon: icon('<svg viewBox="0 0 24 24"><path d="m8 6-6 6 6 6M16 6l6 6-6 6" /></svg>'),
		snippet: leaf('const group = &lt;HorizonLayout /&gt;')
	});
	groupViews.set('g-notes', {
		title: 'Notes',
		icon: icon('<svg viewBox="0 0 24 24"><path d="M9 13h6M9 17h4" /><path d="M14 3v4h5" /></svg>'),
		snippet: leaf('Group notes live here.')
	});
	groupViews.set('g-outline', {
		title: 'Outline',
		icon: icon('<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01" /></svg>'),
		snippet: leaf('— editor<br/>&nbsp;&nbsp;— notes')
	});

	let seq = 0;
	function createInnerPane(): Id {
		seq += 1;
		const id = `g-pane-${seq}`;
		groupViews.set(id, { title: `Inner ${seq}`, snippet: leaf(`Inner pane · ${id}`) });
		return id;
	}

	function splitInner(viewId: Id, direction: 'right' | 'down') {
		const newId = createInnerPane();
		const res = splitNewPaneInLayout(inner, viewId, direction, newId);
		inner = res.config;
	}

	function frameInner(viewId: Id) {
		inner = toggleMaximizedView(inner, viewId);
	}
</script>

{#snippet innerToolbarStart(viewId: Id)}
	{@const view = groupViews.get(viewId)}
	{#if view?.icon}
		<span class="pt-ico">{@render view.icon()}</span>
	{/if}
	<span class="pt-title">{view?.title ?? viewId}</span>
{/snippet}

{#snippet innerToolbarEnd(viewId: Id)}
	<button type="button" class="pt" title="Split right" onclick={() => splitInner(viewId, 'right')}>
		<SplitSquareHorizontalIcon />
	</button>
	<button type="button" class="pt" title="Split down" onclick={() => splitInner(viewId, 'down')}>
		<SplitSquareVerticalIcon />
	</button>
	<button
		type="button"
		class="pt"
		title={inner.maximizedView === viewId ? 'Exit fullscreen pane' : 'Toggle fullscreen pane'}
		onclick={() => frameInner(viewId)}
	>
		{#if inner.maximizedView === viewId}
			<svg viewBox="0 0 24 24" aria-hidden="true"
				><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" /></svg
			>
		{:else}
			<svg viewBox="0 0 24 24" aria-hidden="true"
				><path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5" /></svg
			>
		{/if}
	</button>
{/snippet}

<div class="group-pane">
	<HorizonLayout
		bind:config={inner}
		views={groupViews}
		toolbarStart={innerToolbarStart}
		toolbarEnd={innerToolbarEnd}
		onAddTab={(tg) => {
			const id = createInnerPane();
			tg.tabs.push(id);
			tg.activeTabIndex = tg.tabs.length - 1;
		}}
		onCloseTab={(id) => {
			groupViews.delete(id);
		}}
		surface="flush"
		tabCycleButtons={true}
		{onCycleTab}
		onActiveViewChange={(v) => onActivateView?.(v)}
	/>
</div>

<style>
	.group-pane {
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		overflow: hidden;
	}

	.group-pane :global(.pt) {
		appearance: none;
		background: transparent;
		border: none;
		color: inherit;
		padding: 2px 4px;
		border-radius: 3px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		transition:
			color 60ms ease,
			background 60ms ease;
	}

	.group-pane :global(.pt:hover) {
		color: var(--hl-fg);
		background: color-mix(in srgb, var(--hl-fg) 8%, transparent);
	}

	.group-pane :global(.pt svg) {
		width: 12px;
		height: 12px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.group-pane :global(.pt-ico) {
		display: inline-flex;
		align-items: center;
		opacity: 0.75;
		margin-right: 4px;
	}

	.group-pane :global(.pt-ico svg),
	.group-pane :global(.grp-ico svg) {
		width: 12px;
		height: 12px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.group-pane :global(.pt-title) {
		font-weight: 500;
	}

	.group-pane :global(.leaf) {
		padding: var(--hl-pad, 0.75rem);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--hl-fg);
	}
</style>
