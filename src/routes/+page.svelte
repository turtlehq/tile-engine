<script lang="ts">
	import './app.css';
	import '$lib/horizon-layout.css';
	import HorizonLayout from '$lib/HorizonLayout.svelte';
	import type { Id, LayoutConfig, TabGroupConfig, View } from '$lib/types.js';
	import { SvelteMap } from 'svelte/reactivity';
	import { createRawSnippet, type Snippet } from 'svelte';

	// shadcn-svelte components
	import { Slider } from './ui/slider/index.js';
	import * as Select from './ui/select/index.js';
	import { Switch } from './ui/switch/index.js';
	import { Label } from './ui/label/index.js';
	import { Badge } from './ui/badge/index.js';
	import * as Card from './ui/card/index.js';
	import { Button } from './ui/button/index.js';

	// Knobs state
	let pad = $state(6);
	let inset = $state(8);
	let tabGap = $state(4);
	let tabH = $state(28);
	let toolbarH = $state(28);
	let accentW = $state(3);
	let stylePreset = $state<'border' | 'soft' | 'accent' | 'thin'>('accent');

	const presetLabels: Record<string, string> = {
		border: 'A · border only',
		soft: 'B · soft fill',
		accent: 'C · strong accent',
		thin: 'D · thin accent'
	};

	let togIcons = $state(true);
	let togToolbar = $state(true);
	let togFrames = $state(true);
	let togAdd = $state(true);
	let togInset = $state(true);

	// ── Preview A Layout ──
	let configA: LayoutConfig = $state({
		root: {
			tabs: ['rendered_A', 'code_A'],
			activeTabIndex: 0
		}
	});

	let configA_rendered: LayoutConfig = $state({
		root: {
			tabs: ['more-stuff_A', 'things_A', 'more-things_A'],
			activeTabIndex: 0
		}
	});

	let configA_code: LayoutConfig = $state({
		root: {
			tabs: ['src_A', 'styles_A'],
			activeTabIndex: 0
		}
	});

	// ── Preview B Layout ──
	let configB: LayoutConfig = $state({
		root: {
			tabs: ['rendered_B', 'code_B'],
			activeTabIndex: 0
		}
	});

	let configB_rendered: LayoutConfig = $state({
		root: {
			tabs: ['more-stuff_B', 'things_B'],
			activeTabIndex: 0
		}
	});

	let configB_code: LayoutConfig = $state({
		root: {
			tabs: ['src_B', 'styles_B'],
			activeTabIndex: 0
		}
	});

	// ── Studio Layout ──
	let configStudio: LayoutConfig = $state({
		root: {
			tabs: ['group_studio', 'path_studio'],
			activeTabIndex: 0
		}
	});

	let configStudio_group: LayoutConfig = $state({
		root: {
			tabs: ['t1_studio', 't2_studio', 'browser_studio'],
			activeTabIndex: 0
		}
	});

	function toggleMax(cfg: LayoutConfig, viewId: Id) {
		cfg.maximizedView = cfg.maximizedView === viewId ? undefined : viewId;
	}

	function splitPane(cfg: LayoutConfig, viewId: Id) {
		if (!cfg.root) return;
		if ('tabs' in cfg.root) {
			const tg = cfg.root;
			const idx = tg.tabs.indexOf(viewId);
			if (idx !== -1 && tg.tabs.length > 1) {
				const pulled = tg.tabs.splice(idx, 1)[0]!;
				tg.activeTabIndex = Math.min(tg.activeTabIndex, tg.tabs.length - 1);
				cfg.root = {
					direction: 'horizontal',
					views: [tg, { tabs: [pulled], activeTabIndex: 0 }],
					splitPoints: [0.5]
				};
			}
		}
	}

	let extraTabCount = $state(0);

	function createGenericLeaf(content: string): Snippet {
		return createRawSnippet(() => ({
			render: () => `<div class="frame-body"><div class="leaf">${content}</div></div>`
		}));
	}

	function addTabToGroup(tg: TabGroupConfig, prefix: string, viewsMap: SvelteMap<Id, View>) {
		extraTabCount++;
		const newId = `${prefix}-extra-${extraTabCount}`;
		viewsMap.set(newId, {
			title: `item ${extraTabCount}`,
			icon: iconSpark,
			snippet: createGenericLeaf(`Nested pane · ${newId}`)
		});
		tg.tabs.push(newId);
		tg.activeTabIndex = tg.tabs.length - 1;
	}

	// Views definitions for Preview A
	let viewsA_inner = new SvelteMap<Id, View>([
		[
			'more-stuff_A',
			{
				title: 'more stuff',
				icon: iconLayers,
				snippet: snippetMoreStuffA
			}
		],
		[
			'things_A',
			{
				title: 'things',
				icon: iconBox,
				snippet: snippetThingsA
			}
		],
		[
			'more-things_A',
			{
				title: 'more things',
				icon: iconSpark,
				snippet: snippetMoreThingsA
			}
		]
	]);

	let viewsA_codeInner = new SvelteMap<Id, View>([
		[
			'src_A',
			{
				title: 'src',
				icon: iconCode,
				snippet: snippetSrcA
			}
		],
		[
			'styles_A',
			{
				title: 'styles',
				icon: iconSpark,
				snippet: snippetStylesA
			}
		]
	]);

	let viewsA_outer = new SvelteMap<Id, View>([
		[
			'rendered_A',
			{
				title: 'rendered',
				icon: iconEye,
				snippet: snippetRenderedA
			}
		],
		[
			'code_A',
			{
				title: 'code',
				icon: iconCode,
				snippet: snippetCodeA
			}
		]
	]);

	// Views definitions for Preview B
	let viewsB_inner = new SvelteMap<Id, View>([
		[
			'more-stuff_B',
			{
				title: 'more stuff',
				icon: iconLayers,
				snippet: snippetMoreStuffB
			}
		],
		[
			'things_B',
			{
				title: 'things',
				icon: iconBox,
				snippet: snippetThingsB
			}
		]
	]);

	let viewsB_codeInner = new SvelteMap<Id, View>([
		[
			'src_B',
			{
				title: 'src',
				icon: iconCode,
				snippet: snippetSrcB
			}
		],
		[
			'styles_B',
			{
				title: 'styles',
				icon: iconSpark,
				snippet: snippetStylesB
			}
		]
	]);

	let viewsB_outer = new SvelteMap<Id, View>([
		[
			'rendered_B',
			{
				title: 'rendered',
				icon: iconEye,
				snippet: snippetRenderedB
			}
		],
		[
			'code_B',
			{
				title: 'code',
				icon: iconCode,
				snippet: snippetCodeB
			}
		]
	]);

	// Views definitions for Studio
	let viewsStudio_group = new SvelteMap<Id, View>([
		[
			't1_studio',
			{
				title: 'Terminal 1',
				icon: iconTerm,
				snippet: snippetTerm1
			}
		],
		[
			't2_studio',
			{
				title: 'Terminal 2',
				icon: iconTerm,
				snippet: snippetTerm2
			}
		],
		[
			'browser_studio',
			{
				title: 'Browser',
				icon: iconGlobe,
				snippet: snippetBrowser
			}
		]
	]);

	let viewsStudio_outer = new SvelteMap<Id, View>([
		[
			'group_studio',
			{
				title: 'Group 30',
				icon: iconFolder,
				snippet: snippetStudioGroup
			}
		],
		[
			'path_studio',
			{
				title: '~/TURTLE/…',
				icon: iconTerm,
				snippet: snippetStudioPath
			}
		]
	]);
