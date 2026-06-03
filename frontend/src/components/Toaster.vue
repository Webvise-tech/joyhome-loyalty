<script setup lang="ts">
import { useToast, type ToastTone } from '../composables/useToast'

const { state, dismiss } = useToast()

const toneClasses: Record<ToastTone, string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  error: 'bg-rose-50 border-rose-200 text-rose-900',
  info: 'bg-sky-50 border-sky-200 text-sky-900',
}

const iconFor: Record<ToastTone, string> = {
  success: '✓',
  error: '!',
  info: 'i',
}

const iconBgFor: Record<ToastTone, string> = {
  success: 'bg-emerald-500 text-white',
  error: 'bg-rose-500 text-white',
  info: 'bg-sky-500 text-white',
}
</script>

<template>
  <div
    class="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
    aria-live="polite"
    role="region"
  >
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="translate-y-2 opacity-0"
    >
      <div
        v-for="t in state.items"
        :key="t.id"
        :class="[
          'pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-md',
          toneClasses[t.tone],
        ]"
        role="status"
      >
        <span
          :class="[
            'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            iconBgFor[t.tone],
          ]"
          aria-hidden="true"
        >
          {{ iconFor[t.tone] }}
        </span>

        <div class="flex-1 text-sm leading-snug">
          <p v-if="t.title" class="font-semibold">{{ t.title }}</p>
          <p :class="t.title ? 'mt-0.5' : ''">{{ t.message }}</p>
        </div>

        <button
          type="button"
          class="-mr-1 -mt-1 rounded p-1 text-current opacity-60 transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current/40"
          aria-label="Dismiss"
          @click="dismiss(t.id)"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
