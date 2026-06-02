<script setup lang="ts">
defineProps<{ type?: 'button' | 'submit'; disabled?: boolean }>()
</script>

<template>
  <button
    :type="type ?? 'button'"
    :disabled="disabled"
    class="inline-flex items-center border border-fg/20 bg-transparent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-soft transition-colors hover:border-clover hover:text-clover focus:border-clover focus:text-clover focus:outline-none focus:ring-2 focus:ring-clover/40 focus:ring-offset-2 focus:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60"
  >
    <slot />
  </button>
</template>
