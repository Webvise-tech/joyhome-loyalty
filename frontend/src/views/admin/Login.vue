<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import Logo from '../../components/Logo.vue'
import InputLabel from '../../components/InputLabel.vue'
import InputError from '../../components/InputError.vue'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

async function submit() {
  error.value = null
  loading.value = true
  try {
    await auth.adminLogin(email.value.trim(), password.value)
    router.push({ name: 'admin.dashboard' })
  } catch (e: any) {
    error.value = e.message ?? 'Could not sign in.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="relative min-h-screen overflow-hidden bg-surface px-4 py-12 sm:px-8">
    <!-- ambient flourishes -->
    <div class="pointer-events-none absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-clover/40 to-transparent" />
    <div class="pointer-events-none absolute -bottom-40 -right-40 h-[480px] w-[480px] rounded-full bg-clover/20 blur-3xl" />

    <div class="relative mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center">
      <div class="reveal space-y-10">
        <div class="reveal-child flex items-center gap-3">
          <Logo size="md" />
          <span class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
            · Admin
          </span>
        </div>

        <div class="reveal-child section-rule">
          <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
            Owner sign-in
          </p>
          <h1 class="mt-2 font-display text-4xl font-light leading-none tracking-tight text-fg sm:text-5xl">
            Sign in.
          </h1>
        </div>

        <form class="reveal-child space-y-6" @submit.prevent="submit">
          <div>
            <InputLabel for="admin-email" value="Email" />
            <input
              id="admin-email"
              v-model="email"
              type="email"
              required
              autocomplete="username"
              class="mt-1 w-full border-0 border-b border-fg/30 bg-transparent px-0 py-2 text-[15px] text-fg caret-clover transition-colors placeholder:text-fg-mute focus:border-clover focus:outline-none focus:ring-0"
            />
          </div>

          <div>
            <InputLabel for="admin-password" value="Password" />
            <input
              id="admin-password"
              v-model="password"
              type="password"
              required
              autocomplete="current-password"
              class="mt-1 w-full border-0 border-b border-fg/30 bg-transparent px-0 py-2 text-[15px] text-fg caret-clover transition-colors placeholder:text-fg-mute focus:border-clover focus:outline-none focus:ring-0"
            />
          </div>

          <InputError :message="error" />

          <button
            type="submit"
            :disabled="loading"
            class="group flex w-full items-center justify-between bg-clover px-5 py-3.5 text-cream transition-colors hover:bg-clover-deep focus:bg-clover-deep focus:outline-none focus:ring-2 focus:ring-clover/40 focus:ring-offset-2 focus:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span class="font-mono text-[12px] uppercase tracking-[0.2em]">
              {{ loading ? 'Signing in…' : 'Sign in' }}
            </span>
            <span class="text-lg transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        </form>

        <p class="reveal-child border-t border-surface-rim pt-5 font-display text-sm italic text-fg-mute">
          For shop owners only. Customers should sign in at the main JoyHome page.
        </p>
      </div>
    </div>
  </div>
</template>
