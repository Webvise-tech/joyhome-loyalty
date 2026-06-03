<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useDialog } from '../composables/useDialog'

const { state, close } = useDialog()
const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

watch(
  () => state.open,
  async (open) => {
    if (!open) return
    inputValue.value = state.type === 'prompt' ? state.promptInitial : ''
    await nextTick()
    if (state.type === 'prompt') inputRef.value?.focus()
  },
)

function onConfirm() {
  if (state.type === 'confirm') close(true)
  else if (state.type === 'prompt') close(inputValue.value)
  else close(undefined)
}

function onCancel() {
  if (state.type === 'confirm') close(false)
  else if (state.type === 'prompt') close(null)
  else close(undefined)
}

function onBackdropClick() {
  // Alert: clicking outside dismisses (same as OK)
  if (state.type === 'alert') close(undefined)
  else onCancel()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    onCancel()
  } else if (e.key === 'Enter' && state.type !== 'prompt') {
    e.preventDefault()
    onConfirm()
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state.open"
      class="fixed inset-0 z-[100] overflow-y-auto bg-overlay/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      @click.self="onBackdropClick"
      @keydown="onKeydown"
      tabindex="-1"
    >
      <div
        class="flex min-h-full items-start justify-center px-4 py-8 sm:items-center"
        @click.self="onBackdropClick"
      >
      <div class="reveal w-full max-w-md border border-surface-rim bg-surface-elev shadow-pop">
        <header v-if="state.title" class="border-b border-surface-rim px-6 py-5">
          <h2 class="font-display text-2xl font-light leading-tight text-fg">
            {{ state.title }}
          </h2>
        </header>

        <div class="space-y-4 px-6 py-6">
          <p class="text-[15px] leading-relaxed text-fg-soft whitespace-pre-line">{{ state.message }}</p>

          <input
            v-if="state.type === 'prompt'"
            ref="inputRef"
            v-model="inputValue"
            :placeholder="state.promptPlaceholder"
            class="w-full border-0 border-b border-fg/30 bg-transparent px-0 py-2 text-[15px] text-fg focus:border-clover focus:outline-none focus:ring-0"
            @keydown.enter.prevent="onConfirm"
            @keydown.escape.prevent="onCancel"
          />
        </div>

        <div class="flex items-center justify-end gap-3 border-t border-surface-rim px-6 py-5">
          <button
            v-if="state.type !== 'alert'"
            type="button"
            class="inline-flex items-center border border-fg/20 bg-transparent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-soft transition-colors hover:border-clover hover:text-clover focus:outline-none focus:ring-2 focus:ring-clover/40"
            @click="onCancel"
          >
            {{ state.cancelLabel ?? 'Cancel' }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 border border-transparent px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-cream transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface"
            :class="
              state.tone === 'danger'
                ? 'bg-oxblood hover:opacity-90 focus:ring-oxblood/40'
                : 'bg-clover hover:bg-clover-deep focus:ring-clover/40'
            "
            @click="onConfirm"
          >
            {{ state.confirmLabel ?? (state.type === 'alert' ? 'OK' : 'Confirm') }}
            <span class="text-base">→</span>
          </button>
        </div>
      </div>
      </div>
    </div>
  </Teleport>
</template>
