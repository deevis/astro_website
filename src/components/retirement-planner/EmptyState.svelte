<script lang="ts">
  export let title: string;
  export let message: string;
</script>

<div
  class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/50 px-4 py-8 text-center"
>
  <p class="font-medium text-gray-800 dark:text-gray-200">{title}</p>
  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">{message}</p>
  {#if $$slots.default}
    <div class="mt-4">
      <slot />
    </div>
  {/if}
</div>
