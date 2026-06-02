<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import Logo from '../components/Logo.vue'
</script>

<template>
  <div class="flex min-h-screen flex-col items-center bg-surface px-4 pt-10 sm:justify-center sm:pt-0">
    <RouterLink to="/" class="mb-8">
      <Logo size="lg" />
    </RouterLink>
    <div
      class="reveal w-full overflow-hidden border border-surface-rim bg-surface-elev px-7 py-8 shadow-pop sm:max-w-md"
    >
      <RouterView />
    </div>
  </div>
</template>
