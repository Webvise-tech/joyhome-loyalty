<script setup lang="ts">
defineProps<{ message?: string | null }>()
</script>

<template>
  <p v-if="message" class="font-mono text-[11px] tracking-[0.04em] text-oxblood">
    {{ message }}
  </p>
</template>
