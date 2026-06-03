<script setup lang="ts">
import { ref } from 'vue'

const model = defineModel<string>({ default: '' })

defineProps<{
  placeholder?: string
  required?: boolean
  autocomplete?: string
  minlength?: number
  id?: string
}>()

const visible = ref(false)
</script>

<template>
  <div class="relative">
    <input
      :id="id"
      v-model="model"
      :type="visible ? 'text' : 'password'"
      :placeholder="placeholder"
      :required="required"
      :autocomplete="autocomplete"
      :minlength="minlength"
      class="w-full border-0 border-b border-fg/30 bg-transparent px-0 py-2 pr-9 text-[15px] text-fg caret-clover shadow-none transition-colors placeholder:text-fg-mute focus:border-clover focus:outline-none focus:ring-0"
    />
    <button
      type="button"
      class="absolute bottom-2 right-0 grid h-6 w-6 place-items-center text-fg-mute transition-colors hover:text-clover focus:text-clover focus:outline-none"
      :aria-label="visible ? 'Hide password' : 'Show password'"
      tabindex="-1"
      @click="visible = !visible"
    >
      <!-- Eye open -->
      <svg
        v-if="!visible"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M1.5 12s4-7 10.5-7 10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <!-- Eye closed -->
      <svg
        v-else
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 3l18 18" />
        <path d="M10.6 6.1A10.9 10.9 0 0 1 12 6c6.5 0 10.5 7 10.5 7a17.7 17.7 0 0 1-3.3 4.1" />
        <path d="M6.6 6.9A17.6 17.6 0 0 0 1.5 12s4 7 10.5 7c1.6 0 3-.3 4.3-.8" />
        <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      </svg>
    </button>
  </div>
</template>
