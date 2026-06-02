<script setup lang="ts">
import { RouterView, RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function logout() {
  await auth.logout()
  router.push({ name: 'portal.login' })
}
</script>

<template>
  <div class="portal-shell">
    <header class="topbar">
      <RouterLink :to="{ name: 'portal.dashboard' }" class="brand">JoyHome Rewards</RouterLink>
      <button v-if="auth.isAuthenticated" class="logout" @click="logout">Sign out</button>
    </header>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.portal-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #fafafa;
}
.topbar {
  background: white;
  border-bottom: 1px solid #eee;
  padding: 0.75rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 10;
}
.brand {
  font-weight: 600;
  font-size: 1.05rem;
  color: #111;
  text-decoration: none;
}
.logout {
  background: transparent;
  color: #555;
  border: 1px solid #ddd;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}
.content {
  flex: 1;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
  padding: 1.25rem;
}
</style>
