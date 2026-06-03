<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import {
  effectiveRedemptionStatus,
  isRedemptionOtpExpired,
  listMyClaims,
  listMyRedemptions,
  redemptionOtpExpiresAt,
  type Claim,
  type Redemption,
  type RedemptionStatus,
} from '../api/loyalty'

const auth = useAuthStore()

const claims = ref<Claim[]>([])
const redemptions = ref<Redemption[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)

// Reactive clock: ticked once a minute so the countdown labels under each
// pending pickup re-render without requiring a navigation or refresh.
const nowMs = ref(Date.now())
let tickHandle: ReturnType<typeof setInterval> | null = null

function claimBadge(s: Claim['status']) {
  if (s === 'APPROVED') return { label: 'Approved', tone: 'text-clover' }
  if (s === 'REJECTED') return { label: 'Rejected', tone: 'text-oxblood' }
  return { label: 'Pending', tone: 'text-brass' }
}

function redemptionBadge(s: RedemptionStatus) {
  if (s === 'CONFIRMED') return { label: 'Confirmed', tone: 'text-clover' }
  if (s === 'DELIVERED') return { label: 'Delivered', tone: 'text-clover' }
  if (s === 'CANCELED') return { label: 'Canceled', tone: 'text-oxblood' }
  if (s === 'EXPIRED') return { label: 'Expired', tone: 'text-oxblood' }
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

/**
 * "Expires in 23h 45m" / "Expires in 12m" / "Expired" — for a pending in-store
 * pickup, returns a short countdown label relative to the reactive `nowMs`.
 * Returns an empty string for any redemption that doesn't have an active OTP.
 */
function expiryLabel(r: Redemption): string {
  if (r.status !== 'PENDING' || r.method !== 'IN_STORE') return ''
  const expiresAt = redemptionOtpExpiresAt(r)
  if (!expiresAt) return ''
  const msLeft = expiresAt.getTime() - nowMs.value
  if (msLeft <= 0) return 'Expired'
  const totalMin = Math.floor(msLeft / 60_000)
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (hours > 0) return `Expires in ${hours}h ${mins}m`
  return `Expires in ${Math.max(1, mins)}m`
}

function effectiveStatus(r: Redemption): RedemptionStatus {
  return effectiveRedemptionStatus(r, nowMs.value)
}

function isExpired(r: Redemption): boolean {
  return isRedemptionOtpExpired(r, nowMs.value)
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

onMounted(() => {
  load()
  tickHandle = setInterval(() => {
    nowMs.value = Date.now()
  }, 60_000)
})

onBeforeUnmount(() => {
  if (tickHandle) clearInterval(tickHandle)
})
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
              v-if="r.status === 'PENDING' && r.method === 'IN_STORE'"
              class="mt-1 font-mono text-[10px] uppercase tracking-[0.18em]"
              :class="isExpired(r) ? 'text-oxblood' : 'text-fg-mute'"
            >
              <template v-if="isExpired(r)">
                Pickup code expired — points were not refunded
              </template>
              <template v-else>
                Pickup code shown once at submission · {{ expiryLabel(r) }}
              </template>
            </p>
          </div>
          <span
            class="font-mono text-[10px] uppercase tracking-[0.18em]"
            :class="redemptionBadge(effectiveStatus(r)).tone"
          >
            {{ redemptionBadge(effectiveStatus(r)).label }}
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>
