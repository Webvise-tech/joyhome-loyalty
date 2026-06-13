<script setup lang="ts">
import { onMounted, ref, computed, reactive } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast'
import {
  availableBalance,
  listActiveCatalogue,
  listMyActiveBatches,
  listMyRedemptions,
  nextExpiry,
  pointsFor,
  submitClaim,
  submitRedemption,
  type CatalogueItem,
  type PointsBatch,
  type Redemption,
  type RedemptionMethod,
} from '../api/loyalty'
import InputLabel from '../components/InputLabel.vue'
import InputError from '../components/InputError.vue'
import PrimaryButton from '../components/PrimaryButton.vue'
import SecondaryButton from '../components/SecondaryButton.vue'

const auth = useAuthStore()
const toast = useToast()

const catalogue = ref<CatalogueItem[]>([])
const batches = ref<PointsBatch[]>([])
const redemptions = ref<Redemption[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)

const balance = computed(() => availableBalance(batches.value, redemptions.value))
const expiry = computed(() => nextExpiry(batches.value))
const expiryLabel = computed(() => {
  const d = expiry.value
  if (!d) return null
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
})
const daysUntilExpiry = computed(() => {
  const d = expiry.value
  if (!d) return null
  const msPerDay = 1000 * 60 * 60 * 24
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startOfExpiry = new Date(d)
  startOfExpiry.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((startOfExpiry.getTime() - startOfToday.getTime()) / msPerDay))
})

// Redemption modal state
const showRedeem = ref(false)
const redeemItem = ref<CatalogueItem | null>(null)
const redeemMethod = ref<RedemptionMethod>('IN_STORE')
const delivery = reactive({
  recipient_name: '',
  phone: '',
  street: '',
  city: '',
  notes: '',
})
const redeemSubmitting = ref(false)
const redeemError = ref<string | null>(null)
const otpReveal = ref<string | null>(null)

const redeemDeficit = computed(() => {
  if (!redeemItem.value) return 0
  return Math.max(0, redeemItem.value.points_cost - balance.value)
})
const balanceAfter = computed(() => {
  if (!redeemItem.value) return balance.value
  return Math.max(0, balance.value - redeemItem.value.points_cost)
})

function openRedeem(item: CatalogueItem) {
  if (item.stock_qty === 0) return
  redeemItem.value = item
  redeemMethod.value = 'IN_STORE'
  delivery.recipient_name = auth.customer
    ? `${auth.customer.first_name} ${auth.customer.last_name}`.trim()
    : ''
  delivery.phone = auth.customer?.phone ?? ''
  delivery.street = ''
  delivery.city = ''
  delivery.notes = ''
  redeemError.value = null
  otpReveal.value = null
  showRedeem.value = true
}

function closeRedeem() {
  showRedeem.value = false
  redeemItem.value = null
  otpReveal.value = null
}

async function submitRedeemForm() {
  if (!auth.user || !auth.customer || !redeemItem.value) return
  if (redeemDeficit.value > 0) return

  redeemSubmitting.value = true
  redeemError.value = null
  const itemName = redeemItem.value.name
  try {
    // customer_name + customer_phone are sourced from customers/{uid} inside the
    // transaction (and enforced by firestore.rules), so we no longer pass them.
    const { otp_code } = await submitRedemption({
      customer_id: auth.user.uid,
      item: redeemItem.value,
      method: redeemMethod.value,
      delivery:
        redeemMethod.value === 'ONLINE'
          ? {
              recipient_name: delivery.recipient_name,
              phone: delivery.phone,
              street: delivery.street,
              city: delivery.city,
              notes: delivery.notes,
            }
          : undefined,
    })

    if (otp_code) {
      otpReveal.value = otp_code
      toast.success(`Your code is ready — show it at the register to pick up ${itemName}.`)
    } else {
      toast.success(`Order placed — we'll deliver ${itemName} soon.`)
    }
    await loadAll()
    if (!otp_code) {
      setTimeout(closeRedeem, 1800)
    }
  } catch (e: any) {
    const message = e?.message ?? 'Could not submit redemption.'
    redeemError.value = message
    toast.error(message)
  } finally {
    redeemSubmitting.value = false
  }
}

