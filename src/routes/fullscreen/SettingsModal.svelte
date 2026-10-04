<script lang="ts">
	import type { ActionDef } from '$lib/actions/index.js';
	import { formatChord, getNormalizedModifier } from '$lib/shortcuts/index.js';
	import type { ShortcutChord } from '$lib/shortcuts/types.js';
	import { chordOverrides, persistChords, resetSettings, settings } from './demoState.svelte.ts';

	let {
		open,
		onClose,
		actions
	}: {
		open: boolean;
		onClose: () => void;
		actions: ActionDef[];
	} = $props();

	type ModalTab = 'keys' | 'layout' | 'appearance';
	let tab = $state<ModalTab>('keys');
	let recordingId = $state<string | null>(null);

	const CATEGORY_LABELS: Record<string, string> = {
		tab: 'Tabs',
		layout: 'Panes & split',
		system: 'System',
		navigation: 'Navigation',
		editor: 'Editor'
	};

	const categories = $derived(
		Array.from(new Set(actions.map((action) => action.category))) as ActionDef['category'][]
	);

	function chordFor(action: ActionDef): ShortcutChord | undefined {
		if (Object.prototype.hasOwnProperty.call(chordOverrides, action.id)) {
			return chordOverrides[action.id] ?? undefined;
		}
		return action.chord;
	}

	function isOverridden(id: string): boolean {
		return Object.prototype.hasOwnProperty.call(chordOverrides, id);
	}

	function resetChord(id: string) {
		delete chordOverrides[id];
		persistChords();
	}

	function unbindChord(id: string) {
		chordOverrides[id] = null;
		persistChords();
	}

	function normalizeKey(event: KeyboardEvent): string | null {
		const key = event.key;
		if (key === 'Control' || key === 'Meta' || key === 'Alt' || key === 'Shift') return null;
		if (key.length === 1) return key.toLowerCase();
		return key;
	}

	function handleRecordKey(event: KeyboardEvent) {
		if (!recordingId) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		if (event.key === 'Escape') {
			recordingId = null;
			return;
		}
		const key = normalizeKey(event);
		if (!key) return;
		const modifier = getNormalizedModifier(event);
		chordOverrides[recordingId] = modifier ? { modifier, key } : { key };
		persistChords();
		recordingId = null;
	}

	$effect(() => {
		if (!recordingId) return;
		window.addEventListener('keydown', handleRecordKey, { capture: true });
		return () => window.removeEventListener('keydown', handleRecordKey, { capture: true });
	});

	$effect(() => {
		if (!open) {
			recordingId = null;
			tab = 'keys';
		}
	});

	function handleBackdrop(event: MouseEvent) {
		if (event.target === event.currentTarget) onClose();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="settings-backdrop" onclick={handleBackdrop}>
		<div
			class="settings-modal"
			role="dialog"
			aria-modal="true"
			aria-label="Layout settings"
			tabindex={-1}
			onkeydown={(event) => event.key === 'Escape' && onClose()}
		>
			<header class="settings-modal__header">
				<h2>Settings</h2>
				<button type="button" class="settings-modal__close" aria-label="Close" onclick={onClose}>
					<svg
						viewBox="0 0 24 24"
						width="16"
						height="16"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						aria-hidden="true"
					>
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			</header>

			<nav class="settings-modal__tabs" aria-label="Settings sections">
				<button
					type="button"
					class="settings-tab"
					class:settings-tab--active={tab === 'keys'}
					onclick={() => (tab = 'keys')}>Keybindings</button
				>
				<button
					type="button"
					class="settings-tab"
					class:settings-tab--active={tab === 'layout'}
					onclick={() => (tab = 'layout')}>Layout</button
				>
				<button
					type="button"
					class="settings-tab"
					class:settings-tab--active={tab === 'appearance'}
					onclick={() => (tab = 'appearance')}>Appearance</button
				>
			</nav>

			<div class="settings-modal__body">
				{#if tab === 'keys'}
					<p class="settings-hint">
						Click a shortcut, then press the new combination. <kbd>Esc</kbd> cancels; use
						<em>Unbind</em> to disable.
					</p>
					{#each categories as category (category)}
						{@const list = actions.filter((action) => action.category === category)}
						{#if list.length}
							<h3 class="settings-group">{CATEGORY_LABELS[category] ?? category}</h3>
							<ul class="settings-keys">
								{#each list as action (action.id)}
									<li class="settings-key">
										<span class="settings-key__label">{action.label}</span>
										<span class="settings-key__controls">
											<button
												type="button"
												class="settings-key__chord"
												class:settings-key__chord--recording={recordingId === action.id}
												class:settings-key__chord--custom={isOverridden(action.id)}
												onclick={() => (recordingId = recordingId === action.id ? null : action.id)}
											>
												{#if recordingId === action.id}
													Press keys…
												{:else if chordFor(action)}
													{formatChord(chordFor(action)!)}
												{:else}
													Unbound
												{/if}
											</button>
											{#if isOverridden(action.id)}
												<button
													type="button"
													class="settings-key__reset"
													title="Reset to default"
													aria-label={`Reset ${action.label}`}
													onclick={() => resetChord(action.id)}
												>
													<svg
														viewBox="0 0 24 24"
														width="13"
														height="13"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														stroke-linecap="round"
														stroke-linejoin="round"
														aria-hidden="true"
													>
														<path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
														<path d="M3 3v5h5" />
													</svg>
												</button>
											{/if}
											{#if chordFor(action)}
												<button
													type="button"
													class="settings-key__reset"
													title="Unbind"
													aria-label={`Unbind ${action.label}`}
													onclick={() => unbindChord(action.id)}
												>
													<svg
														viewBox="0 0 24 24"
														width="13"
														height="13"
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
										</span>
									</li>
								{/each}
							</ul>
						{/if}
					{/each}
				{:else if tab === 'layout'}
					<div class="settings-grid">
						<label class="settings-field">
							<span>Min width ratio <output>{settings.minWidthRatio.toFixed(2)}</output></span>
							<input
								type="range"
								min="0.05"
								max="0.2"
								step="0.01"
								bind:value={settings.minWidthRatio}
							/>
						</label>
						<label class="settings-field">
							<span>Min height ratio <output>{settings.minHeightRatio.toFixed(2)}</output></span>
							<input
								type="range"
								min="0.05"
								max="0.3"
								step="0.01"
								bind:value={settings.minHeightRatio}
							/>
						</label>
						<label class="settings-field">
							<span>Max depth <output>{settings.maxDepth}</output></span>
							<input type="range" min="1" max="8" step="1" bind:value={settings.maxDepth} />
						</label>
					</div>
					<div class="settings-toggles">
						<label class="settings-toggle">
							<input type="checkbox" bind:checked={settings.disableResizeSplits} />
							<span>Disable resizing</span>
						</label>
						<label class="settings-toggle">
							<input type="checkbox" bind:checked={settings.disableDragAndDrop} />
							<span>Disable tab drag &amp; drop</span>
						</label>
						<label class="settings-toggle">
							<input type="checkbox" bind:checked={settings.hideTabBar} />
							<span>Hide tab bars</span>
						</label>
						<label class="settings-toggle">
							<input type="checkbox" bind:checked={settings.keepAlive} />
							<span>Keep tabs alive</span>
						</label>
						<label class="settings-toggle">
							<input type="checkbox" bind:checked={settings.tabCycleButtons} />
							<span>Tab cycle buttons</span>
						</label>
						<label class="settings-toggle">
							<input type="checkbox" bind:checked={settings.dimOtherPanes} />
							<span>Dim other panes on hover</span>
						</label>
					</div>
				{:else}
					<div class="settings-grid">
						<label class="settings-field">
							<span>Theme</span>
							<select bind:value={settings.theme}>
								<option value="dark">Dark</option>
								<option value="light">Light</option>
								<option value="studio">Studio</option>
							</select>
						</label>
						<label class="settings-field">
							<span>Surface</span>
							<select bind:value={settings.surface}>
								<option value="flush">Flush</option>
								<option value="card">Rounded card</option>
								<option value="inset">Inset well</option>
							</select>
						</label>
						<label class="settings-field">
							<span>Motion</span>
							<select bind:value={settings.motion}>
								<option value="full">Full</option>
								<option value="reduced">Reduced</option>
								<option value="none">None</option>
							</select>
						</label>
						<label class="settings-field">
							<span>Tab style</span>
							<select bind:value={settings.style}>
								<option value="accent">Strong accent</option>
								<option value="thin">Thin accent</option>
								<option value="border">Border only</option>
								<option value="soft">Soft fill</option>
							</select>
						</label>
						<label class="settings-field">
							<span>Accent</span>
							<input type="color" bind:value={settings.accent} />
						</label>
						<label class="settings-field">
							<span>Padding <output>{settings.pad}px</output></span>
							<input type="range" min="0" max="16" step="1" bind:value={settings.pad} />
						</label>
						<label class="settings-field">
							<span>Nest inset <output>{settings.inset}px</output></span>
							<input type="range" min="0" max="24" step="1" bind:value={settings.inset} />
						</label>
						<label class="settings-field">
							<span>Tab gap <output>{settings.tabGap}px</output></span>
							<input type="range" min="0" max="10" step="1" bind:value={settings.tabGap} />
						</label>
						<label class="settings-field">
							<span>Tab height <output>{settings.tabH}px</output></span>
							<input type="range" min="22" max="36" step="1" bind:value={settings.tabH} />
						</label>
						<label class="settings-field">
							<span>Toolbar height <output>{settings.toolbarH}px</output></span>
							<input type="range" min="22" max="36" step="1" bind:value={settings.toolbarH} />
						</label>
					</div>
					<button type="button" class="settings-reset-all" onclick={resetSettings}>
						Reset settings to defaults
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.settings-backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgb(0 0 0 / 0.55);
		backdrop-filter: blur(2px);
		padding: 1.5rem;
	}

	.settings-modal {
		width: min(640px, 100%);
		max-height: min(80vh, 720px);
		display: flex;
		flex-direction: column;
		background: var(--hl-panel, #2f353b);
		color: var(--hl-fg, #e6e9ec);
		border: 1px solid var(--hl-frame, #5a6570);
		border-radius: 10px;
		box-shadow: 0 24px 60px rgb(0 0 0 / 0.45);
		overflow: hidden;
		animation: settings-modal-in var(--hl-motion-dur, 150ms) var(--hl-motion-ease, ease);
	}

	@keyframes settings-modal-in {
		from {
			opacity: 0;
			transform: translateY(8px) scale(0.985);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.settings-modal__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid color-mix(in srgb, var(--hl-frame, #5a6570) 60%, transparent);
	}

	.settings-modal__header h2 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.settings-modal__close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.6rem;
		height: 1.6rem;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--hl-muted, #8b949e);
		cursor: pointer;
	}

	.settings-modal__close:hover {
		background: color-mix(in srgb, var(--hl-fg, #e6e9ec) 10%, transparent);
		color: var(--hl-fg, #e6e9ec);
	}

	.settings-modal__tabs {
		display: flex;
		gap: 0.25rem;
		padding: 0.5rem 0.75rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--hl-frame, #5a6570) 60%, transparent);
	}

	.settings-tab {
		appearance: none;
		border: none;
		background: transparent;
		color: var(--hl-muted, #8b949e);
		font: inherit;
		font-size: 0.78rem;
		padding: 0.4rem 0.6rem;
		border-radius: 6px 6px 0 0;
		cursor: pointer;
		border-bottom: 2px solid transparent;
	}

	.settings-tab:hover {
		color: var(--hl-fg, #e6e9ec);
	}

	.settings-tab--active {
		color: var(--hl-fg, #e6e9ec);
		border-bottom-color: var(--hl-local-accent, #3db8ff);
	}

	.settings-modal__body {
		padding: 0.85rem 1rem 1.1rem;
		overflow-y: auto;
	}

	.settings-hint {
		margin: 0 0 0.75rem;
		font-size: 0.74rem;
		color: var(--hl-muted, #8b949e);
		line-height: 1.45;
	}

	.settings-group {
		margin: 0.9rem 0 0.35rem;
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--hl-muted, #8b949e);
	}

	.settings-keys {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.settings-key {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.3rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--hl-frame, #5a6570) 30%, transparent);
	}

	.settings-key__label {
		font-size: 0.78rem;
	}

	.settings-key__controls {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.settings-key__chord {
		appearance: none;
		min-width: 6rem;
		text-align: center;
		font: inherit;
		font-size: 0.72rem;
		color: var(--hl-fg, #e6e9ec);
		background: color-mix(in srgb, var(--hl-bg, #25292e) 70%, transparent);
		border: 1px solid var(--hl-frame, #5a6570);
		border-radius: 5px;
		padding: 0.2rem 0.5rem;
		cursor: pointer;
	}

	.settings-key__chord--custom {
		border-color: var(--hl-local-accent, #3db8ff);
	}

	.settings-key__chord--recording {
		border-color: var(--hl-local-accent, #3db8ff);
		color: var(--hl-local-accent, #3db8ff);
	}

	.settings-key__reset {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.4rem;
		height: 1.4rem;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--hl-muted, #8b949e);
		cursor: pointer;
	}

	.settings-key__reset:hover {
		color: var(--hl-fg, #e6e9ec);
		background: color-mix(in srgb, var(--hl-fg, #e6e9ec) 10%, transparent);
	}

	.settings-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.75rem 1rem;
	}

	.settings-field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.72rem;
		color: var(--hl-muted, #8b949e);
	}

	.settings-field > span {
		display: flex;
		justify-content: space-between;
	}

	.settings-field output {
		color: var(--hl-fg, #e6e9ec);
		font-variant-numeric: tabular-nums;
	}

	.settings-field select,
	.settings-field input[type='color'] {
		background: var(--hl-bg, #25292e);
		color: var(--hl-fg, #e6e9ec);
		border: 1px solid var(--hl-frame, #5a6570);
		border-radius: 5px;
		padding: 0.25rem 0.4rem;
		font: inherit;
		font-size: 0.75rem;
	}

	.settings-field input[type='color'] {
		height: 1.85rem;
		padding: 0.1rem;
	}

	.settings-field input[type='range'] {
		accent-color: var(--hl-local-accent, #3db8ff);
	}

	.settings-toggles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.45rem 1rem;
		margin-top: 1rem;
	}

	.settings-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.76rem;
		color: var(--hl-fg, #e6e9ec);
		cursor: pointer;
	}

	.settings-toggle input {
		accent-color: var(--hl-local-accent, #3db8ff);
	}

	.settings-reset-all {
		appearance: none;
		margin-top: 1.25rem;
		font: inherit;
		font-size: 0.75rem;
		color: var(--hl-fg, #e6e9ec);
		background: color-mix(in srgb, var(--hl-bg, #25292e) 70%, transparent);
		border: 1px solid var(--hl-frame, #5a6570);
		border-radius: 6px;
		padding: 0.35rem 0.7rem;
		cursor: pointer;
	}

	.settings-reset-all:hover {
		border-color: var(--hl-local-accent, #3db8ff);
	}

	kbd {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.85em;
		padding: 1px 4px;
		border: 1px solid var(--hl-frame, #5a6570);
		border-radius: 4px;
	}
</style>
