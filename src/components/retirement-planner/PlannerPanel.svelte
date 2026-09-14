<script lang="ts">
  export let title: string;
  export let description = '';
  let className = '';
  export { className as class };
</script>

<section class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 shadow-sm {className}">
  <header class="border-b border-gray-100 dark:border-gray-800 px-5 py-4 sm:px-6">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
    {#if description}
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{description}</p>
    {/if}
    <slot name="actions" />
  </header>
  <div class="px-5 py-5 sm:px-6 space-y-5">
    <slot />
  </div>
</section>