// Claim modal
const showClaim = ref(false)
const claim = reactive({ amount: 0 })
const claimSubmitting = ref(false)
const claimError = ref<string | null>(null)
const claimSuccess = ref(false)
const previewPoints = computed(() => pointsFor(Number(claim.amount) || 0))


async function loadAll() {
  if (!auth.user) return
  loading.value = true
  loadError.value = null
  try {
    const [items, batchData, redemptionData] = await Promise.all([
      listActiveCatalogue(),
      listMyActiveBatches(auth.user.uid),
      listMyRedemptions(auth.user.uid, 10),
    ])
    catalogue.value = items.sort((a, b) => a.points_cost - b.points_cost)
    batches.value = batchData
    redemptions.value = redemptionData
  } catch (e: any) {
    loadError.value = e?.message ?? 'Failed to load your dashboard.'
  } finally {
    loading.value = false
  }
}

function openClaim() {
  claim.amount = 0
  claimError.value = null
  claimSuccess.value = false
  showClaim.value = true
}

async function submitClaimForm() {
  if (!auth.user || !auth.customer) return
  claimSubmitting.value = true
  claimError.value = null
  try {
    await submitClaim({
      customer_id: auth.user.uid,
      customer_name: `${auth.customer.first_name} ${auth.customer.last_name}`.trim(),
      customer_email: auth.customer.email,
      customer_phone: auth.customer.phone,
      claimed_amount: Number(claim.amount),
    })
    claimSuccess.value = true
    toast.success(`Receipt submitted — ${previewPoints.value} pts pending approval.`)
    await loadAll()
    setTimeout(() => { showClaim.value = false }, 1400)
  } catch (e: any) {
    const message = e?.message ?? 'Could not submit claim.'
    claimError.value = message
    toast.error(message)
  } finally {
    claimSubmitting.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="space-y-10">
    <header class="reveal-child section-rule">
      <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
        {{ auth.customer?.first_name ? `Hi, ${auth.customer.first_name}` : 'Welcome' }}
      </p>
      <h1 class="mt-2 font-display text-4xl font-light leading-none tracking-tight text-fg sm:text-5xl">
        Your rewards.
      </h1>
    </header>

    <section class="reveal-child">
      <div class="border border-surface-rim bg-surface-elev p-6 sm:p-8">
        <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
          Point balance
        </p>
        <p class="mt-3 font-display text-5xl font-light leading-none tracking-tight text-clover sm:text-6xl">
          {{ balance }}
          <span class="ml-1 font-sans text-base font-normal text-fg-mute">pts</span>
        </p>
        <p v-if="daysUntilExpiry !== null" class="mt-4 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
          <template v-if="daysUntilExpiry === 0">
            Some of your points expire today.
          </template>
          <template v-else-if="daysUntilExpiry === 1">
            Some of your points expire in <span class="text-clover">1 day</span>
            ({{ expiryLabel }}).
          </template>
          <template v-else>
            Some of your points expire in <span class="text-clover">{{ daysUntilExpiry }} days</span>
            ({{ expiryLabel }}).
          </template>
        </p>
        <p class="mt-1 font-mono text-[10px] tracking-[0.04em] text-fg-mute">
          Points are valid for 60 days from the date they're earned.
        </p>
      </div>
    </section>

    <section class="reveal-child">
      <button
        class="group flex w-full items-center justify-between border border-surface-rim bg-surface-elev px-5 py-4 text-left transition-colors hover:border-clover"
        @click="openClaim"
      >
        <span>
          <span class="block font-display text-xl font-light text-fg">Claim in-store</span>
          <span class="mt-1 block font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
            Submit a receipt
          </span>
        </span>
        <span class="text-lg text-fg-mute transition-transform group-hover:translate-x-0.5">→</span>
      </button>
    </section>

    <!-- Catalogue grid -->
    <section id="weekly-rewards" class="reveal-child scroll-mt-20">
      <div class="mb-4 flex items-end justify-between">
        <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
          This week's rewards
        </p>
      </div>

      <div v-if="loading && !catalogue.length" class="border-t border-surface-rim py-16 text-center">
        <p class="font-display text-xl font-light italic text-fg-mute">Loading…</p>
      </div>
      <div v-else-if="!catalogue.length" class="border-t border-surface-rim py-16 text-center">
        <p class="font-display text-xl font-light italic text-fg-soft">No rewards yet.</p>
        <p class="mt-2 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
          Check back soon — new rewards every week.
        </p>
      </div>
      <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <button
          v-for="item in catalogue"
          :key="item.id"
          type="button"
          :disabled="item.stock_qty === 0"
          class="group border border-surface-rim bg-surface-elev p-3 text-left transition-colors hover:border-clover disabled:cursor-not-allowed disabled:opacity-60"
          @click="openRedeem(item)"
        >
          <div class="aspect-square w-full overflow-hidden bg-surface">
            <img
              v-if="item.photo_url"
              :src="item.photo_url"
              :alt="item.name"
              class="h-full w-full object-cover"
            />
            <div v-else class="grid h-full w-full place-items-center text-[10px] uppercase tracking-[0.22em] text-fg-mute">
              no img
            </div>
          </div>
          <div class="mt-3">
            <p class="font-display text-base font-light leading-tight text-fg">{{ item.name }}</p>
            <p class="mt-1 font-mono text-[11px] tracking-[0.04em] text-clover">
              {{ item.points_cost }} pts
            </p>
            <p v-if="item.stock_qty === 0" class="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">
              Out of stock
            </p>
          </div>
        </button>
      </div>
    </section>

    <p v-if="loadError" class="reveal-child font-mono text-[11px] tracking-[0.04em] text-oxblood">
      {{ loadError }}
    </p>

    <!-- Redeem modal -->
    <Teleport to="body">
      <div
        v-if="showRedeem && redeemItem"
        class="fixed inset-0 z-50 overflow-y-auto bg-overlay/80 backdrop-blur-sm"
        @click.self="closeRedeem"
      >
        <div
          class="flex min-h-full items-start justify-center px-4 py-8 sm:items-center"
          @click.self="closeRedeem"
        >
        <div class="reveal w-full max-w-xl border border-surface-rim bg-surface-elev shadow-pop">
          <!-- OTP reveal screen -->
          <div v-if="otpReveal">
            <header class="border-b border-surface-rim px-6 py-5">
              <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Pickup code</p>
              <h2 class="mt-1 font-display text-2xl font-light leading-tight text-fg">
                Show this to the cashier.
              </h2>
            </header>
            <div class="px-6 py-8 text-center">
              <p class="font-display text-6xl font-light tracking-[0.2em] text-clover">
                {{ otpReveal }}
              </p>
              <p class="mt-4 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
                {{ redeemItem.name }} · {{ redeemItem.points_cost }} pts
              </p>
            </div>
            <div class="mx-6 mb-2 border border-clover/30 bg-clover/5 p-4">
              <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-clover">
                Tip · take a screenshot
              </p>
              <p class="mt-1 text-[13px] text-fg-soft">
                The code is also saved under "Items you've redeemed" below — you can come back to it any time before pickup.
              </p>
            </div>
            <div class="flex items-center justify-end border-t border-surface-rim px-6 py-5">
              <SecondaryButton type="button" @click="closeRedeem">Done</SecondaryButton>
            </div>
          </div>

          <!-- Form -->
          <form v-else class="space-y-5 px-6 py-6" @submit.prevent="submitRedeemForm">
            <header class="-mx-6 -mt-6 border-b border-surface-rim bg-surface-elev px-6 py-5">
              <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Redeem</p>
              <h2 class="mt-1 font-display text-2xl font-light leading-tight text-fg">
                {{ redeemItem.name }}.
              </h2>
            </header>

            <div class="flex items-center gap-3">
              <img
                v-if="redeemItem.photo_url"
                :src="redeemItem.photo_url"
                :alt="redeemItem.name"
                class="h-16 w-16 border border-surface-rim object-cover"
              />
              <div
                v-else
                class="grid h-16 w-16 place-items-center border border-surface-rim bg-surface text-[10px] uppercase tracking-[0.22em] text-fg-mute"
              >
                no img
              </div>
              <div class="flex-1">
                <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Cost</p>
                <p class="font-display text-2xl font-light text-clover">
                  {{ redeemItem.points_cost }} <span class="text-sm text-fg-mute">pts</span>
                </p>
              </div>
            </div>

            <div class="border-t border-b border-surface-rim py-4 text-sm text-fg-soft">
              <div class="flex items-center justify-between">
                <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">Your balance</span>
                <span class="font-mono tabular-nums">{{ balance }} pts</span>
              </div>
              <div v-if="redeemDeficit > 0" class="mt-2 flex items-center justify-between">
                <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-oxblood">Short by</span>
                <span class="font-mono tabular-nums text-oxblood">{{ redeemDeficit }} pts</span>
              </div>
              <div v-else class="mt-2 flex items-center justify-between">
                <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">After</span>
                <span class="font-mono tabular-nums">{{ balanceAfter }} pts</span>
              </div>
            </div>

            <div v-if="redeemDeficit === 0" class="space-y-3">
              <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
                Pickup method
              </p>
              <label class="flex cursor-pointer items-start gap-3 border border-surface-rim p-3 transition-colors hover:border-clover">
                <input
                  v-model="redeemMethod"
                  type="radio"
                  value="IN_STORE"
                  class="mt-1 accent-clover"
                />
                <span>
                  <span class="block text-[15px] text-fg">In-store pickup</span>
                  <span class="block font-mono text-[11px] tracking-[0.04em] text-fg-mute">
                    Get a 6-digit code to show the cashier.
                  </span>
                </span>
              </label>
              <label class="flex cursor-pointer items-start gap-3 border border-surface-rim p-3 transition-colors hover:border-clover">
                <input
                  v-model="redeemMethod"
                  type="radio"
                  value="ONLINE"
                  class="mt-1 accent-clover"
                />
                <span>
                  <span class="block text-[15px] text-fg">Online delivery</span>
                  <span class="block font-mono text-[11px] tracking-[0.04em] text-fg-mute">
                    We'll ship it to your address.
                  </span>
                </span>
              </label>

              <div v-if="redeemMethod === 'ONLINE'" class="space-y-4 border-t border-surface-rim pt-4">
                <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">
                  Delivery address
                </p>

                <div>
                  <InputLabel for="recip" value="Recipient name" />
                  <input
                    id="recip"
                    v-model="delivery.recipient_name"
                    type="text"
                    required
                    autocomplete="name"
                    class="w-full border-0 border-b border-fg/30 bg-transparent px-0 py-2 text-[15px] text-fg focus:border-clover focus:outline-none focus:ring-0"
                  />
                </div>

                <div>
                  <InputLabel for="dphone" value="Phone (for delivery)" />
                  <input
                    id="dphone"
                    v-model="delivery.phone"
                    type="tel"
                    required
                    autocomplete="tel"
                    class="w-full border-0 border-b border-fg/30 bg-transparent px-0 py-2 text-[15px] text-fg focus:border-clover focus:outline-none focus:ring-0"
                  />
                </div>

                <div>
                  <InputLabel for="street" value="Street, building, floor" />
                  <input
                    id="street"
                    v-model="delivery.street"
                    type="text"
                    required
                    autocomplete="street-address"
                    placeholder="e.g. Hamra St, Saroulla Bldg, 4th flr"
                    class="w-full border-0 border-b border-fg/30 bg-transparent px-0 py-2 text-[15px] text-fg focus:border-clover focus:outline-none focus:ring-0"
                  />
                </div>

                <div>
                  <InputLabel for="city" value="City / area" />
                  <input
                    id="city"
                    v-model="delivery.city"
                    type="text"
                    required
                    autocomplete="address-level2"
                    placeholder="e.g. Beirut — Hamra"
                    class="w-full border-0 border-b border-fg/30 bg-transparent px-0 py-2 text-[15px] text-fg focus:border-clover focus:outline-none focus:ring-0"
                  />
                </div>

                <div>
                  <InputLabel for="notes" value="Notes (optional)" />
                  <textarea
                    id="notes"
                    v-model="delivery.notes"
                    rows="2"
                    placeholder="Nearby landmark, gate code, etc."
                    class="w-full border-0 border-b border-fg/30 bg-transparent px-0 py-2 text-[15px] text-fg focus:border-clover focus:outline-none focus:ring-0"
                  />
                </div>
              </div>
            </div>

            <InputError :message="redeemError" />

            <div class="flex items-center justify-end gap-3 border-t border-surface-rim pt-5">
              <SecondaryButton type="button" @click="closeRedeem">Cancel</SecondaryButton>
              <PrimaryButton :disabled="redeemSubmitting || redeemDeficit > 0">
                {{ redeemSubmitting ? 'Submitting…' : 'Confirm redemption' }}
                <span class="text-base">→</span>
              </PrimaryButton>
            </div>
          </form>
        </div>
        </div>
      </div>
    </Teleport>

    <!-- Claim modal -->
    <Teleport to="body">
      <div
        v-if="showClaim"
        class="fixed inset-0 z-50 grid place-items-center bg-overlay/80 backdrop-blur-sm px-4 py-8"
        @click.self="showClaim = false"
      >
        <div class="reveal w-full max-w-md border border-surface-rim bg-surface-elev shadow-pop">
          <header class="border-b border-surface-rim px-6 py-5">
            <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Earn points</p>
            <h2 class="mt-1 font-display text-2xl font-light leading-tight text-fg">
              Submit a receipt.
            </h2>
          </header>

          <form class="space-y-5 px-6 py-6" @submit.prevent="submitClaimForm">
            <div>
              <InputLabel for="amount" value="Receipt total (USD)" />
              <input
                id="amount"
                v-model.number="claim.amount"
                type="number"
                step="0.01"
                min="1"
                required
                class="w-full border-0 border-b border-fg/30 bg-transparent px-0 py-2 text-2xl text-fg focus:border-clover focus:outline-none focus:ring-0"
              />
              <p class="mt-2 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
                <span v-if="previewPoints > 0">
                  You'll earn <span class="text-clover">{{ previewPoints }} pts</span> once approved.
                </span>
                <span v-else>Receipt must be at least $1 to earn points.</span>
              </p>
            </div>

            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">
              Claims need admin approval before points are credited.
            </p>

            <InputError :message="claimError" />
            <p v-if="claimSuccess" class="font-mono text-[11px] tracking-[0.04em] text-clover">
              Submitted! We'll notify you when it's approved.
            </p>

            <div class="flex items-center justify-end gap-3 border-t border-surface-rim pt-5">
              <SecondaryButton type="button" @click="showClaim = false">Cancel</SecondaryButton>
              <PrimaryButton :disabled="claimSubmitting || previewPoints <= 0 || claimSuccess">
                {{ claimSubmitting ? 'Submitting…' : 'Submit claim' }}
                <span class="text-base">→</span>
              </PrimaryButton>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
