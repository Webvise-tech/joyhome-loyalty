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

const firstName = ref('')
const lastName = ref('')
const email = ref('')
const password = ref('')
const phone = ref('+961')
const dateOfBirth = ref('')

const error = ref<string | null>(null)
const loading = ref(false)

function friendlyError(e: any): string {
  const code = e?.code as string | undefined
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists.'
  if (code === 'auth/invalid-email') return 'That email address is not valid.'
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters.'
  return e?.message ?? 'Could not create account.'
}

async function submit() {
  error.value = null
  loading.value = true
  try {
    await auth.customerRegister({
      first_name: firstName.value.trim(),
      last_name: lastName.value.trim(),
      email: email.value.trim(),
      password: password.value,
      phone: phone.value.trim(),
      date_of_birth: dateOfBirth.value,
    })
    router.push({ name: 'customer.dashboard' })
  } catch (e: any) {
    error.value = friendlyError(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
      Join JoyHome
    </p>
    <h1 class="mt-2 font-display text-3xl font-light leading-none tracking-tight text-fg sm:text-4xl">
      Create account.
    </h1>
    <p class="mt-3 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
      Earn points on every purchase — online and in-store.
    </p>

    <form class="mt-7 space-y-5" @submit.prevent="submit">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <InputLabel for="first" value="First name" />
          <TextInput id="first" v-model="firstName" required autocomplete="given-name" />
        </div>
        <div>
          <InputLabel for="last" value="Last name" />
          <TextInput id="last" v-model="lastName" required autocomplete="family-name" />
        </div>
      </div>

      <div>
        <InputLabel for="email" value="Email" />
        <TextInput id="email" v-model="email" type="email" required autocomplete="email" />
      </div>

      <div>
        <InputLabel for="password" value="Password" />
        <TextInput
          id="password"
          v-model="password"
          type="password"
          required
          :minlength="8"
          autocomplete="new-password"
        />
        <p class="mt-1 font-mono text-[10px] tracking-[0.04em] text-fg-mute">At least 8 characters.</p>
      </div>

      <div>
        <InputLabel for="phone" value="Phone" />
        <TextInput
          id="phone"
          v-model="phone"
          type="tel"
          required
          autocomplete="tel"
          placeholder="+961..."
        />
      </div>

      <div>
        <InputLabel for="dob" value="Date of birth" />
        <TextInput id="dob" v-model="dateOfBirth" type="date" required />
      </div>

      <InputError :message="error" />

      <div class="flex items-center justify-end pt-2">
        <PrimaryButton :disabled="loading">
          {{ loading ? 'Creating…' : 'Create account' }}
          <span class="text-base">→</span>
        </PrimaryButton>
      </div>
    </form>

    <div class="mt-8 border-t border-surface-rim pt-6 text-center">
      <p class="font-mono text-[11px] tracking-[0.04em] text-fg-mute">
        Already a member?
      </p>
      <RouterLink
        :to="{ name: 'login' }"
        class="mt-2 inline-block font-display text-lg italic text-clover hover:text-clover-deep"
      >
        Sign in →
      </RouterLink>
    </div>
  </div>
</template>
