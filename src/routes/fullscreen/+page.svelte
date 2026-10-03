<script lang="ts">
	import { onMount, createRawSnippet, type Snippet } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import '$lib/horizon-layout.css';
	import HorizonLayout from '$lib/HorizonLayout.svelte';
	import {
		addPaneToLayout,
		collectTabViewIds,
		createLayoutHandle,
		removeViewFromLayout,
		splitNewPaneInLayout,
		toggleMaximizedView
	} from '$lib/operations.js';
	import { buildLayoutActionCatalog, registerActionShortcuts } from '$lib/actions/index.js';
	import { createShortcutRoot } from '$lib/shortcuts/index.js';
	import { validateConfig } from '$lib/utils.js';
	import type { ActionDef } from '$lib/actions/index.js';
	import type { Id, LayoutConfig, TabGroupConfig, View } from '$lib/types.js';
	import SettingsModal from './SettingsModal.svelte';
	import {
		settings,
		persistSettings,
		persistChords,
		persistLayout,
		loadSavedLayout,
		chordOverrides
	} from './demoState.svelte.ts';

	type PaneDirection = 'left' | 'right' | 'up' | 'down';

	function leaf(inner: string): Snippet {
		return createRawSnippet(() => ({ render: () => `<div class="leaf">${inner}</div>` }));
	}

	const views = new SvelteMap<Id, View>();

	function genericView(id: Id): View {
		return {
			title: id.replace(/^pane:/, 'Pane '),
			icon: iconSpark,
			snippet: leaf(`New pane · ${id}`)
		};
	}

	views.set('explorer', {
		title: 'Explorer',
		icon: iconFolder,
		snippet: leaf(
			'src/<br/>&nbsp;├─ lib/<br/>&nbsp;│&nbsp;&nbsp;├─ HorizonLayout.svelte<br/>&nbsp;│&nbsp;&nbsp;├─ TabGroup.svelte<br/>&nbsp;│&nbsp;&nbsp;└─ operations.ts<br/>&nbsp;└─ routes/'
		)
	});
	views.set('search', { title: 'Search', icon: iconSearch, snippet: leaf('Find in files…') });
	views.set('editor', {
		title: 'HorizonLayout.svelte',
		icon: iconCode,
		snippet: leaf('&lt;HorizonLayout bind:config {views} /&gt;')
	});
	views.set('preview', { title: 'Preview', icon: iconEye, snippet: leaf('Rendered output') });
	views.set('problems', {
		title: 'Problems',
		icon: iconAlert,
		snippet: leaf('0 errors · 0 warnings')
	});
	views.set('terminal', { title: 'Terminal', icon: iconTerm, snippet: leaf('$ pnpm dev') });
	views.set('inspector', {
		title: 'Inspector',
		icon: iconGauge,
		snippet: leaf('LayoutConfig { root, maximizedView }')
	});
	views.set('outline', {
		title: 'Outline',
		icon: iconList,
		snippet: leaf('— root<br/>&nbsp;&nbsp;— editor<br/>&nbsp;&nbsp;— inspector')
	});

	function randomPaneId(): Id {
		return `pane:${Math.random().toString(36).slice(2, 7)}`;
	}

	let paneSeq = 0;
	function createPane(): Id {
		paneSeq += 1;
		const id = randomPaneId();
		views.set(id, {
			title: `Untitled ${paneSeq}`,
			icon: iconSpark,
			snippet: leaf(`New pane · ${id}`)
		});
		return id;
	}

	const DEFAULT_CONFIG: LayoutConfig = {
		root: {
			direction: 'horizontal',
			views: [
				{ tabs: ['explorer', 'search'], activeTabIndex: 0 },
				{
					direction: 'vertical',
					views: [
						{
							direction: 'horizontal',
							views: [
								{ tabs: ['editor', 'preview', 'problems'], activeTabIndex: 0 },
								{ tabs: ['inspector', 'outline'], activeTabIndex: 0 }
							],
							splitPoints: [0.66]
						},
						{ tabs: ['terminal'], activeTabIndex: 0 }
					],
					splitPoints: [0.7]
				}
			],
			splitPoints: [0.24]
		}
	};

	function resolveInitialConfig(): LayoutConfig {
		const saved = loadSavedLayout();
		if (saved) {
			for (const id of collectTabViewIds(saved)) {
				if (!views.has(id)) views.set(id, genericView(id));
			}
			try {
				validateConfig(saved, views, {
					minWidthRatio: settings.minWidthRatio,
					minHeightRatio: settings.minHeightRatio
				});
				return saved;
			} catch {
				// fall through to the default layout
			}
		}
		return DEFAULT_CONFIG;
	}

	let config = $state<LayoutConfig>(resolveInitialConfig());
	let activeView = $state<Id | undefined>(undefined);
	let settingsOpen = $state(false);
	let paletteOpen = $state(false);
	let paletteQuery = $state('');
	let paletteInput = $state<HTMLInputElement | null>(null);
	let isFullscreen = $state(false);

	$effect(() => {
		if (paletteOpen && paletteInput) {
			paletteInput.focus();
			paletteInput.select();
		}
	});

	const validateOptions = $derived({
		maxDepth: settings.maxDepth,
		minWidthRatio: settings.minWidthRatio,
		minHeightRatio: settings.minHeightRatio
	});

	const layoutHandle = $derived(
		createLayoutHandle({
			getConfig: () => config,
			setConfig: (next) => {
				config = next;
			},
			getActiveTabId: () => activeView ?? null,
			setActiveTabId: (id) => {
				activeView = id;
			},
			closeTab: (id) => closePane(id),
			createPane,
			...validateOptions
		})
	);

	const catalog = $derived(
		buildLayoutActionCatalog({
			resolveLayout: () => layoutHandle,
			chords: chordOverrides,
			onNewTab: () => {
				const id = createPane();
				config = addPaneToLayout(config, activeView ?? null, id);
				activeView = id;
			},
			onOpenSettings: () => {
				settingsOpen = true;
			},
			onCommandPalette: () => {
				paletteOpen = true;
			},
			onToggleTheme: cycleTheme
		})
	);

	const filteredActions = $derived.by(() => {
		const query = paletteQuery.trim().toLowerCase();
		return catalog.filter((action) => {
			if (action.hidden) return false;
			if (!query) return true;
			return (
				action.label.toLowerCase().includes(query) ||
				(action.keywords ?? []).some((keyword) => keyword.includes(query))
			);
		});
	});

	const shortcutRoot = createShortcutRoot();

	$effect(() => {
		const unbind = registerActionShortcuts(shortcutRoot, catalog);
		return unbind;
	});

	$effect(() => {
		persistSettings();
	});

	$effect(() => {
		persistChords();
	});

	$effect(() => {
		persistLayout(config);
	});

	function closePane(viewId: Id) {
		const next = removeViewFromLayout(config, viewId);
		views.delete(viewId);
		config = next;
		if (activeView === viewId) {
			activeView = collectTabViewIds(next)[0];
		}
	}

	function splitPane(viewId: Id, direction: PaneDirection) {
		const newId = createPane();
		const result = splitNewPaneInLayout(config, viewId, direction, newId, validateOptions);
		if (result.newViewId) {
			config = result.config;
			activeView = result.newViewId;
		} else {
			views.delete(newId);
		}
	}

	function frame(viewId: Id) {
		config = toggleMaximizedView(config, viewId);
	}

	function handleAddTab(tabGroup: TabGroupConfig) {
		const id = createPane();
		tabGroup.tabs.push(id);
		tabGroup.activeTabIndex = tabGroup.tabs.length - 1;
	}

	function handleRenameTab(tabId: Id, title: string) {
		const view = views.get(tabId);
		if (view) views.set(tabId, { ...view, title });
	}

	function cycleTheme() {
		settings.theme =
			settings.theme === 'dark' ? 'light' : settings.theme === 'light' ? 'studio' : 'dark';
	}

	function runAction(action: ActionDef) {
		action.run();
		paletteOpen = false;
		paletteQuery = '';
	}

	async function toggleFullscreen() {
		if (typeof document === 'undefined') return;
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await document.documentElement.requestFullscreen();
		} catch {
			// fullscreen may be denied
		}
	}

	onMount(() => {
		const onChange = () => (isFullscreen = Boolean(document.fullscreenElement));
		document.addEventListener('fullscreenchange', onChange);
		return () => {
			document.removeEventListener('fullscreenchange', onChange);
			shortcutRoot.destroy();
		};
	});
