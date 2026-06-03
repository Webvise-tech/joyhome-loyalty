<script setup lang="ts">
import { RouterView } from 'vue-router'
import Dialog from './components/Dialog.vue'
import Toaster from './components/Toaster.vue'
</script>

<template>
  <RouterView />
  <Dialog />
  <Toaster />
</template>
