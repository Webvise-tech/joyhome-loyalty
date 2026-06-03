<script setup lang="ts">
import { computed } from 'vue'
import { PAGE_SIZE_OPTIONS, type PageSize } from '../composables/usePagination'

const props = defineProps<{
  page: number
  pageSize: PageSize
  totalPages: number
  total: number
  rangeStart: number
  rangeEnd: number
}>()

const emit = defineEmits<{
  (e: 'update:page', value: number): void
  (e: 'update:pageSize', value: PageSize): void
}>()

function go(p: number) {
  if (p < 1 || p > props.totalPages || p === props.page) return
  emit('update:page', p)
}

function setSize(e: Event) {
  const v = Number((e.target as HTMLSelectElement).value) as PageSize
  emit('update:pageSize', v)
}

// Build a compact list of page numbers with ellipses, e.g. 1 … 4 5 [6] 7 8 … 12
const pageList = computed<(number | '…')[]>(() => {
  const t = props.totalPages
  const cur = props.page
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)

  const out: (number | '…')[] = [1]
  const left = Math.max(2, cur - 1)
  const right = Math.min(t - 1, cur + 1)
  if (left > 2) out.push('…')
  for (let i = left; i <= right; i++) out.push(i)
  if (right < t - 1) out.push('…')
  out.push(t)
  return out
})
</script>

<template>
  <div
    v-if="total > 0"
    class="mt-4 flex flex-col gap-3 border-t border-surface-rim pt-4 sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="flex items-center gap-3">
      <label class="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">
        Per page
      </label>
      <select
        :value="pageSize"
        class="border border-surface-rim bg-transparent px-2 py-1 font-mono text-[12px] text-fg focus:border-clover focus:outline-none focus:ring-0"
        @change="setSize"
      >
        <option v-for="opt in PAGE_SIZE_OPTIONS" :key="opt" :value="opt">
          {{ opt }}
        </option>
      </select>
      <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">
        {{ rangeStart }}–{{ rangeEnd }} of {{ total }}
      </span>
    </div>

    <nav v-if="totalPages > 1" class="flex items-center gap-1 font-mono text-[11px]">
      <button
        type="button"
        class="px-2 py-1 text-fg-soft transition-colors hover:text-clover disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-fg-soft"
        :disabled="page <= 1"
        aria-label="Previous page"
        @click="go(page - 1)"
      >
        ←
      </button>

      <template v-for="(p, i) in pageList" :key="i">
        <span
          v-if="p === '…'"
          class="px-2 py-1 text-fg-mute select-none"
        >
          …
        </span>
        <button
          v-else
          type="button"
          class="min-w-[28px] px-2 py-1 transition-colors"
          :class="
            p === page
              ? 'bg-clover text-cream'
              : 'text-fg-soft hover:text-clover'
          "
          @click="go(p as number)"
        >
          {{ p }}
        </button>
      </template>

      <button
        type="button"
        class="px-2 py-1 text-fg-soft transition-colors hover:text-clover disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-fg-soft"
        :disabled="page >= totalPages"
        aria-label="Next page"
        @click="go(page + 1)"
      >
        →
      </button>
    </nav>
  </div>
</template>
