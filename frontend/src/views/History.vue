<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import {
  listMyClaims,
  listMyRedemptions,
  type Claim,
  type Redemption,
} from '../api/loyalty'

const auth = useAuthStore()

const claims = ref<Claim[]>([])
const redemptions = ref<Redemption[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)

function claimBadge(s: Claim['status']) {
  if (s === 'APPROVED') return { label: 'Approved', tone: 'text-clover' }
  if (s === 'REJECTED') return { label: 'Rejected', tone: 'text-oxblood' }
  return { label: 'Pending', tone: 'text-brass' }
}

function redemptionBadge(s: Redemption['status']) {
  if (s === 'CONFIRMED') return { label: 'Confirmed', tone: 'text-clover' }
  if (s === 'DELIVERED') return { label: 'Delivered', tone: 'text-clover' }
  if (s === 'CANCELED') return { label: 'Canceled', tone: 'text-oxblood' }
  return { label: 'Pending', tone: 'text-brass' }
}

function fmtDate(ts: any): string {
  if (!ts || !ts.toDate) return '—'
  return ts.toDate().toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

async function load() {
  if (!auth.user) return
  loading.value = true
  loadError.value = null
  try {
    const [c, r] = await Promise.all([
      listMyClaims(auth.user.uid, 50),
      listMyRedemptions(auth.user.uid, 50),
    ])
    claims.value = c
    redemptions.value = r
  } catch (e: any) {
    loadError.value = e?.message ?? 'Failed to load your history.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-12">
    <header class="reveal-child section-rule">
      <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Activity</p>
      <h1 class="mt-2 font-display text-4xl font-light leading-none tracking-tight text-fg sm:text-5xl">
        Your history.
      </h1>
    </header>

    <p v-if="loadError" class="reveal-child font-mono text-[11px] tracking-[0.04em] text-oxblood">
      {{ loadError }}
    </p>

    <!-- Receipts submitted -->
    <section class="reveal-child">
      <p class="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
        Receipts you've submitted
      </p>

      <div v-if="loading && !claims.length" class="border-t border-surface-rim py-12 text-center">
        <p class="font-display text-xl font-light italic text-fg-mute">Loading…</p>
      </div>
      <div v-else-if="!claims.length" class="border-t border-surface-rim py-12 text-center">
        <p class="font-display text-xl font-light italic text-fg-soft">No receipts yet.</p>
        <p class="mt-2 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
          Submit an in-store receipt from the dashboard to start earning points.
        </p>
      </div>
      <ul v-else class="divide-y divide-surface-rim border-t border-b border-surface-rim">
        <li
          v-for="c in claims"
          :key="c.id"
          class="flex items-center justify-between py-3"
        >
          <div>
            <p class="text-[15px] text-fg">
              In-store claim · ${{ c.claimed_amount }}
              <span class="font-mono text-[11px] text-fg-mute">
                · {{ c.points_to_award }} pts
              </span>
            </p>
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">
              {{ fmtDate(c.submitted_at) }}
            </p>
          </div>
          <span
            class="font-mono text-[10px] uppercase tracking-[0.18em]"
            :class="claimBadge(c.status).tone"
          >
            {{ claimBadge(c.status).label }}
          </span>
        </li>
      </ul>
    </section>

    <!-- Items redeemed -->
    <section class="reveal-child">
      <p class="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
        Items you've redeemed
      </p>

      <div v-if="loading && !redemptions.length" class="border-t border-surface-rim py-12 text-center">
        <p class="font-display text-xl font-light italic text-fg-mute">Loading…</p>
      </div>
      <div v-else-if="!redemptions.length" class="border-t border-surface-rim py-12 text-center">
        <p class="font-display text-xl font-light italic text-fg-soft">No redemptions yet.</p>
        <p class="mt-2 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
          Items you redeem from the catalogue will appear here.
        </p>
      </div>
      <ul v-else class="divide-y divide-surface-rim border-t border-b border-surface-rim">
        <li v-for="r in redemptions" :key="r.id" class="flex items-center gap-4 py-3">
          <img
            v-if="r.catalogue_item_photo"
            :src="r.catalogue_item_photo"
            :alt="r.catalogue_item_name"
            class="h-12 w-12 flex-shrink-0 border border-surface-rim object-cover"
          />
          <div
            v-else
            class="grid h-12 w-12 flex-shrink-0 place-items-center border border-surface-rim bg-surface text-[9px] uppercase tracking-[0.2em] text-fg-mute"
          >
            no img
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[15px] text-fg">{{ r.catalogue_item_name }}</p>
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">
              {{ fmtDate(r.created_at) }} ·
              {{ r.method === 'IN_STORE' ? 'In-store pickup' : 'Online delivery' }} ·
              {{ r.points_used }} pts
            </p>
            <p
              v-if="r.status === 'PENDING' && r.method === 'IN_STORE' && r.otp_code"
              class="mt-1 font-mono text-[13px] tracking-[0.25em] text-clover"
            >
              Code: {{ r.otp_code }}
            </p>
          </div>
          <span
            class="font-mono text-[10px] uppercase tracking-[0.18em]"
            :class="redemptionBadge(r.status).tone"
          >
            {{ redemptionBadge(r.status).label }}
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>
