<script setup lang="ts">
defineProps<{ value?: string; for?: string }>()
</script>

<template>
  <label
    :for="$props.for"
    class="block font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute"
  >
    <slot>{{ value }}</slot>
  </label>
</template>