</script>

{#snippet iconFolder()}<svg viewBox="0 0 24 24" aria-hidden="true"
		><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg
	>{/snippet}
{#snippet iconSearch()}<svg viewBox="0 0 24 24" aria-hidden="true"
		><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg
	>{/snippet}
{#snippet iconCode()}<svg viewBox="0 0 24 24" aria-hidden="true"
		><path d="m8 6-6 6 6 6M16 6l6 6-6 6" /></svg
	>{/snippet}
{#snippet iconEye()}<svg viewBox="0 0 24 24" aria-hidden="true"
		><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle
			cx="12"
			cy="12"
			r="3"
		/></svg
	>{/snippet}
{#snippet iconAlert()}<svg viewBox="0 0 24 24" aria-hidden="true"
		><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></svg
	>{/snippet}
{#snippet iconTerm()}<svg viewBox="0 0 24 24" aria-hidden="true"
		><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m5 8 5 4-5 4M12 16h7" /></svg
	>{/snippet}
{#snippet iconGauge()}<svg viewBox="0 0 24 24" aria-hidden="true"
		><circle cx="12" cy="12" r="9" /><path d="M12 12l4-3" /></svg
	>{/snippet}
{#snippet iconList()}<svg viewBox="0 0 24 24" aria-hidden="true"
		><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg
	>{/snippet}
{#snippet iconSpark()}<svg viewBox="0 0 24 24" aria-hidden="true"
		><path
			d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"
		/></svg
	>{/snippet}

{#snippet toolbarStart(viewId: Id)}
	{@const view = views.get(viewId)}
	{#if view?.icon}
		<span class="pt-ico">{@render view.icon()}</span>
	{/if}
	<span class="pt-title">{view?.title ?? viewId}</span>
{/snippet}

{#snippet toolbarEnd(viewId: Id)}
	<button type="button" class="pt" title="Split right" onclick={() => splitPane(viewId, 'right')}>
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M4 7h6M14 17h6" /></svg>
	</button>
	<button type="button" class="pt" title="Split down" onclick={() => splitPane(viewId, 'down')}>
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18M7 4v6M17 14v6" /></svg>
	</button>
	<button
		type="button"
		class="pt"
		title={config.maximizedView === viewId
			? 'Exit fullscreen pane (Esc)'
			: 'Toggle fullscreen pane'}
		onclick={() => frame(viewId)}
	>
		{#if config.maximizedView === viewId}
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

<div
	class="demo-root"
	data-theme={settings.theme}
	data-style={settings.style}
	style:--hl-local-accent={settings.accent}
	style:--hl-accent={settings.accent}
	style:--hl-pad="{settings.pad}px"
	style:--hl-inset="{settings.inset}px"
	style:--hl-tab-gap="{settings.tabGap}px"
	style:--hl-tab-h="{settings.tabH}px"
	style:--hl-toolbar-h="{settings.toolbarH}px"
>
	<header class="demo-bar">
		<a class="demo-bar__brand" href="/">← HorizonLayout</a>
		<span class="demo-bar__title">fullscreen workspace</span>
		<span class="demo-bar__active">
			active: <code>{activeView ?? '—'}</code>
		</span>
		<span class="spacer"></span>
		{#if config.maximizedView}
			<button
				type="button"
				class="demo-btn demo-btn--primary"
				onclick={() => {
					config = toggleMaximizedView(config, config.maximizedView!);
				}}
				title="Exit pane fullscreen (Esc)"
			>
				Restore pane <kbd>Esc</kbd>
			</button>
		{/if}
		<button type="button" class="demo-btn" onclick={() => (paletteOpen = true)}>
			Commands <kbd>⌘K</kbd>
		</button>
		<button type="button" class="demo-btn" onclick={cycleTheme}>Theme: {settings.theme}</button>
		<button type="button" class="demo-btn" onclick={toggleFullscreen}>
			{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
		</button>
		<button type="button" class="demo-btn demo-btn--primary" onclick={() => (settingsOpen = true)}>
			Settings <kbd>⌘⇧,</kbd>
		</button>
	</header>

	<div class="demo-layout">
		<HorizonLayout
			bind:config
			bind:activeView
			{views}
			surface={settings.surface}
			{toolbarStart}
			{toolbarEnd}
			onCloseTab={closePane}
			onAddTab={handleAddTab}
			onRenameTab={handleRenameTab}
			keepAlive={settings.keepAlive}
			tabCycleButtons={settings.tabCycleButtons}
			disableResizeSplits={settings.disableResizeSplits}
			disableDragAndDrop={settings.disableDragAndDrop}
			hideTabBar={settings.hideTabBar}
			minWidthRatio={settings.minWidthRatio}
			minHeightRatio={settings.minHeightRatio}
			maxDepth={settings.maxDepth}
		/>
	</div>
</div>

<SettingsModal open={settingsOpen} onClose={() => (settingsOpen = false)} actions={catalog} />

{#if paletteOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="palette-backdrop"
		onclick={(event) => event.target === event.currentTarget && (paletteOpen = false)}
	>
		<div class="palette" role="dialog" aria-modal="true" aria-label="Command palette" tabindex={-1}>
			<input
				class="palette__input"
				placeholder="Run a command…"
				bind:this={paletteInput}
				bind:value={paletteQuery}
				onkeydown={(event) => {
					if (event.key === 'Escape') paletteOpen = false;
				}}
			/>
			<ul class="palette__list">
				{#each filteredActions as action (action.id)}
					<li>
						<button type="button" class="palette__item" onclick={() => runAction(action)}>
							<span>{action.label}</span>
							<span class="palette__cat">{action.category}</span>
						</button>
					</li>
				{:else}
					<li class="palette__empty">No matching commands</li>
				{/each}
			</ul>
		</div>
	</div>
{/if}

<style>
	:global(body) {
		margin: 0;
		background: var(--hl-bg);
		color: var(--hl-fg);
		font-family:
			ui-sans-serif,
			system-ui,
			-apple-system,
			sans-serif;
	}

	.demo-root {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		background: var(--hl-bg);
		color: var(--hl-fg);
	}

	.demo-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
		height: 2.4rem;
		padding: 0 0.75rem;
		background: color-mix(in srgb, var(--hl-panel) 80%, black);
		border-bottom: 1px solid var(--hl-frame);
		font-size: 0.76rem;
	}

	.demo-bar__brand {
		color: var(--hl-fg);
		text-decoration: none;
		font-weight: 600;
	}

	.demo-bar__brand:hover {
		color: var(--hl-local-accent);
	}

	.demo-bar__title {
		color: var(--hl-muted);
	}

	.demo-bar__active code {
		color: var(--hl-local-accent);
		background: color-mix(in srgb, var(--hl-panel) 60%, black);
		padding: 1px 5px;
		border-radius: 4px;
	}

	.spacer {
		flex: 1;
	}

	.demo-btn {
		appearance: none;
		font: inherit;
		font-size: 0.72rem;
		color: var(--hl-fg);
		background: color-mix(in srgb, var(--hl-bg) 60%, transparent);
		border: 1px solid var(--hl-frame);
		border-radius: 6px;
		padding: 0.25rem 0.55rem;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.demo-btn:hover {
		border-color: var(--hl-local-accent);
	}

	.demo-btn--primary {
		border-color: var(--hl-local-accent);
	}

	.demo-btn kbd {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.85em;
		opacity: 0.7;
	}

	.demo-layout {
		flex: 1;
		min-height: 0;
		position: relative;
	}

	/* Pane toolbar buttons */
	:global(.demo-layout .pt) {
		appearance: none;
		background: transparent;
		border: none;
		color: var(--hl-muted);
		padding: 2px 4px;
		border-radius: 4px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	:global(.demo-layout .pt:hover) {
		color: var(--hl-fg);
		background: color-mix(in srgb, var(--hl-fg) 10%, transparent);
	}

	:global(.demo-layout .pt--danger:hover) {
		color: #ff6b5e;
	}

	:global(.demo-layout .pt svg) {
		width: 13px;
		height: 13px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	:global(.demo-layout .pt-ico) {
		display: inline-flex;
		align-items: center;
		color: var(--hl-local-accent);
	}

	:global(.demo-layout .pt-ico svg),
	:global(.horizon-layout-tabgroup__tab-icon svg) {
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	:global(.demo-layout .pt-title) {
		color: var(--hl-fg);
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 40%;
	}

	/* Command palette */
	.palette-backdrop {
		position: fixed;
		inset: 0;
		z-index: 90;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 12vh;
		background: rgb(0 0 0 / 0.45);
	}

	.palette {
		width: min(460px, 90vw);
		background: var(--hl-panel);
		color: var(--hl-fg);
		border: 1px solid var(--hl-frame);
		border-radius: 10px;
		overflow: hidden;
		box-shadow: 0 20px 50px rgb(0 0 0 / 0.45);
	}

	.palette__input {
		width: 100%;
		box-sizing: border-box;
		font: inherit;
		font-size: 0.85rem;
		padding: 0.65rem 0.8rem;
		background: transparent;
		color: var(--hl-fg);
		border: none;
		border-bottom: 1px solid var(--hl-frame);
		outline: none;
	}

	.palette__list {
		list-style: none;
		margin: 0;
		padding: 0.35rem;
		max-height: 45vh;
		overflow-y: auto;
	}

	.palette__item {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		font: inherit;
		font-size: 0.78rem;
		color: var(--hl-fg);
		background: transparent;
		border: none;
		border-radius: 6px;
		padding: 0.45rem 0.55rem;
		cursor: pointer;
		text-align: left;
	}

	.palette__item:hover {
		background: color-mix(in srgb, var(--hl-local-accent) 18%, transparent);
	}

	.palette__cat {
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--hl-muted);
	}

	.palette__empty {
		padding: 0.75rem;
		text-align: center;
		color: var(--hl-muted);
		font-size: 0.76rem;
	}
</style>
