<script lang="ts">
	// A minimal plain-text note: title input + a basic textarea (no rich text).
	// Value is owned by the host so state survives tab switches with keepAlive off.

	let {
		value = '',
		title = 'Untitled note',
		placeholder = 'Write a note…',
		onTitleChange,
		onValueChange
	}: {
		value?: string;
		title?: string;
		placeholder?: string;
		onTitleChange?: (title: string) => void;
		onValueChange?: (value: string) => void;
	} = $props();

	const words = $derived(value.trim() ? value.trim().split(/\s+/).length : 0);
	const chars = $derived(value.length);
</script>

<div class="note">
	<input
		class="note__title"
		value={title}
		oninput={(event) => onTitleChange?.(event.currentTarget.value)}
		aria-label="Note title"
		placeholder="Untitled note"
	/>
	<textarea
		class="note__body"
		{value}
		oninput={(event) => onValueChange?.(event.currentTarget.value)}
		{placeholder}
		spellcheck="true"
	></textarea>
	<footer class="note__status">
		<span>{words} words</span>
		<span class="note__dot">·</span>
		<span>{chars} chars</span>
	</footer>
</div>

<style>
	.note {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		min-height: 0;
		background: var(--hl-bg);
		color: var(--hl-fg);
	}

	.note__title {
		flex: 0 0 auto;
		width: 100%;
		box-sizing: border-box;
		padding: 0.55rem 0.75rem;
		border: none;
		border-bottom: 1px solid color-mix(in srgb, var(--hl-frame) 55%, transparent);
		background: transparent;
		color: var(--hl-fg);
		font: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		outline: none;
	}

	.note__title::placeholder {
		color: var(--hl-muted);
	}

	.note__body {
		flex: 1 1 auto;
		min-height: 0;
		width: 100%;
		box-sizing: border-box;
		padding: 0.75rem;
		border: none;
		background: transparent;
		color: var(--hl-fg);
		font: inherit;
		font-size: 0.8125rem;
		line-height: 1.6;
		resize: none;
		outline: none;
	}

	.note__body::placeholder {
		color: var(--hl-muted);
	}

	.note__status {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem 0.75rem;
		border-top: 1px solid color-mix(in srgb, var(--hl-frame) 45%, transparent);
		color: var(--hl-muted);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.6875rem;
	}

	.note__dot {
		opacity: 0.5;
	}
</style>
