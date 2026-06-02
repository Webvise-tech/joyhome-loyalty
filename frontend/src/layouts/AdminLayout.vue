<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterLink, RouterView, useRouter, useRoute } from 'vue-router'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import Logo from '../components/Logo.vue'
import { useAuthStore } from '../stores/auth'
import { db } from '../firebase'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const mobileOpen = ref(false)

async function logout() {
  await auth.logout()
  router.push({ name: 'admin.login' })
}

// Live pending-approvals count (real-time via Firestore listener)
const pendingApprovals = ref(0)
let stopPendingListener: (() => void) | null = null

onMounted(() => {
  stopPendingListener = onSnapshot(
    query(collection(db, 'claims'), where('status', '==', 'PENDING')),
    (snap) => {
      pendingApprovals.value = snap.size
    },
    (err) => {
      console.warn('Pending approvals listener failed:', err)
    },
  )
})

onUnmounted(() => {
  if (stopPendingListener) stopPendingListener()
})

const sections = [
  {
    label: 'Manage',
    items: [
      { to: { name: 'admin.dashboard' }, label: 'Dashboard' },
      { to: { name: 'admin.customers' }, label: 'Customers' },
      { to: { name: 'admin.approvals' }, label: 'Pending approvals' },
      { to: { name: 'admin.redemptions' }, label: 'Redemptions' },
    ],
  },
  {
    label: 'Master data',
    items: [
      { to: { name: 'admin.catalogue' }, label: 'Catalogue' },
      { to: { name: 'admin.fraud' }, label: 'Fraud alerts' },
    ],
  },
] as const

function isActive(name: string): boolean {
  return route.name === name
}

function badgeFor(name: string): number | null {
  if (name === 'admin.approvals') return pendingApprovals.value > 0 ? pendingApprovals.value : null
  return null
}
</script>

<template>
  <div class="grain min-h-screen bg-surface text-fg">
    <header
      class="sticky top-0 z-30 border-b border-surface-rim bg-surface/95 backdrop-blur"
    >
      <div class="flex h-14 items-center justify-between px-4 sm:px-8">
        <div class="flex items-center gap-4">
          <button
            class="lg:hidden font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute hover:text-clover"
            @click="mobileOpen = !mobileOpen"
          >
            Menu
          </button>
          <Logo size="sm" />
          <span
            class="hidden sm:inline-block font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute"
          >
            · Admin
          </span>
        </div>
        <div class="flex items-center gap-5 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
          <span class="hidden sm:inline">{{ auth.user?.email }}</span>
          <button class="hover:text-clover transition-colors" @click="logout">
            Sign out
          </button>
        </div>
      </div>
    </header>

    <div class="flex">
      <aside
        class="fixed inset-y-0 left-0 top-14 z-20 w-60 -translate-x-full border-r border-surface-rim bg-surface px-4 py-6 transition-transform lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:translate-x-0"
        :class="mobileOpen ? 'translate-x-0' : ''"
      >
        <nav class="flex flex-col gap-9">
          <div v-for="section in sections" :key="section.label">
            <p class="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
              {{ section.label }}
            </p>
            <ul class="space-y-1.5">
              <li v-for="item in section.items" :key="item.label">
                <RouterLink
                  :to="item.to"
                  class="nav-underline inline-flex items-center gap-2 py-1 text-[15px] text-fg transition-colors hover:text-clover"
                  :class="isActive(item.to.name) ? 'is-active !text-clover' : ''"
                  @click="mobileOpen = false"
                >
                  {{ item.label }}
                  <span
                    v-if="badgeFor(item.to.name) !== null"
                    class="inline-flex min-w-[1.25rem] items-center justify-center bg-clover/15 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-clover"
                  >
                    {{ badgeFor(item.to.name) }}
                  </span>
                </RouterLink>
              </li>
            </ul>
          </div>
        </nav>
      </aside>

      <div
        v-if="mobileOpen"
        class="fixed inset-0 top-14 z-10 bg-overlay backdrop-blur-sm lg:hidden"
        @click="mobileOpen = false"
      />

      <main class="reveal min-w-0 flex-1 px-4 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
        <RouterView />
      </main>
    </div>
  </div>
</template>
