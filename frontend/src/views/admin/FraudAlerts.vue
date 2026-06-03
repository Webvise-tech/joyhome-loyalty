<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listRejectedClaims, type Claim } from '../../api/loyalty'
import { usePagination } from '../../composables/usePagination'
import Pagination from '../../components/Pagination.vue'

const claims = ref<Claim[]>([])
const claimsPg = usePagination(claims)
const loading = ref(false)
const error = ref<string | null>(null)

function fmtDateTime(ts: any): string {
  if (!ts || !ts.toDate) return '—'
  return ts.toDate().toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function load() {
  loading.value = true
  error.value = null
  try {
    claims.value = await listRejectedClaims()
  } catch (e: any) {
    error.value = e?.message ?? 'Failed to load fraud alerts.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-10">
    <header
      class="reveal-child section-rule flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Security</p>
        <h1 class="mt-2 font-display text-4xl font-light leading-none tracking-tight text-fg sm:text-5xl">
          Fraud alerts.
        </h1>
        <p class="mt-3 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
          {{ claims.length }} rejected receipt{{ claims.length === 1 ? '' : 's' }} · auto-flagged duplicates and high-amount detection coming later
        </p>
      </div>
      <button
        class="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-mute hover:text-clover"
        @click="load"
      >
        Refresh
      </button>
    </header>

    <section class="reveal-child">
      <p v-if="error" class="font-mono text-[11px] tracking-[0.04em] text-oxblood">{{ error }}</p>

      <div v-if="loading && !claims.length" class="border-t border-surface-rim py-24 text-center">
        <p class="font-display text-2xl font-light italic text-fg-mute">Loading…</p>
      </div>

      <div v-else-if="!claims.length" class="border-t border-surface-rim py-24 text-center">
        <p class="font-display text-2xl font-light italic text-fg-soft">Nothing suspicious.</p>
        <p class="mt-2 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
          Rejected receipts appear here so you can spot patterns over time.
        </p>
      </div>

      <ul v-else class="divide-y divide-surface-rim border-t border-b border-surface-rim">
        <li v-for="c in claimsPg.paged.value" :key="c.id" class="py-5">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline gap-3">
                <p class="text-[15px] text-fg">{{ c.customer_name }}</p>
                <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-oxblood">
                  Rejected
                </span>
              </div>
              <p class="mt-1 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
                {{ c.customer_email || '—' }} · {{ c.customer_phone || '—' }}
              </p>
              <p class="mt-3 text-[14px] text-fg-soft">
                <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">Reason · </span>
                <span class="italic">{{ c.reject_reason || 'No reason given' }}</span>
              </p>
              <p class="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">
                Submitted {{ fmtDateTime(c.submitted_at) }} · Reviewed {{ fmtDateTime(c.reviewed_at) }}
              </p>
            </div>
            <div class="text-right">
              <div class="font-mono tabular-nums text-[18px] text-fg">${{ c.claimed_amount }}</div>
              <div class="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">
                would have been {{ c.points_to_award }} pts
              </div>
            </div>
          </div>
        </li>
      </ul>

      <Pagination
        v-model:page="claimsPg.page.value"
        v-model:pageSize="claimsPg.pageSize.value"
        :total-pages="claimsPg.totalPages.value"
        :total="claimsPg.total.value"
        :range-start="claimsPg.rangeStart.value"
        :range-end="claimsPg.rangeEnd.value"
      />
    </section>
  </div>
</template>
