<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import InputLabel from '../components/InputLabel.vue'
import InputError from '../components/InputError.vue'
import TextInput from '../components/TextInput.vue'
import PrimaryButton from '../components/PrimaryButton.vue'

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
    await auth.customerLogin(email.value.trim(), password.value)
    router.push({ name: 'customer.dashboard' })
  } catch (e: any) {
    error.value = e.message ?? 'Could not sign in.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
      Welcome back
    </p>
    <h1 class="mt-2 font-display text-3xl font-light leading-none tracking-tight text-fg sm:text-4xl">
      Sign in.
    </h1>

    <form class="mt-8 space-y-5" @submit.prevent="submit">
      <div>
        <InputLabel for="email" value="Email" />
        <TextInput
          id="email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
        />
      </div>

      <div>
        <InputLabel for="password" value="Password" />
        <TextInput
          id="password"
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
        />
      </div>

      <InputError :message="error" />

      <div class="flex items-center justify-end pt-2">
        <PrimaryButton :disabled="loading">
          {{ loading ? 'Signing in…' : 'Sign in' }}
          <span class="text-base transition-transform group-hover:translate-x-0.5">→</span>
        </PrimaryButton>
      </div>
    </form>

    <div class="mt-8 border-t border-surface-rim pt-6 text-center">
      <p class="font-mono text-[11px] tracking-[0.04em] text-fg-mute">
        New to JoyHome Rewards?
      </p>
      <RouterLink
        :to="{ name: 'register' }"
        class="mt-2 inline-block font-display text-lg italic text-clover hover:text-clover-deep"
      >
        Create an account →
      </RouterLink>
    </div>
  </div>
</template>
