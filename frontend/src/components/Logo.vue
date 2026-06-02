<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  { size: 'md' },
)

const sizeMap = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
  xl: 'text-3xl',
} as const
</script>

<template>
  <div class="flex items-center gap-2 text-fg">
    <span
      class="grid h-9 w-9 place-items-center bg-clover text-cream font-display font-light leading-none"
      :class="size === 'lg' ? 'h-11 w-11' : size === 'xl' ? 'h-14 w-14' : ''"
    >
      <span class="font-display text-xl leading-none">J</span>
    </span>
    <span class="font-display font-light tracking-tight" :class="sizeMap[size]">
      JoyHome
    </span>
  </div>
</template>
