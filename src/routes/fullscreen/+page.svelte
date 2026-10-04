<script lang="ts">
	import { mount, onMount, createRawSnippet, unmount, type Snippet } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import '$lib/horizon-layout.css';
	import HorizonLayout from '$lib/HorizonLayout.svelte';
	import EmptyPane from './EmptyPane.svelte';
	import NoteEditor from './NoteEditor.svelte';
	import GroupPane from './GroupPane.svelte';
	import SplitSquareHorizontalIcon from '@lucide/svelte/icons/split-square-horizontal';
	import SplitSquareVerticalIcon from '@lucide/svelte/icons/split-square-vertical';
	import {
		addPaneToLayout,
		collectTabViewIds,
		createLayoutHandle,
		findTabGroupForViewId,
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

	// Renders a live Svelte component as a pane-body snippet. HorizonLayout
	// renders snippets via `{@render ...}`, which cannot mount components
	// directly — so we expose an empty host element and mount into it.
	function componentSnippet(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		component: any,
		props: Record<string, unknown> = {}
	): Snippet {
		return createRawSnippet(() => ({
			render: () => `<div class="hl-host"></div>`,
			setup: (element) => {
				const instance = mount(component as never, { target: element, props });
				return () => unmount(instance);
			}
		}));
	}

	// ── Notes ──
	// Each note pane is a plain textarea with its own title/body state, so we
	// can test groups and notes together. Keyed by the note's view id.
	const notes = $state<Record<string, { title: string; body: string }>>({});

	function noteSnippet(id: Id): Snippet {
		if (!notes[id]) notes[id] = { title: 'Untitled note', body: '' };
		return componentSnippet(NoteEditor, {
			get title() {
				return notes[id]?.title ?? '';
			},
			get value() {
				return notes[id]?.body ?? '';
			},
			onTitleChange: (next: string) => {
				if (!notes[id]) return;
				notes[id].title = next;
				syncNoteView(id);
			},
			onValueChange: (next: string) => {
				if (!notes[id]) return;
				notes[id].body = next;
				syncNoteView(id);
			}
		});
	}

	function syncNoteView(id: Id) {
		const view = views.get(id);
		const note = notes[id];
		if (!view || !note) return;
		const words = note.body.trim() ? note.body.trim().split(/\s+/).length : 0;
		views.set(id, {
			...view,
			title: note.title || 'Untitled note',
			badge: words > 0 ? words : undefined
		});
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
		tone: 'warning',
		badge: 2,
		snippet: leaf('2 errors · 0 warnings')
	});
	views.set('terminal', { title: 'Terminal', icon: iconTerm, snippet: snippetTerminal });

	// Content-driven tab state: the terminal pane pushes busy/tone/badge so the
	// tab shows a spinner while running, turns red on failure, and badges runs.
	let termState = $state<'idle' | 'running' | 'success' | 'error'>('idle');
	let termRuns = $state(0);

	function syncTerminalView() {
		const view = views.get('terminal');
		if (!view) return;
		views.set('terminal', {
			...view,
			busy: termState === 'running',
			tone: termState === 'error' ? 'danger' : termState === 'success' ? 'success' : 'neutral',
			badge: termRuns > 0 ? termRuns : undefined
		});
	}

	function runTerminal() {
		if (termState === 'running') return;
		termState = 'running';
		syncTerminalView();
		setTimeout(() => {
			termRuns += 1;
			termState = 'success';
			syncTerminalView();
		}, 1600);
	}

	function failTerminal() {
		if (termState === 'running') return;
		termState = 'running';
		syncTerminalView();
		setTimeout(() => {
			termState = 'error';
			syncTerminalView();
		}, 1200);
	}
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
			title: `Pane ${paneSeq}`,
			icon: iconSpark,
			snippet: emptyPaneSnippet(id)
		});
		return id;
	}

	// The empty pane presents pane-creation actions; picking one replaces the
	// empty pane in place with the chosen view.
	function emptyPaneSnippet(id: Id): Snippet {
		return componentSnippet(EmptyPane, {
			onOpenNote: () => replaceWithNote(id),
			onOpenGroup: () => replaceWithGroup(id),
			onOpenTerminal: () => replaceWith(id, 'terminal'),
			onOpenEditor: () => replaceWith(id, 'editor')
		});
	}

	// Swap the view rendered by an existing tab, keeping its layout position.
	function replaceWith(id: Id, targetId: Id) {
		const view = views.get(targetId);
		if (!view) return;
		views.set(id, view);
		activeView = id;
	}

	let noteSeq = 0;
	function replaceWithNote(id: Id) {
		noteSeq += 1;
		notes[id] = { title: `Note ${noteSeq}`, body: '' };
		views.set(id, {
			title: notes[id].title,
			icon: iconNote,
			snippet: noteSnippet(id)
		});
		activeView = id;
	}

	const groupLayouts = $state<Record<string, LayoutConfig>>({});

	// Groups nest a fresh HorizonLayout inside the pane body, so a group is a
	// layout within a layout — the core thing we want to exercise.
	function replaceWithGroup(id: Id) {
		const groupId = id.startsWith('group:') ? id.slice(6) : id;
		if (!groupLayouts[groupId] && !groupLayouts[id]) {
			groupLayouts[groupId] = {
				root: {
					tabs: ['g-editor', 'g-notes'],
					activeTabIndex: 0
				}
			};
		}
		views.set(id, {
			title: 'Group',
			icon: iconGroup,
			snippet: groupSnippet(id),
			hideToolbar: true
		});
		activeView = id;
	}

	function groupSnippet(id: Id): Snippet {
		const groupId = id.startsWith('group:') ? id.slice(6) : id;
		return componentSnippet(GroupPane, {
			groupId,
			get config() {
				return groupLayouts[groupId] ?? groupLayouts[id];
			},
			onConfigChange: (next: LayoutConfig) => {
				groupLayouts[groupId] = next;
				groupLayouts[id] = next;
			},
			onCycleTab: (_tg: TabGroupConfig, delta: -1 | 1) => {
				layoutHandle.selectAdjacentTab(delta);
			},
			onActivateView: (innerViewId: Id) => {
				activeView = innerViewId;
			}
		});
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
			getGroupLayout: (groupId) =>
				groupLayouts[groupId] ??
				groupLayouts[`group:${groupId}`] ??
				groupLayouts[groupId.replace(/^group:/, '')],
			setGroupLayout: (groupId, next) => {
				const plain = groupId.replace(/^group:/, '');
				groupLayouts[groupId] = next;
				groupLayouts[plain] = next;
				groupLayouts[`group:${plain}`] = next;
			},
			getActiveGroupViewId: () => {
				if (!activeView) return null;
				for (const [gid, glayout] of Object.entries(groupLayouts)) {
					if (glayout?.root && findTabGroupForViewId(glayout.root, activeView)) {
						if (config.root && findTabGroupForViewId(config.root, gid)) return gid;
						if (config.root && findTabGroupForViewId(config.root, `group:${gid}`)) return `group:${gid}`;
						return gid;
					}
				}
				if (activeView.startsWith('group:') || groupLayouts[activeView]) return activeView;
				return null;
			},
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

	// Mirror the motion setting onto <html> so host chrome (drawers, sidebars,
	// overlays) can gate its own transitions on `:root[data-motion]`.
	$effect(() => {
		document.documentElement.dataset['motion'] = settings.motion;
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
{#snippet iconNote()}<svg viewBox="0 0 24 24" aria-hidden="true"
		><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path
			d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"
		/><path d="M9 13h6M9 17h4" /></svg
	>{/snippet}
{#snippet iconGroup()}<svg viewBox="0 0 24 24" aria-hidden="true"
		><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></svg
	>{/snippet}

{#snippet snippetTerminal()}
	<div class="term">
		<div class="term__status">
			{termState === 'running'
				? 'Running…'
				: termState === 'error'
					? 'Failed'
					: termState === 'success'
						? 'Passed'
						: 'Idle'}
		</div>
		<div class="term__log">
			{#if termState === 'running'}$ pnpm build…{:else if termState === 'error'}$ pnpm build<br />✖
				exit 1{:else if termState === 'success'}$ pnpm build<br />✔ done in 1.6s{:else}$ ready{/if}
		</div>
		<div class="term__actions">
			<button type="button" onclick={runTerminal} disabled={termState === 'running'}>Run</button>
			<button type="button" onclick={failTerminal} disabled={termState === 'running'}>Fail</button>
		</div>
	</div>
{/snippet}

{#snippet toolbarStart(viewId: Id)}
	{@const view = views.get(viewId)}
	{#if view?.icon}
		<span class="pt-ico">{@render view.icon()}</span>
	{/if}
	<span class="pt-title">{view?.title ?? viewId}</span>
{/snippet}

{#snippet toolbarEnd(viewId: Id)}
	<button type="button" class="pt" title="Split right" onclick={() => splitPane(viewId, 'right')}>
		<SplitSquareHorizontalIcon />
	</button>
	<button type="button" class="pt" title="Split down" onclick={() => splitPane(viewId, 'down')}>
		<SplitSquareVerticalIcon />
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

{#snippet statusBarDemo()}
	<div class="horizon-layout__status-bar-cluster horizon-layout__status-bar-cluster--left">
		<span class="horizon-layout__status-bar-item">HorizonLayout</span>
		<span class="horizon-layout__status-bar-item">
			<svg viewBox="0 0 24 24" aria-hidden="true"
				><path
					d="M6 3v12M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 9a9 9 0 0 0 9 9"
				/></svg
			>
			main
		</span>
		<span class="horizon-layout__status-bar-item">
			<code>{activeView ?? '—'}</code>
		</span>
	</div>
	<div class="horizon-layout__status-bar-center">
		<span class="horizon-layout__status-bar-center-label">
			{settings.surface} · {settings.motion}
		</span>
	</div>
	<div class="horizon-layout__status-bar-cluster horizon-layout__status-bar-cluster--right">
		<button
			type="button"
			class="horizon-layout__status-bar-item horizon-layout__status-bar-item--button"
			title="2 problems"
			aria-label="2 problems"
			onclick={() => {
				paletteQuery = 'problems';
				paletteOpen = true;
			}}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true"
				><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></svg
			>
			<span class="horizon-layout__status-bar-badge">2</span>
		</button>
		<button
			type="button"
			class="horizon-layout__status-bar-item horizon-layout__status-bar-item--button horizon-layout__status-bar-item--icon"
			title="Command palette (⌘K)"
			aria-label="Command palette"
			onclick={() => (paletteOpen = true)}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true"
				><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg
			>
		</button>
		<button
			type="button"
			class="horizon-layout__status-bar-item horizon-layout__status-bar-item--button horizon-layout__status-bar-item--icon"
			title="Cycle theme"
			aria-label="Cycle theme"
			onclick={cycleTheme}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true"
				><circle cx="12" cy="12" r="4" /><path
					d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2 2M17.5 17.5l2 2M19.5 4.5l-2 2M6.5 17.5l-2 2"
				/></svg
			>
		</button>
		<button
			type="button"
			class="horizon-layout__status-bar-item horizon-layout__status-bar-item--button horizon-layout__status-bar-item--icon"
			class:horizon-layout__status-bar-item--active={isFullscreen}
			title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
			aria-label="Toggle fullscreen"
			onclick={toggleFullscreen}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true"
				><path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5" /></svg
			>
		</button>
	</div>
{/snippet}

<div
	class="demo-root"
	data-theme={settings.theme}
	data-style={settings.style}
	data-surface={settings.surface}
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
			{groupLayouts}
			onCycleTab={(_tg, delta) => layoutHandle.selectAdjacentTab(delta)}
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
			dimOtherPanes={settings.dimOtherPanes}
			motion={settings.motion}
			statusBar={statusBarDemo}
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
		height: var(--hl-status-h, 26px);
		padding: 0 var(--hl-pad);
		background: #000000;
		border-bottom: 1px solid var(--hl-frame);
		font-size: 0.74rem;
		box-sizing: border-box;
		width: 100%;
	}

	.demo-root[data-surface='card'] .demo-bar {
		margin: var(--hl-pad) var(--hl-pad) 0;
		width: calc(100% - (var(--hl-pad) * 2));
		border: 1px solid var(--hl-frame);
		border-radius: var(--hl-radius) var(--hl-radius) 0 0;
	}

	.demo-root[data-surface='inset'] .demo-bar {
		margin: calc(var(--hl-pad) / 2) calc(var(--hl-pad) / 2) 0;
		width: calc(100% - var(--hl-pad));
		border: 1px solid color-mix(in srgb, var(--hl-frame) 55%, transparent);
		border-radius: var(--hl-radius) var(--hl-radius) 0 0;
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
		font-size: 0.7rem;
		color: var(--hl-fg);
		background: color-mix(in srgb, var(--hl-bg) 60%, transparent);
		border: 1px solid var(--hl-frame);
		border-radius: 5px;
		padding: 1px 7px;
		height: 20px;
		box-sizing: border-box;
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
		min-width: 0;
	}

	/* Terminal demo pane (content-driven tab state) */
	.term {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.72rem;
	}

	.term__status {
		color: var(--hl-muted);
	}

	.term__log {
		color: var(--hl-fg);
		line-height: 1.5;
	}

	.term__actions {
		display: flex;
		gap: 0.4rem;
	}

	.term__actions button {
		font: inherit;
		font-size: 0.72rem;
		padding: 2px 8px;
		border: 1px solid var(--hl-frame);
		background: transparent;
		color: var(--hl-fg);
		border-radius: 5px;
		cursor: pointer;
	}

	.term__actions button:hover:not(:disabled) {
		border-color: var(--hl-local-accent);
	}

	.term__actions button:disabled {
		opacity: 0.5;
		cursor: default;
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
		animation: demo-pop-in var(--hl-motion-dur, 150ms) var(--hl-motion-ease, ease);
	}

	@keyframes demo-pop-in {
		from {
			opacity: 0;
			transform: translateY(-6px) scale(0.99);
		}
		to {
			opacity: 1;
			transform: none;
		}
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
