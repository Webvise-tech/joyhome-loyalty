<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router'
import Logo from '../components/Logo.vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="grain min-h-screen bg-surface">
    <header
      class="sticky top-0 z-10 border-b border-surface-rim bg-surface/95 backdrop-blur"
    >
      <div class="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <RouterLink :to="{ name: 'customer.dashboard' }">
          <Logo size="sm" />
        </RouterLink>
        <nav v-if="auth.isAuthenticated" class="flex items-center gap-6 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
          <RouterLink
            :to="{ name: 'customer.dashboard' }"
            class="transition-colors hover:text-clover"
            active-class="!text-clover"
          >
            Dashboard
          </RouterLink>
          <RouterLink
            :to="{ name: 'customer.history' }"
            class="transition-colors hover:text-clover"
            active-class="!text-clover"
          >
            History
          </RouterLink>
          <button class="transition-colors hover:text-clover" @click="logout">
            Sign out
          </button>
        </nav>
      </div>
    </header>
    <main class="reveal mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <RouterView />
    </main>
  </div>
</template>
