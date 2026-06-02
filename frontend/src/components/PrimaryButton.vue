<script setup lang="ts">
defineProps<{ type?: 'button' | 'submit'; disabled?: boolean }>()
</script>

<template>
  <button
    :type="type ?? 'submit'"
    :disabled="disabled"
    class="inline-flex items-center gap-2 border border-transparent bg-clover px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-cream transition-colors hover:bg-clover-deep focus:bg-clover-deep focus:outline-none focus:ring-2 focus:ring-clover/40 focus:ring-offset-2 focus:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60"
  >
    <slot />
  </button>
</template>
