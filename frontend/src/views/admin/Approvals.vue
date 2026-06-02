<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDialog } from '../../composables/useDialog'
import {
  approveClaim,
  listRecentClaims,
  rejectClaim,
  type Claim,
} from '../../api/loyalty'

const auth = useAuthStore()
const dialog = useDialog()

const all = ref<Claim[]>([])
const loading = ref(false)
const listError = ref<string | null>(null)
const busyId = ref<string | null>(null)

const pending = computed(() =>
  all.value
    .filter((c) => c.status === 'PENDING')
    .sort((a, b) => (a.submitted_at?.toMillis?.() ?? 0) - (b.submitted_at?.toMillis?.() ?? 0)),
)
const history = computed(() => all.value.filter((c) => c.status !== 'PENDING'))

function statusBadge(s: Claim['status']) {
  if (s === 'APPROVED') return { label: 'Approved', tone: 'text-clover' }
  if (s === 'REJECTED') return { label: 'Rejected', tone: 'text-oxblood' }
  return { label: 'Pending', tone: 'text-brass' }
}

function fmtDateTime(ts: any): string {
  if (!ts || !ts.toDate) return '—'
  return ts.toDate().toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function load() {
  loading.value = true
  listError.value = null
  try {
    all.value = await listRecentClaims(100)
  } catch (e: any) {
    listError.value = e?.message ?? 'Failed to load claims.'
  } finally {
    loading.value = false
  }
}

async function approve(c: Claim) {
  if (!auth.user) return
  const ok = await dialog.confirm({
    title: 'Approve claim',
    message: `Approve $${c.claimed_amount} from ${c.customer_name}?\n${c.points_to_award} pts will be credited.`,
    confirmLabel: 'Approve',
  })
  if (!ok) return
  busyId.value = c.id
  try {
    await approveClaim(c.id, auth.user.uid)
    await load()
  } catch (e: any) {
    await dialog.alert({ title: 'Could not approve', message: e?.message ?? 'Failed to approve claim.' })
  } finally {
    busyId.value = null
  }
}

async function reject(c: Claim) {
  if (!auth.user) return
  const reason = await dialog.prompt({
    title: 'Reject claim',
    message: `Reject $${c.claimed_amount} from ${c.customer_name}. Enter a reason for the customer:`,
    placeholder: 'e.g. Receipt doesn\'t match purchase',
    confirmLabel: 'Reject',
    tone: 'danger',
  })
  if (reason === null) return
  busyId.value = c.id
  try {
    await rejectClaim(c.id, auth.user.uid, reason.trim())
    await load()
  } catch (e: any) {
    await dialog.alert({ title: 'Could not reject', message: e?.message ?? 'Failed to reject claim.' })
  } finally {
    busyId.value = null
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
        <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Queue</p>
        <h1 class="mt-2 font-display text-4xl font-light leading-none tracking-tight text-fg sm:text-5xl">
          Pending approvals.
        </h1>
        <p class="mt-3 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
          {{ pending.length }} waiting · {{ history.length }} in history
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
      <p v-if="listError" class="font-mono text-[11px] tracking-[0.04em] text-oxblood">
        {{ listError }}
      </p>

      <div v-if="loading && !pending.length" class="border-t border-surface-rim py-24 text-center">
        <p class="font-display text-2xl font-light italic text-fg-mute">Loading…</p>
      </div>

      <div v-else-if="!pending.length" class="border-t border-surface-rim py-24 text-center">
        <p class="font-display text-2xl font-light italic text-fg-soft">All clear.</p>
        <p class="mt-2 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
          New in-store claims appear here as customers submit them.
        </p>
      </div>

      <table v-else class="w-full">
        <thead>
          <tr class="border-b border-surface-rim text-left">
            <th class="py-3 pr-6 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Customer</th>
            <th class="py-3 pr-6 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Email</th>
            <th class="py-3 pr-6 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Phone</th>
            <th class="py-3 pr-6 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Receipt</th>
            <th class="py-3 pr-6 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Points</th>
            <th class="py-3 pr-6 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Submitted</th>
            <th class="py-3 pr-0 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in pending"
            :key="c.id"
            class="border-b border-surface-rim transition-colors hover:bg-clover/5"
          >
            <td class="py-4 pr-6 text-[15px] text-fg">{{ c.customer_name }}</td>
            <td class="py-4 pr-6 font-mono text-[12px] text-fg-soft">{{ c.customer_email || '—' }}</td>
            <td class="py-4 pr-6 font-mono text-[12px] text-fg-soft">{{ c.customer_phone }}</td>
            <td class="py-4 pr-6 text-right font-mono tabular-nums text-[14px] text-fg">
              ${{ c.claimed_amount }}
            </td>
            <td class="py-4 pr-6 text-right font-mono tabular-nums text-[14px] text-clover">
              +{{ c.points_to_award }}
            </td>
            <td class="py-4 pr-6 font-mono text-[12px] text-fg-soft">{{ fmtDateTime(c.submitted_at) }}</td>
            <td class="py-4 pr-0 text-right">
              <div class="inline-flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.18em]">
                <button
                  class="text-clover hover:text-clover-deep disabled:opacity-50"
                  :disabled="busyId === c.id"
                  @click="approve(c)"
                >
                  {{ busyId === c.id ? '…' : 'Approve' }}
                </button>
                <button
                  class="text-fg-soft hover:text-oxblood disabled:opacity-50"
                  :disabled="busyId === c.id"
                  @click="reject(c)"
                >
                  Reject
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- History (approved + rejected) -->
    <section v-if="history.length" class="reveal-child">
      <p class="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
        Recent history
      </p>
      <table class="w-full">
        <thead>
          <tr class="border-b border-surface-rim text-left">
            <th class="py-3 pr-6 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Customer</th>
            <th class="py-3 pr-6 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Email</th>
            <th class="py-3 pr-6 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Phone</th>
            <th class="py-3 pr-6 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Receipt</th>
            <th class="py-3 pr-6 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Points</th>
            <th class="py-3 pr-6 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Reviewed</th>
            <th class="py-3 pr-0 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in history"
            :key="c.id"
            class="border-b border-surface-rim transition-colors hover:bg-clover/5"
          >
            <td class="py-4 pr-6 text-[15px] text-fg">{{ c.customer_name }}</td>
            <td class="py-4 pr-6 font-mono text-[12px] text-fg-soft">{{ c.customer_email || '—' }}</td>
            <td class="py-4 pr-6 font-mono text-[12px] text-fg-soft">{{ c.customer_phone }}</td>
            <td class="py-4 pr-6 text-right font-mono tabular-nums text-[14px] text-fg">
              ${{ c.claimed_amount }}
            </td>
            <td
              class="py-4 pr-6 text-right font-mono tabular-nums text-[14px]"
              :class="c.status === 'APPROVED' ? 'text-clover' : 'text-fg-mute line-through'"
            >
              {{ c.status === 'APPROVED' ? '+' : '' }}{{ c.points_to_award }}
            </td>
            <td class="py-4 pr-6 font-mono text-[12px] text-fg-soft">
              {{ fmtDateTime(c.reviewed_at) }}
            </td>
            <td class="py-4 pr-0 text-right">
              <span
                class="font-mono text-[10px] uppercase tracking-[0.18em]"
                :class="statusBadge(c.status).tone"
              >
                {{ statusBadge(c.status).label }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
