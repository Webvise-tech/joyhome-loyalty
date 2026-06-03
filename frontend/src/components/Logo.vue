<script setup lang="ts">
import logoUrl from '../assets/Joy Home Transparent Logo.png'

withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  { size: 'md' },
)

const sizeMap = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
} as const
</script>

<template>
  <img
    :src="logoUrl"
    alt="JoyHome"
    class="object-contain"
    :class="sizeMap[size]"
  />
</template>