</script>

{#snippet iconEye()}
	<svg
		class="ico keep"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"
	>
		<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
		<circle cx="12" cy="12" r="3" />
	</svg>
{/snippet}

{#snippet iconCode()}
	<svg
		class="ico keep"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"
	>
		<path d="m8 6-6 6 6 6M16 6l6 6-6 6" />
	</svg>
{/snippet}

{#snippet iconLayers()}
	<svg
		class="ico keep"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"
	>
		<path d="m12 2 10 6-10 6L2 8l10-6Z" />
		<path d="m2 14 10 6 10-6" />
	</svg>
{/snippet}

{#snippet iconBox()}
	<svg
		class="ico keep"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"
	>
		<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
		<path d="m3 8 9 5 9-5M12 13v10" />
	</svg>
{/snippet}

{#snippet iconSpark()}
	<svg
		class="ico keep"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"
	>
		<path
			d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"
		/>
	</svg>
{/snippet}

{#snippet iconFolder()}
	<svg
		class="ico keep"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"
	>
		<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
	</svg>
{/snippet}

{#snippet iconTerm()}
	<svg
		class="ico keep"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"
	>
		<path d="m5 8 5 4-5 4M12 16h7" />
		<rect x="3" y="4" width="18" height="16" rx="2" />
	</svg>
{/snippet}

{#snippet iconGlobe()}
	<svg
		class="ico keep"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"
	>
		<circle cx="12" cy="12" r="9" />
		<path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
	</svg>
{/snippet}

{#snippet iconSplit()}
	<svg
		class="ico keep"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"
	>
		<path d="M12 3v18M4 7h6M14 17h6" />
	</svg>
{/snippet}

{#snippet iconMax()}
	<svg
		class="ico keep"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"
	>
		<path d="M4 9V4h5M20 15v5h-5M20 9V4h-5M4 15v5h5" />
	</svg>
{/snippet}

{#snippet iconRestore()}
	<svg
		class="ico keep"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
	</svg>
{/snippet}

{#snippet iconMore()}
	<svg
		class="ico keep"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		aria-hidden="true"
	>
		<circle cx="6" cy="12" r="1.5" fill="currentColor" />
		<circle cx="12" cy="12" r="1.5" fill="currentColor" />
		<circle cx="18" cy="12" r="1.5" fill="currentColor" />
	</svg>
{/snippet}

<!-- Leaf snippets -->
{#snippet snippetMoreStuffA()}
	<div class="frame-body">
		<div class="leaf">Nested pane · more stuff</div>
	</div>
{/snippet}

{#snippet snippetThingsA()}
	<div class="frame-body">
		<div class="leaf">Nested pane · things</div>
	</div>
{/snippet}

{#snippet snippetMoreThingsA()}
	<div class="frame-body">
		<div class="leaf">Nested pane · more things</div>
	</div>
{/snippet}

{#snippet snippetSrcA()}
	<div class="frame-body">
		<div class="leaf">export function nest() &#123; … &#125;</div>
	</div>
{/snippet}

{#snippet snippetStylesA()}
	<div class="frame-body">
		<div class="leaf">.nested &#123; margin-left: var(--inset); &#125;</div>
	</div>
{/snippet}

<!-- Nested HorizonLayout containers for Preview A -->
{#snippet snippetRenderedA()}
	<div class="frame-body">
		<div class="nested">
			<HorizonLayout
				bind:config={configA_rendered}
				views={viewsA_inner}
				paneToolbar={renderToolbarSnippetA}
				onAddTab={(tg) => addTabToGroup(tg, 'rendered-a', viewsA_inner)}
			/>
		</div>
	</div>
{/snippet}

{#snippet snippetCodeA()}
	<div class="frame-body">
		<div class="nested">
			<HorizonLayout
				bind:config={configA_code}
				views={viewsA_codeInner}
				paneToolbar={renderToolbarSnippetA_code}
				onAddTab={(tg) => addTabToGroup(tg, 'code-a', viewsA_codeInner)}
			/>
		</div>
	</div>
{/snippet}

{#snippet renderToolbarSnippetA(viewId: Id)}
	{@const title = viewsA_inner.get(viewId)?.title ?? viewId}
	<button
		type="button"
		class="tool"
		onclick={() => splitPane(configA_rendered, viewId)}
		tabindex="-1"
	>
		{@render iconSplit()}
		<span>Split</span>
	</button>
	<button
		type="button"
		class="tool"
		onclick={() => toggleMax(configA_rendered, viewId)}
		tabindex="-1"
		title={configA_rendered.maximizedView === viewId ? 'Restore pane' : 'Maximize pane'}
	>
		{#if configA_rendered.maximizedView === viewId}
			{@render iconRestore()}
			<span>Restore</span>
		{:else}
			{@render iconMax()}
			<span>Max</span>
		{/if}
	</button>
	<span class="spacer"></span>
	<span>{title}</span>
	<button type="button" class="tool" tabindex="-1" title="More">
		{@render iconMore()}
	</button>
{/snippet}

{#snippet renderToolbarSnippetA_code(viewId: Id)}
	{@const title = viewsA_codeInner.get(viewId)?.title ?? viewId}
	<button type="button" class="tool" onclick={() => splitPane(configA_code, viewId)} tabindex="-1">
		{@render iconSplit()}
		<span>Split</span>
	</button>
	<button
		type="button"
		class="tool"
		onclick={() => toggleMax(configA_code, viewId)}
		tabindex="-1"
		title={configA_code.maximizedView === viewId ? 'Restore pane' : 'Maximize pane'}
	>
		{#if configA_code.maximizedView === viewId}
			{@render iconRestore()}
			<span>Restore</span>
		{:else}
			{@render iconMax()}
			<span>Max</span>
		{/if}
	</button>
	<span class="spacer"></span>
	<span>{title}</span>
	<button type="button" class="tool" tabindex="-1" title="More">
		{@render iconMore()}
	</button>
{/snippet}

<!-- Preview B Snippets -->
{#snippet snippetMoreStuffB()}
	<div class="frame-body">
		<div class="leaf">Nested pane · Preview B · more stuff</div>
	</div>
{/snippet}

{#snippet snippetThingsB()}
	<div class="frame-body">
		<div class="leaf">Nested pane · Preview B · things</div>
	</div>
{/snippet}

{#snippet snippetSrcB()}
	<div class="frame-body">
		<div class="leaf">import &#123; HorizonLayout &#125; from 'horizon-layout';</div>
	</div>
{/snippet}

{#snippet snippetStylesB()}
	<div class="frame-body">
		<div class="leaf">:root &#123; --hl-inset: 8px; &#125;</div>
	</div>
{/snippet}

{#snippet snippetRenderedB()}
	<div class="frame-body">
		<div class="nested">
			<HorizonLayout
				bind:config={configB_rendered}
				views={viewsB_inner}
				paneToolbar={renderToolbarSnippetB}
				onAddTab={(tg) => addTabToGroup(tg, 'rendered-b', viewsB_inner)}
			/>
		</div>
	</div>
{/snippet}

{#snippet snippetCodeB()}
	<div class="frame-body">
		<div class="nested">
			<HorizonLayout
				bind:config={configB_code}
				views={viewsB_codeInner}
				paneToolbar={renderToolbarSnippetB_code}
				onAddTab={(tg) => addTabToGroup(tg, 'code-b', viewsB_codeInner)}
			/>
		</div>
	</div>
{/snippet}

{#snippet renderToolbarSnippetB(viewId: Id)}
	{@const title = viewsB_inner.get(viewId)?.title ?? viewId}
	<button
		type="button"
		class="tool"
		onclick={() => splitPane(configB_rendered, viewId)}
		tabindex="-1"
	>
		{@render iconSplit()}
		<span>Split</span>
	</button>
	<button
		type="button"
		class="tool"
		onclick={() => toggleMax(configB_rendered, viewId)}
		tabindex="-1"
		title={configB_rendered.maximizedView === viewId ? 'Restore pane' : 'Maximize pane'}
	>
		{#if configB_rendered.maximizedView === viewId}
			{@render iconRestore()}
			<span>Restore</span>
		{:else}
			{@render iconMax()}
			<span>Max</span>
		{/if}
	</button>
	<span class="spacer"></span>
	<span>{title}</span>
	<button type="button" class="tool" tabindex="-1" title="More">
		{@render iconMore()}
	</button>
{/snippet}

{#snippet renderToolbarSnippetB_code(viewId: Id)}
	{@const title = viewsB_codeInner.get(viewId)?.title ?? viewId}
	<button type="button" class="tool" onclick={() => splitPane(configB_code, viewId)} tabindex="-1">
		{@render iconSplit()}
		<span>Split</span>
	</button>
	<button
		type="button"
		class="tool"
		onclick={() => toggleMax(configB_code, viewId)}
		tabindex="-1"
		title={configB_code.maximizedView === viewId ? 'Restore pane' : 'Maximize pane'}
	>
		{#if configB_code.maximizedView === viewId}
			{@render iconRestore()}
			<span>Restore</span>
		{:else}
			{@render iconMax()}
			<span>Max</span>
		{/if}
	</button>
	<span class="spacer"></span>
	<span>{title}</span>
	<button type="button" class="tool" tabindex="-1" title="More">
		{@render iconMore()}
	</button>
{/snippet}

<!-- Studio Snippets -->
{#snippet snippetTerm1()}
	<div class="frame-body">
		<div class="leaf">echo hello from group</div>
	</div>
{/snippet}

{#snippet snippetTerm2()}
	<div class="frame-body">
		<div class="leaf">bun run agent:smoke</div>
	</div>
{/snippet}

{#snippet snippetBrowser()}
	<div class="frame-body">
		<div class="leaf">http://127.0.0.1:8090</div>
	</div>
{/snippet}

{#snippet snippetStudioGroup()}
	<div class="frame-body">
		<div class="nested">
			<HorizonLayout
				bind:config={configStudio_group}
				views={viewsStudio_group}
				paneToolbar={renderToolbarStudio}
				onAddTab={(tg) => addTabToGroup(tg, 'studio-t', viewsStudio_group)}
			/>
		</div>
	</div>
{/snippet}

{#snippet snippetStudioPath()}
	<div class="frame-body">
		<div class="leaf">
			trentbrew@studio % pwd<br />/Users/trentbrew/TURTLE/lab/os-shell/shell-builder
		</div>
	</div>
{/snippet}

{#snippet renderToolbarStudio(viewId: Id)}
	{@const title = viewsStudio_group.get(viewId)?.title ?? viewId}
	<button
		type="button"
		class="tool"
		onclick={() => splitPane(configStudio_group, viewId)}
		tabindex="-1"
	>
		{@render iconSplit()}
		<span>Split</span>
	</button>
	<button
		type="button"
		class="tool"
		onclick={() => toggleMax(configStudio_group, viewId)}
		tabindex="-1"
		title={configStudio_group.maximizedView === viewId ? 'Restore pane' : 'Maximize pane'}
	>
		{#if configStudio_group.maximizedView === viewId}
			{@render iconRestore()}
			<span>Restore</span>
		{:else}
			{@render iconMax()}
			<span>Max</span>
		{/if}
	</button>
	<span class="spacer"></span>
	<span>{title}</span>
	<button type="button" class="tool" tabindex="-1" title="More">
		{@render iconMore()}
	</button>
{/snippet}

<main class="page-container">
	<div class="mb-4">
		<div class="flex items-center gap-2 mb-1">
			<h1>Nested Tabs</h1>
			<Badge
				variant="outline"
				class="text-[0.68rem] uppercase tracking-wider text-muted-foreground border-frame/60"
				>shadcn-svelte</Badge
			>
			<div class="ml-auto flex items-center gap-1.5">
				<Button
					variant="outline"
					size="xs"
					class="h-6 text-[0.68rem] bg-panel/70 border-frame/50 hover:bg-muted"
					onclick={() => {
						pad = 6;
						inset = 8;
						tabGap = 4;
						tabH = 28;
						toolbarH = 28;
						accentW = 3;
						stylePreset = 'accent';
						togIcons = true;
						togToolbar = true;
						togFrames = true;
						togAdd = true;
						togInset = true;
					}}
				>
					Reset Knobs
				</Button>
			</div>
		</div>
		<p class="lede">
			Knobs adjust spacing + style live. Toolbar sits under tabs and shares the active-tab
			background. + stays borderless.
		</p>

		<p class="lede">
			<a href="/fullscreen" style="color: var(--hl-local-accent)"
				>Open the fullscreen workspace demo →</a
			>
		</p>
	</div>

	<!-- Knobs Control Panel (shadcn-svelte Card) -->
	<Card.Root class="mb-5 border-frame/60 bg-panel/85 backdrop-blur-md shadow-sm">
		<Card.Content class="p-3.5 sm:p-4">
			<div class="flex flex-wrap items-end gap-x-6 gap-y-4">
				<!-- Spacing Knobs with shadcn Slider & Badge -->
				<fieldset class="flex flex-wrap items-end gap-3.5 border-none p-0 m-0">
					<legend
						class="text-[0.65rem] font-semibold tracking-wider uppercase text-muted-foreground mb-1 w-full"
						>Spacing</legend
					>

					<div class="flex flex-col gap-1.5 min-w-[7.5rem]">
						<div class="flex items-center justify-between text-[0.68rem] text-muted-foreground">
							<Label class="text-[0.68rem]">Padding</Label>
							<Badge variant="secondary" class="h-4 px-1.5 text-[0.65rem] font-mono leading-none"
								>{pad}px</Badge
							>
						</div>
						<Slider min={4} max={12} step={1} bind:value={pad} class="w-[7.5rem]" />
					</div>

					<div class="flex flex-col gap-1.5 min-w-[7.5rem]">
						<div class="flex items-center justify-between text-[0.68rem] text-muted-foreground">
							<Label class="text-[0.68rem]">Nest inset</Label>
							<Badge variant="secondary" class="h-4 px-1.5 text-[0.65rem] font-mono leading-none"
								>{inset}px</Badge
							>
						</div>
						<Slider min={0} max={24} step={1} bind:value={inset} class="w-[7.5rem]" />
					</div>

					<div class="flex flex-col gap-1.5 min-w-[7.5rem]">
						<div class="flex items-center justify-between text-[0.68rem] text-muted-foreground">
							<Label class="text-[0.68rem]">Tab gap</Label>
							<Badge variant="secondary" class="h-4 px-1.5 text-[0.65rem] font-mono leading-none"
								>{tabGap}px</Badge
							>
						</div>
						<Slider min={0} max={10} step={1} bind:value={tabGap} class="w-[7.5rem]" />
					</div>

					<div class="flex flex-col gap-1.5 min-w-[7.5rem]">
						<div class="flex items-center justify-between text-[0.68rem] text-muted-foreground">
							<Label class="text-[0.68rem]">Tab height</Label>
							<Badge variant="secondary" class="h-4 px-1.5 text-[0.65rem] font-mono leading-none"
								>{tabH}px</Badge
							>
						</div>
						<Slider min={22} max={36} step={1} bind:value={tabH} class="w-[7.5rem]" />
					</div>

					<div class="flex flex-col gap-1.5 min-w-[7.5rem]">
						<div class="flex items-center justify-between text-[0.68rem] text-muted-foreground">
							<Label class="text-[0.68rem]">Toolbar height</Label>
							<Badge variant="secondary" class="h-4 px-1.5 text-[0.65rem] font-mono leading-none"
								>{toolbarH}px</Badge
							>
						</div>
						<Slider min={22} max={36} step={1} bind:value={toolbarH} class="w-[7.5rem]" />
					</div>

					<div class="flex flex-col gap-1.5 min-w-[7.5rem]">
						<div class="flex items-center justify-between text-[0.68rem] text-muted-foreground">
							<Label class="text-[0.68rem]">Accent width</Label>
							<Badge variant="secondary" class="h-4 px-1.5 text-[0.65rem] font-mono leading-none"
								>{accentW}px</Badge
							>
						</div>
						<Slider min={1} max={4} step={0.5} bind:value={accentW} class="w-[7.5rem]" />
					</div>
				</fieldset>

				<!-- Style Presets with shadcn Select -->
				<fieldset class="flex flex-col gap-1.5 border-none p-0 m-0">
					<legend
						class="text-[0.65rem] font-semibold tracking-wider uppercase text-muted-foreground mb-1 w-full"
						>Style</legend
					>
					<Select.Root type="single" bind:value={stylePreset}>
						<Select.Trigger class="w-44 h-7 text-xs bg-bg/70 border-frame/70">
							{presetLabels[stylePreset] ?? stylePreset}
						</Select.Trigger>
						<Select.Content class="bg-panel border-frame text-fg">
							<Select.Item value="border">A · border only</Select.Item>
							<Select.Item value="soft">B · soft fill</Select.Item>
							<Select.Item value="accent">C · strong accent</Select.Item>
							<Select.Item value="thin">D · thin accent</Select.Item>
						</Select.Content>
					</Select.Root>
				</fieldset>

				<!-- Feature Toggles with shadcn Switch -->
				<fieldset class="flex flex-wrap items-center gap-3.5 border-none p-0 m-0">
					<legend
						class="text-[0.65rem] font-semibold tracking-wider uppercase text-muted-foreground mb-1 w-full"
						>Features</legend
					>
					<div class="flex items-center gap-1.5">
						<Switch id="togIcons" size="sm" bind:checked={togIcons} />
						<Label for="togIcons" class="cursor-pointer text-xs">Icons</Label>
					</div>
					<div class="flex items-center gap-1.5">
						<Switch id="togToolbar" size="sm" bind:checked={togToolbar} />
						<Label for="togToolbar" class="cursor-pointer text-xs">Toolbar</Label>
					</div>
					<div class="flex items-center gap-1.5">
						<Switch id="togFrames" size="sm" bind:checked={togFrames} />
						<Label for="togFrames" class="cursor-pointer text-xs">Frame borders</Label>
					</div>
					<div class="flex items-center gap-1.5">
						<Switch id="togAdd" size="sm" bind:checked={togAdd} />
						<Label for="togAdd" class="cursor-pointer text-xs">+ buttons</Label>
					</div>
					<div class="flex items-center gap-1.5">
						<Switch id="togInset" size="sm" bind:checked={togInset} />
						<Label for="togInset" class="cursor-pointer text-xs">Nest inset</Label>
					</div>
				</fieldset>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Playground Area -->
	<div
		id="playground"
		data-style={stylePreset}
		data-icons={togIcons ? 'on' : 'off'}
		data-toolbar={togToolbar ? 'on' : 'off'}
		data-frames={togFrames ? 'on' : 'off'}
		data-add={togAdd ? 'on' : 'off'}
		data-inset={togInset ? 'on' : 'off'}
		style:--pad="{pad}px"
		style:--inset="{inset}px"
		style:--tab-gap="{tabGap}px"
		style:--tab-h="{tabH}px"
		style:--toolbar-h="{toolbarH}px"
		style:--accent-w="{accentW}px"
		style:--hl-pad="{pad}px"
		style:--hl-inset="{inset}px"
		style:--hl-tab-gap="{tabGap}px"
		style:--hl-tab-h="{tabH}px"
		style:--hl-toolbar-h="{toolbarH}px"
		style:--hl-accent-w="{accentW}px"
	>
		<!-- 2-Column Previews Grid -->
		<div class="grid">
			<Card.Root class="border-frame/40 bg-transparent shadow-none">
				<Card.Header class="p-0 pb-2">
					<Card.Title
						class="text-[0.7rem] font-semibold tracking-wider uppercase text-muted-foreground"
						>Preview A</Card.Title
					>
				</Card.Header>
				<Card.Content class="p-0">
					<div class="nest-root">
						<HorizonLayout
							bind:config={configA}
							views={viewsA_outer}
							onAddTab={(tg) => addTabToGroup(tg, 'outer-a', viewsA_outer)}
						/>
					</div>
				</Card.Content>
			</Card.Root>

			<Card.Root class="border-frame/40 bg-transparent shadow-none">
				<Card.Header class="p-0 pb-2">
					<Card.Title
						class="text-[0.7rem] font-semibold tracking-wider uppercase text-muted-foreground"
						>Preview B</Card.Title
					>
				</Card.Header>
				<Card.Content class="p-0">
					<div class="nest-root">
						<HorizonLayout
							bind:config={configB}
							views={viewsB_outer}
							onAddTab={(tg) => addTabToGroup(tg, 'outer-b', viewsB_outer)}
						/>
					</div>
				</Card.Content>
			</Card.Root>
		</div>

		<!-- Studio Mapping Section -->
		<section class="studio-wrap mt-6 pt-4 border-t border-frame/45" data-theme="studio">
			<h2 class="text-[0.7rem] font-semibold tracking-wider uppercase text-muted-foreground mb-2">
				Studio mapping
			</h2>
			<div class="nest-root studio-inner">
				<HorizonLayout
					bind:config={configStudio}
					views={viewsStudio_outer}
					onAddTab={(tg) => addTabToGroup(tg, 'studio-outer', viewsStudio_outer)}
				/>
			</div>
		</section>
	</div>

	<p class="note">
		Active tab bg = toolbar bg = frame fill (<code>--active-bg</code>). Nested level steps that
		token darker. Adopted from: <code>rug/group-inset-chrome-mock.html</code>
	</p>
</main>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		background: var(--hl-bg);
		color: var(--hl-fg);
		font-family:
			ui-sans-serif,
			system-ui,
			-apple-system,
			sans-serif;
	}

	.page-container {
		padding: 1.25rem 1.5rem 2.5rem;
		min-height: 100vh;
		box-sizing: border-box;
	}

	h1 {
		font-size: 1.2rem;
		font-weight: 650;
		margin: 0;
	}

	.lede {
		color: var(--hl-muted);
		font-size: 0.8rem;
		margin: 0;
		max-width: 48rem;
		line-height: 1.4;
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.25rem;
	}

	@media (max-width: 980px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}

	.nest-root {
		min-height: 200px;
	}

	.studio-inner {
		background: #1b1c1f;
		padding: var(--hl-pad);
		border-radius: 6px;
	}

	.note {
		margin-top: 1.5rem;
		font-size: 0.76rem;
		color: var(--hl-muted);
		max-width: 48rem;
		line-height: 1.45;
	}

	.note code {
		color: var(--hl-fg);
		font-size: 0.9em;
		background: color-mix(in srgb, var(--hl-panel) 60%, black);
		padding: 2px 5px;
		border-radius: 3px;
	}

	/* SVG icon helper */
	:global(.ico) {
		width: 12px;
		height: 12px;
		flex-shrink: 0;
		display: block;
	}
</style>
