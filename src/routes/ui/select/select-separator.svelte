<script lang="ts">
	import { Separator as SeparatorPrimitive } from 'bits-ui';
	import { cn } from '../utils.js';

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: {
		ref?: HTMLElement | null;
		class?: string;
		[key: string]: unknown;
	} = $props();
</script>

<SeparatorPrimitive.Root
	bind:ref
	class={cn('bg-muted -mx-1 my-1 h-px', className)}
	{...restProps}
/>
