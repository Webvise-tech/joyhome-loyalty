<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getAdminStats, type AdminStats } from '../../api/loyalty'

const stats = ref<AdminStats | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const cards = computed(() => [
  { label: 'Total customers', value: stats.value?.total_customers ?? null, tone: 'text-fg' },
  { label: 'Pending approvals', value: stats.value?.pending_approvals ?? null, tone: 'text-brass' },
  { label: 'Points outstanding', value: stats.value?.points_outstanding ?? null, tone: 'text-clover' },
  { label: 'Fraud alerts', value: stats.value?.fraud_alerts ?? null, tone: 'text-oxblood' },
])

function fmtValue(v: number | null): string {
  if (v === null) return '—'
  return v.toLocaleString()
}

async function load() {
  loading.value = true
  error.value = null
  try {
    stats.value = await getAdminStats()
  } catch (e: any) {
    error.value = e?.message ?? 'Failed to load dashboard stats.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-12">
    <header
      class="reveal-child section-rule flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Overview</p>
        <h1 class="mt-2 font-display text-4xl font-light leading-none tracking-tight text-fg sm:text-5xl">
          Dashboard.
        </h1>
        <p class="mt-3 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
          Quick read on activity across the loyalty program.
        </p>
      </div>
      <button
        class="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-mute hover:text-clover"
        @click="load"
      >
        Refresh
      </button>
    </header>

    <p v-if="error" class="reveal-child font-mono text-[11px] tracking-[0.04em] text-oxblood">
      {{ error }}
    </p>

    <section class="reveal-child grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div
        v-for="c in cards"
        :key="c.label"
        class="border border-surface-rim bg-surface-elev p-5"
      >
        <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">{{ c.label }}</p>
        <p class="mt-3 font-display text-4xl font-light leading-none tabular-nums" :class="c.tone">
          {{ loading && c.value === null ? '…' : fmtValue(c.value) }}
        </p>
      </div>
    </section>
  </div>
</template>
