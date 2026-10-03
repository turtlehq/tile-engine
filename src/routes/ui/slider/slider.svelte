<script lang="ts">
	import { Slider as SliderPrimitive } from 'bits-ui';
	import { cn } from '../utils.js';

	let {
		ref = $bindable(null),
		value = $bindable(0),
		min = 0,
		max = 100,
		step = 1,
		orientation = 'horizontal',
		class: className,
		...restProps
	}: {
		ref?: HTMLElement | null;
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		orientation?: 'horizontal' | 'vertical';
		class?: string;
		[key: string]: unknown;
	} = $props();
</script>

<SliderPrimitive.Root
	type="single"
	bind:ref
	bind:value
	{min}
	{max}
	{step}
	{orientation}
	data-slot="slider"
	class={cn(
		'relative flex w-full touch-none select-none items-center data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col data-disabled:opacity-50',
		className
	)}
	{...restProps}
>
	{#snippet children({ thumbItems })}
		<span
			data-slot="slider-track"
			data-orientation={orientation}
			class="bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
		>
			<SliderPrimitive.Range
				data-slot="slider-range"
				class="bg-primary absolute select-none data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
			/>
		</span>
		{#each thumbItems as thumb (thumb.index)}
			<SliderPrimitive.Thumb
				data-slot="slider-thumb"
				index={thumb.index}
				class="border-ring ring-ring/50 relative block size-3 shrink-0 select-none rounded-full border bg-white transition-[color,box-shadow] after:absolute after:-inset-2 hover:ring-3 focus-visible:outline-hidden focus-visible:ring-3 active:ring-3 disabled:pointer-events-none disabled:opacity-50"
			/>
		{/each}
	{/snippet}
</SliderPrimitive.Root>
