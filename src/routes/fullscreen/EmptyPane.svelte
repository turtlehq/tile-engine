<script lang="ts">
	import { onMount } from 'svelte';

	// Empty pane presenting pane-creation actions (Editor, Terminal, Note, Group).
	// Responsive across all container sizes with container queries.

	interface Action {
		id: string;
		label: string;
		key: string;
		onClick: () => void;
	}

	let {
		onOpenNote,
		onOpenGroup,
		onOpenTerminal,
		onOpenEditor
	}: {
		onOpenNote?: () => void;
		onOpenGroup?: () => void;
		onOpenTerminal?: () => void;
		onOpenEditor?: () => void;
	} = $props();

	let rootEl = $state<HTMLDivElement | null>(null);

	const actions = $derived(
		[
			onOpenEditor ? { id: 'editor', label: 'Editor', key: 'e', onClick: onOpenEditor } : null,
			onOpenTerminal
				? { id: 'terminal', label: 'Terminal', key: 't', onClick: onOpenTerminal }
				: null,
			onOpenNote ? { id: 'note', label: 'Note', key: 'n', onClick: onOpenNote } : null,
			onOpenGroup ? { id: 'group', label: 'Group', key: 'g', onClick: onOpenGroup } : null
		].filter((action): action is Action => Boolean(action))
	);

	function handleKeydown(event: KeyboardEvent) {
		if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
		const key = event.key.toLowerCase();
		const action = actions.find((entry) => entry.key === key);
		if (!action) return;
		event.preventDefault();
		event.stopPropagation();
		action.onClick();
	}

	onMount(() => {
		rootEl?.focus({ preventScroll: true });
	});
</script>

<div
	bind:this={rootEl}
	class="empty-pane"
	tabindex="0"
	role="menu"
	aria-label="Empty pane actions"
	onkeydown={handleKeydown}
>
	<div class="empty-pane__content">
		<ul class="empty-pane__actions">
			{#each actions as action (action.id)}
				<li>
					<button type="button" class="empty-pane__action" onclick={action.onClick}>
						<svg class="empty-pane__action-icon" viewBox="0 0 24 24" aria-hidden="true">
							{#if action.id === 'editor'}
								<path d="m8 6-6 6 6 6M16 6l6 6-6 6" />
							{:else if action.id === 'terminal'}
								<rect x="3" y="4" width="18" height="16" rx="2" />
								<path d="m5 8 5 4-5 4M12 16h7" />
							{:else if action.id === 'note'}
								<path d="M14 3v4a1 1 0 0 0 1 1h4" />
								<path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
								<path d="M9 13h6M9 17h4" />
							{:else if action.id === 'group'}
								<path d="m12 2 9 5-9 5-9-5 9-5Z" />
								<path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
							{/if}
						</svg>
						<span class="empty-pane__action-label">{action.label}</span>
						<kbd class="empty-pane__kbd">{action.key.toUpperCase()}</kbd>
					</button>
				</li>
			{/each}
		</ul>

		<p class="empty-pane__hint">
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<rect x="3" y="3" width="18" height="18" rx="2" />
				<path d="M9 3v18" />
			</svg>
			<span>Or open a file from the Explorer on the left.</span>
		</p>
	</div>
</div>

<style>
	.empty-pane {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		overflow: auto;
		padding: 0.75rem;
		box-sizing: border-box;
		background: transparent;
		color: var(--hl-fg);
		container-type: inline-size;
		outline: none;
	}

	.empty-pane:focus-visible {
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hl-local-accent) 45%, transparent);
	}

	.empty-pane__content {
		margin: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		max-width: 24rem;
		box-sizing: border-box;
	}

	.empty-pane__actions {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.375rem;
		width: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
		box-sizing: border-box;
	}

	.empty-pane__actions li {
		min-width: 0;
	}

	.empty-pane__action {
		display: flex;
		align-items: center;
		width: 100%;
		gap: 0.625rem;
		padding: 0.4375rem 0.625rem;
		border: 1px solid color-mix(in srgb, var(--hl-frame) 60%, transparent);
		border-radius: var(--hl-radius);
		background: color-mix(in srgb, var(--hl-panel) 78%, var(--hl-bg));
		color: color-mix(in srgb, var(--hl-fg) 85%, var(--hl-muted));
		font: inherit;
		font-size: 0.8125rem;
		font-weight: 400;
		line-height: 1.35;
		text-align: left;
		cursor: pointer;
		box-sizing: border-box;
		transition:
			color 100ms ease,
			background-color 100ms ease,
			border-color 100ms ease;
	}

	.empty-pane__action:hover {
		color: var(--hl-fg);
		background: color-mix(in srgb, var(--hl-panel) 92%, var(--hl-bg));
		border-color: color-mix(in srgb, var(--hl-frame) 85%, transparent);
	}

	.empty-pane__action:focus-visible {
		outline: 1.5px solid var(--hl-local-accent);
		outline-offset: 1px;
	}

	.empty-pane__action-icon {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
		opacity: 0.75;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.empty-pane__action-label {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.empty-pane__kbd {
		margin-left: auto;
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.25rem;
		height: 1.25rem;
		padding: 0 0.25rem;
		border-radius: calc(var(--hl-radius) - 1px);
		background: color-mix(in srgb, var(--hl-fg) 10%, transparent);
		color: var(--hl-muted);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.6875rem;
		text-transform: uppercase;
		pointer-events: none;
		user-select: none;
	}

	.empty-pane__hint {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 0.375rem;
		margin: 0;
		font-size: 0.72rem;
		color: var(--hl-muted);
	}

	.empty-pane__hint svg {
		width: 0.8125rem;
		height: 0.8125rem;
		flex-shrink: 0;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* Responsive 2x2 grid for medium widths (20rem to 36rem / 320px to 576px) */
	@container (min-width: 20rem) {
		.empty-pane__content {
			max-width: 28rem;
		}

		.empty-pane__actions {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.5rem;
		}
	}

	/* Responsive 4-column row for wide containers (>= 36rem / ~576px) */
	@container (min-width: 36rem) {
		.empty-pane__content {
			max-width: 44rem;
		}

		.empty-pane__actions {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 0.45rem;
		}
	}

	/* Compact mode when container width is very narrow (< 13rem / ~208px) */
	@container (max-width: 13rem) {
		.empty-pane {
			padding: 0.375rem;
		}

		.empty-pane__content {
			gap: 0.375rem;
		}

		.empty-pane__action {
			padding: 0.3125rem 0.4375rem;
			gap: 0.375rem;
			font-size: 0.75rem;
		}

		.empty-pane__kbd {
			display: none;
		}

		.empty-pane__hint {
			display: none;
		}
	}
</style>
