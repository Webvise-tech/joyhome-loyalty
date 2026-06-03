<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDialog } from '../../composables/useDialog'
import { useToast } from '../../composables/useToast'
import { usePagination } from '../../composables/usePagination'
import Pagination from '../../components/Pagination.vue'
import {
  cancelRedemption,
  confirmInStoreOtp,
  expireOverduePendingInStoreRedemptions,
  listRecentRedemptions,
  markRedemptionDelivered,
  type Redemption,
} from '../../api/loyalty'
import InputLabel from '../../components/InputLabel.vue'
import InputError from '../../components/InputError.vue'
import PrimaryButton from '../../components/PrimaryButton.vue'

const auth = useAuthStore()
const dialog = useDialog()
const toast = useToast()

const all = ref<Redemption[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const busyId = ref<string | null>(null)

const otpCode = ref('')
const otpBusy = ref(false)
const otpError = ref<string | null>(null)
const otpSuccess = ref<Redemption | null>(null)

const pending = computed(() => all.value.filter((r) => r.status === 'PENDING'))
const history = computed(() => all.value.filter((r) => r.status !== 'PENDING'))
const onlinePending = computed(() => pending.value.filter((r) => r.method === 'ONLINE'))
const inStorePending = computed(() => pending.value.filter((r) => r.method === 'IN_STORE'))

const onlinePg = usePagination(onlinePending)
const inStorePg = usePagination(inStorePending)
const historyPg = usePagination(history)

function statusBadge(s: Redemption['status']) {
  if (s === 'CONFIRMED') return { label: 'Confirmed', tone: 'text-clover' }
  if (s === 'DELIVERED') return { label: 'Delivered', tone: 'text-clover' }
  if (s === 'CANCELED') return { label: 'Canceled', tone: 'text-oxblood' }
  if (s === 'EXPIRED') return { label: 'Expired', tone: 'text-oxblood' }
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
  loadError.value = null
  try {
    // Sweep overdue in-store pickups first so the pending queue below is accurate
    // and any 48h-stale codes show up as EXPIRED in history. Best-effort: a failure
    // here shouldn't block loading the list.
    if (auth.user) {
      try {
        await expireOverduePendingInStoreRedemptions(auth.user.uid)
      } catch { /* surfaced on next refresh */ }
    }
    all.value = await listRecentRedemptions(50)
  } catch (e: any) {
    const message = e?.message ?? 'Failed to load redemptions.'
    loadError.value = message
    toast.error(message)
  } finally {
    loading.value = false
  }
}

async function confirmOtp() {
  if (!auth.user) return
  otpBusy.value = true
  otpError.value = null
  otpSuccess.value = null
  try {
    const r = await confirmInStoreOtp(otpCode.value, auth.user.uid)
    otpSuccess.value = r
    otpCode.value = ''
    toast.success(`Redemption confirmed — give ${r.customer_name} their ${r.catalogue_item_name}.`)
    await load()
  } catch (e: any) {
    const message = e?.message ?? 'Could not confirm code.'
    otpError.value = message
    toast.error(message)
  } finally {
    otpBusy.value = false
  }
}

async function markDelivered(r: Redemption) {
  if (!auth.user) return
  const ok = await dialog.confirm({
    title: 'Mark delivered',
    message: `Mark "${r.catalogue_item_name}" delivered to ${r.customer_name}?`,
    confirmLabel: 'Mark delivered',
  })
  if (!ok) return
  busyId.value = r.id
  try {
    await markRedemptionDelivered(r.id, auth.user.uid)
    toast.success(`Marked "${r.catalogue_item_name}" delivered.`)
    await load()
  } catch (e: any) {
    toast.error(e?.message ?? 'Failed to mark delivered.')
  } finally {
    busyId.value = null
  }
}

async function cancel(r: Redemption) {
  if (!auth.user) return
  const ok = await dialog.confirm({
    title: 'Cancel redemption',
    message: `Cancel "${r.catalogue_item_name}" for ${r.customer_name}?\nThe ${r.points_used} pts will be refunded.`,
    confirmLabel: 'Cancel redemption',
    cancelLabel: 'Keep it',
    tone: 'danger',
  })
  if (!ok) return
  busyId.value = r.id
  try {
    await cancelRedemption(r.id, auth.user.uid)
    toast.success(`Redemption canceled — ${r.points_used} pts refunded to ${r.customer_name}.`)
    await load()
  } catch (e: any) {
    toast.error(e?.message ?? 'Failed to cancel.')
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
        <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Fulfillment</p>
        <h1 class="mt-2 font-display text-4xl font-light leading-none tracking-tight text-fg sm:text-5xl">
          Redemptions.
        </h1>
        <p class="mt-3 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
          {{ inStorePending.length }} in-store · {{ onlinePending.length }} online to fulfill
        </p>
      </div>
      <button
        class="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-mute hover:text-clover"
        @click="load"
      >
        Refresh
      </button>
    </header>

    <!-- In-store pickup: cashier enters OTP -->
    <section class="reveal-child">
      <p class="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
        Confirm in-store pickup
      </p>
      <div class="border border-surface-rim bg-surface-elev p-5">
        <form class="flex items-end gap-4" @submit.prevent="confirmOtp">
          <div class="flex-1">
            <InputLabel for="otp" value="Customer's 6-digit code" />
            <input
              id="otp"
              v-model="otpCode"
              inputmode="numeric"
              maxlength="6"
              placeholder="123456"
              class="w-full border-0 border-b border-fg/30 bg-transparent px-0 py-2 font-mono text-3xl tracking-[0.3em] text-fg focus:border-clover focus:outline-none focus:ring-0"
            />
          </div>
          <PrimaryButton :disabled="otpBusy || otpCode.length !== 6">
            {{ otpBusy ? 'Checking…' : 'Confirm' }}
            <span class="text-base">→</span>
          </PrimaryButton>
        </form>
        <InputError :message="otpError" />

        <div
          v-if="otpSuccess"
          class="mt-5 border border-clover bg-clover/5 p-5"
        >
          <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-clover">
            ✓ Confirmed — hand this item to the customer
          </p>

          <div class="mt-4 flex items-start gap-4">
            <img
              v-if="otpSuccess.catalogue_item_photo"
              :src="otpSuccess.catalogue_item_photo"
              :alt="otpSuccess.catalogue_item_name"
              class="h-24 w-24 flex-shrink-0 border border-surface-rim object-cover"
            />
            <div
              v-else
              class="grid h-24 w-24 flex-shrink-0 place-items-center border border-surface-rim bg-surface text-[10px] uppercase tracking-[0.22em] text-fg-mute"
            >
              no img
            </div>

            <div class="min-w-0 flex-1">
              <p class="font-display text-2xl font-light leading-tight text-fg">
                {{ otpSuccess.catalogue_item_name }}
              </p>
              <p class="mt-1 font-mono text-[11px] tracking-[0.04em] text-clover">
                {{ otpSuccess.points_used }} pts deducted
              </p>
              <div class="mt-3 border-t border-surface-rim/50 pt-3">
                <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">For</p>
                <p class="text-[15px] text-fg">{{ otpSuccess.customer_name }}</p>
                <p class="font-mono text-[12px] text-fg-soft">{{ otpSuccess.customer_phone }}</p>
              </div>
            </div>
          </div>

          <div class="mt-5 flex items-center justify-end border-t border-surface-rim/50 pt-4">
            <button
              type="button"
              class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-soft hover:text-clover"
              @click="otpSuccess = null"
            >
              Done — next customer →
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Online deliveries -->
    <section class="reveal-child">
      <p class="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
        Online deliveries to fulfill
      </p>

      <p v-if="loadError" class="font-mono text-[11px] tracking-[0.04em] text-oxblood">
        {{ loadError }}
      </p>

      <div v-if="loading && !onlinePending.length" class="border-t border-surface-rim py-16 text-center">
        <p class="font-display text-xl font-light italic text-fg-mute">Loading…</p>
      </div>

      <div v-else-if="!onlinePending.length" class="border-t border-surface-rim py-16 text-center">
        <p class="font-display text-xl font-light italic text-fg-soft">Nothing to ship.</p>
        <p class="mt-2 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
          Online delivery orders appear here as customers redeem.
        </p>
      </div>

      <ul v-else class="divide-y divide-surface-rim border-t border-b border-surface-rim">
        <li
          v-for="r in onlinePg.paged.value"
          :key="r.id"
          class="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div class="flex items-start gap-3">
            <img
              v-if="r.catalogue_item_photo"
              :src="r.catalogue_item_photo"
              :alt="r.catalogue_item_name"
              class="h-16 w-16 flex-shrink-0 border border-surface-rim object-cover"
            />
            <div
              v-else
              class="grid h-16 w-16 flex-shrink-0 place-items-center border border-surface-rim bg-surface text-[10px] uppercase tracking-[0.22em] text-fg-mute"
            >
              no img
            </div>
            <div>
              <p class="text-[15px] text-fg">{{ r.catalogue_item_name }}</p>
              <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">
                {{ fmtDateTime(r.created_at) }} · {{ r.points_used }} pts
              </p>
              <p class="mt-1 text-[14px] text-fg-soft">{{ r.customer_name }}</p>
              <p class="font-mono text-[12px] text-fg-soft">{{ r.customer_phone }}</p>
              <p class="mt-1 text-[13px] text-fg-soft whitespace-pre-line">
                {{ r.delivery_address }}
              </p>
            </div>
          </div>
          <div class="flex flex-shrink-0 items-center gap-4 font-mono text-[10px] uppercase tracking-[0.18em] sm:flex-col sm:items-end">
            <button
              class="text-clover hover:text-clover-deep disabled:opacity-50"
              :disabled="busyId === r.id"
              @click="markDelivered(r)"
            >
              {{ busyId === r.id ? '…' : 'Mark delivered' }}
            </button>
            <button
              class="text-fg-soft hover:text-oxblood disabled:opacity-50"
              :disabled="busyId === r.id"
              @click="cancel(r)"
            >
              Cancel
            </button>
          </div>
        </li>
      </ul>

      <Pagination
        v-if="onlinePending.length"
        v-model:page="onlinePg.page.value"
        v-model:pageSize="onlinePg.pageSize.value"
        :total-pages="onlinePg.totalPages.value"
        :total="onlinePg.total.value"
        :range-start="onlinePg.rangeStart.value"
        :range-end="onlinePg.rangeEnd.value"
      />
    </section>

    <!-- In-store pending list (informational) -->
    <section v-if="inStorePending.length" class="reveal-child">
      <p class="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
        Awaiting in-store pickup
      </p>
      <ul class="divide-y divide-surface-rim border-t border-b border-surface-rim">
        <li
          v-for="r in inStorePg.paged.value"
          :key="r.id"
          class="flex items-center justify-between py-3"
        >
          <div>
            <p class="text-[15px] text-fg">
              {{ r.catalogue_item_name }}
              <span class="font-mono text-[11px] text-fg-mute"> · {{ r.points_used }} pts</span>
            </p>
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">
              {{ r.customer_name }} · {{ fmtDateTime(r.created_at) }}
            </p>
          </div>
          <button
            class="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-soft hover:text-oxblood disabled:opacity-50"
            :disabled="busyId === r.id"
            @click="cancel(r)"
          >
            Cancel
          </button>
        </li>
      </ul>

      <Pagination
        v-model:page="inStorePg.page.value"
        v-model:pageSize="inStorePg.pageSize.value"
        :total-pages="inStorePg.totalPages.value"
        :total="inStorePg.total.value"
        :range-start="inStorePg.rangeStart.value"
        :range-end="inStorePg.rangeEnd.value"
      />
    </section>

    <!-- History (all non-pending: confirmed / delivered / canceled) -->
    <section v-if="history.length" class="reveal-child">
      <p class="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
        Recent history
      </p>
      <ul class="divide-y divide-surface-rim border-t border-b border-surface-rim">
        <li v-for="r in historyPg.paged.value" :key="r.id" class="flex items-center gap-4 py-3">
          <img
            v-if="r.catalogue_item_photo"
            :src="r.catalogue_item_photo"
            :alt="r.catalogue_item_name"
            class="h-10 w-10 flex-shrink-0 border border-surface-rim object-cover"
          />
          <div
            v-else
            class="grid h-10 w-10 flex-shrink-0 place-items-center border border-surface-rim bg-surface text-[9px] uppercase tracking-[0.2em] text-fg-mute"
          >
            no img
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[15px] text-fg">
              {{ r.catalogue_item_name }}
              <span class="font-mono text-[11px] text-fg-mute"> · {{ r.points_used }} pts</span>
            </p>
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">
              {{ r.customer_name }} ·
              {{ r.method === 'IN_STORE' ? 'In-store' : 'Online' }} ·
              {{ fmtDateTime(r.created_at) }}
            </p>
          </div>
          <span
            class="font-mono text-[10px] uppercase tracking-[0.18em]"
            :class="statusBadge(r.status).tone"
          >
            {{ statusBadge(r.status).label }}
          </span>
        </li>
      </ul>

      <Pagination
        v-model:page="historyPg.page.value"
        v-model:pageSize="historyPg.pageSize.value"
        :total-pages="historyPg.totalPages.value"
        :total="historyPg.total.value"
        :range-start="historyPg.rangeStart.value"
        :range-end="historyPg.rangeEnd.value"
      />
    </section>
  </div>
</template>
