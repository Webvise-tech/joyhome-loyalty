<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useToast } from '../../composables/useToast'
import { usePagination } from '../../composables/usePagination'
import Pagination from '../../components/Pagination.vue'
import {
  adjustCustomerPoints,
  listCustomersWithTotals,
  type CustomerSummary,
} from '../../api/loyalty'
import InputLabel from '../../components/InputLabel.vue'
import InputError from '../../components/InputError.vue'
import TextInput from '../../components/TextInput.vue'
import PrimaryButton from '../../components/PrimaryButton.vue'
import SecondaryButton from '../../components/SecondaryButton.vue'

const auth = useAuthStore()
const toast = useToast()

const customers = ref<CustomerSummary[]>([])
const customersPg = usePagination(customers)
const loading = ref(false)
const error = ref<string | null>(null)

// Adjust-points modal
const editing = ref<CustomerSummary | null>(null)
const adjust = reactive({ delta: 0, reason: '' })
const adjustSubmitting = ref(false)
const adjustError = ref<string | null>(null)

const adjustPreview = computed(() => {
  if (!editing.value) return 0
  return Math.max(0, editing.value.current_balance + Math.trunc(Number(adjust.delta) || 0))
})

function fmtJoined(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtMoney(n: number): string {
  return `$${n.toFixed(2)}`
}

async function load() {
  loading.value = true
  error.value = null
  try {
    customers.value = await listCustomersWithTotals()
  } catch (e: any) {
    const message = e?.message ?? 'Failed to load customers.'
    error.value = message
    toast.error(message)
  } finally {
    loading.value = false
  }
}

function openEdit(c: CustomerSummary) {
  editing.value = c
  adjust.delta = 0
  adjust.reason = ''
  adjustError.value = null
}

function closeEdit() {
  editing.value = null
}

async function submitAdjust() {
  if (!editing.value || !auth.user) return
  adjustSubmitting.value = true
  adjustError.value = null
  const target = editing.value
  const delta = Math.trunc(Number(adjust.delta) || 0)
  try {
    await adjustCustomerPoints({
      customer_id: target.uid,
      delta: Number(adjust.delta),
      reason: adjust.reason,
      admin_uid: auth.user.uid,
    })
    const verb = delta >= 0 ? 'credited' : 'deducted'
    toast.success(`${Math.abs(delta)} pts ${verb} for ${target.first_name} ${target.last_name}.`)
    closeEdit()
    await load()
  } catch (e: any) {
    const message = e?.message ?? 'Failed to adjust points.'
    adjustError.value = message
    toast.error(message)
  } finally {
    adjustSubmitting.value = false
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
        <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Members</p>
        <h1
          class="mt-2 font-display text-4xl font-light leading-none tracking-tight text-fg sm:text-5xl"
        >
          Customers.
        </h1>
        <p class="mt-3 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
          {{ customers.length }} member{{ customers.length === 1 ? '' : 's' }} · sorted by balance · click any row to adjust points
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

      <div v-if="loading && !customers.length" class="border-t border-surface-rim py-24 text-center">
        <p class="font-display text-2xl font-light italic text-fg-mute">Loading…</p>
      </div>

      <div v-else-if="!customers.length" class="border-t border-surface-rim py-24 text-center">
        <p class="font-display text-2xl font-light italic text-fg-soft">No customers yet.</p>
        <p class="mt-2 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
          Customers appear here once they register at the main JoyHome page.
        </p>
      </div>

      <!-- Desktop: table -->
      <table v-else class="hidden w-full md:table">
        <thead>
          <tr class="border-b border-surface-rim text-left">
            <th class="py-3 pr-6 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Customer</th>
            <th class="py-3 pr-6 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Email</th>
            <th class="py-3 pr-6 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Phone</th>
            <th class="py-3 pr-6 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Receipts ($)</th>
            <th class="py-3 pr-6 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Earned</th>
            <th class="py-3 pr-6 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in customersPg.paged.value"
            :key="c.uid"
            class="cursor-pointer border-b border-surface-rim transition-colors hover:bg-clover/5"
            @click="openEdit(c)"
          >
            <td class="py-4 pr-6">
              <div class="text-[15px] text-fg">{{ c.first_name }} {{ c.last_name }}</div>
              <div class="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">
                Joined {{ fmtJoined(c.created_at) }}
              </div>
            </td>
            <td class="py-4 pr-6 font-mono text-[12px] text-fg-soft">{{ c.email || '—' }}</td>
            <td class="py-4 pr-6 font-mono text-[12px] text-fg-soft">{{ c.phone || '—' }}</td>
            <td class="py-4 pr-6 text-right">
              <div class="font-mono tabular-nums text-[14px] text-fg">
                {{ fmtMoney(c.receipts_total_usd) }}
              </div>
              <div class="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">
                {{ c.receipts_count }} receipt{{ c.receipts_count === 1 ? '' : 's' }}
              </div>
            </td>
            <td class="py-4 pr-6 text-right font-mono tabular-nums text-[14px] text-fg-soft">
              {{ c.points_earned }}
            </td>
            <td class="py-4 pr-6 text-right font-mono tabular-nums text-[16px] text-clover">
              {{ c.current_balance }}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Mobile: card list -->
      <ul v-if="customers.length" class="space-y-3 md:hidden">
        <li
          v-for="c in customersPg.paged.value"
          :key="c.uid"
          class="cursor-pointer border border-surface-rim bg-surface-elev p-4 transition-colors hover:border-clover/40 active:bg-clover/5"
          @click="openEdit(c)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <p class="truncate text-[15px] text-fg">
                {{ c.first_name }} {{ c.last_name }}
              </p>
              <p class="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">
                Joined {{ fmtJoined(c.created_at) }}
              </p>
            </div>
            <div class="flex-shrink-0 text-right">
              <p class="font-mono tabular-nums text-[18px] text-clover">{{ c.current_balance }}</p>
              <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-mute">balance</p>
            </div>
          </div>

          <div class="mt-3 space-y-1 border-t border-surface-rim/60 pt-3 font-mono text-[12px] text-fg-soft">
            <p class="flex justify-between gap-2">
              <span class="text-fg-mute">Email</span>
              <span class="truncate">{{ c.email || '—' }}</span>
            </p>
            <p class="flex justify-between gap-2">
              <span class="text-fg-mute">Phone</span>
              <span>{{ c.phone || '—' }}</span>
            </p>
          </div>

          <div class="mt-3 grid grid-cols-3 gap-2 border-t border-surface-rim/60 pt-3 text-center">
            <div>
              <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-mute">Receipts</p>
              <p class="font-mono tabular-nums text-[13px] text-fg">{{ fmtMoney(c.receipts_total_usd) }}</p>
              <p class="font-mono text-[9px] tracking-[0.04em] text-fg-mute">
                {{ c.receipts_count }}×
              </p>
            </div>
            <div>
              <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-mute">Earned</p>
              <p class="font-mono tabular-nums text-[13px] text-fg-soft">{{ c.points_earned }}</p>
            </div>
            <div>
              <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-mute">Balance</p>
              <p class="font-mono tabular-nums text-[13px] text-clover">{{ c.current_balance }}</p>
            </div>
          </div>
        </li>
      </ul>

      <Pagination
        v-model:page="customersPg.page.value"
        v-model:pageSize="customersPg.pageSize.value"
        :total-pages="customersPg.totalPages.value"
        :total="customersPg.total.value"
        :range-start="customersPg.rangeStart.value"
        :range-end="customersPg.rangeEnd.value"
      />
    </section>

    <!-- Adjust-points modal -->
    <Teleport to="body">
      <div
        v-if="editing"
        class="fixed inset-0 z-50 overflow-y-auto bg-overlay/80 backdrop-blur-sm"
        @click.self="closeEdit"
      >
        <div
          class="flex min-h-full items-start justify-center px-4 py-8 sm:items-center"
          @click.self="closeEdit"
        >
        <div class="reveal w-full max-w-md border border-surface-rim bg-surface-elev shadow-pop">
          <header class="border-b border-surface-rim px-6 py-5">
            <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Adjust points</p>
            <h2 class="mt-1 font-display text-2xl font-light leading-tight text-fg">
              {{ editing.first_name }} {{ editing.last_name }}.
            </h2>
            <p class="mt-1 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
              {{ editing.email }}
            </p>
          </header>

          <form class="space-y-5 px-6 py-6" @submit.prevent="submitAdjust">
            <div class="grid grid-cols-3 gap-3 border-y border-surface-rim py-4 text-center">
              <div>
                <p class="font-mono text-[9px] uppercase tracking-[0.2em] text-fg-mute">Current</p>
                <p class="mt-1 font-display text-2xl font-light text-fg tabular-nums">
                  {{ editing.current_balance }}
                </p>
              </div>
              <div>
                <p class="font-mono text-[9px] uppercase tracking-[0.2em] text-fg-mute">Delta</p>
                <p
                  class="mt-1 font-display text-2xl font-light tabular-nums"
                  :class="Number(adjust.delta) > 0 ? 'text-clover' : Number(adjust.delta) < 0 ? 'text-oxblood' : 'text-fg-mute'"
                >
                  {{ Number(adjust.delta) > 0 ? '+' : '' }}{{ Math.trunc(Number(adjust.delta) || 0) }}
                </p>
              </div>
              <div>
                <p class="font-mono text-[9px] uppercase tracking-[0.2em] text-fg-mute">After</p>
                <p class="mt-1 font-display text-2xl font-light text-clover tabular-nums">
                  {{ adjustPreview }}
                </p>
              </div>
            </div>

            <div>
              <InputLabel for="delta" value="Add or subtract points" />
              <input
                id="delta"
                v-model.number="adjust.delta"
                type="number"
                step="1"
                required
                placeholder="e.g. +50 or -10"
                class="w-full border-0 border-b border-fg/30 bg-transparent px-0 py-2 text-2xl text-fg focus:border-clover focus:outline-none focus:ring-0"
              />
              <p class="mt-1 font-mono text-[10px] tracking-[0.04em] text-fg-mute">
                Positive to credit, negative to deduct. Expires in 60 days (same as earned points).
              </p>
            </div>

            <div>
              <InputLabel for="reason" value="Reason (kept for audit)" />
              <TextInput
                id="reason"
                v-model="adjust.reason"
                required
                placeholder="e.g. Birthday bonus, manual correction"
              />
            </div>

            <InputError :message="adjustError" />

            <div class="flex items-center justify-end gap-3 border-t border-surface-rim pt-5">
              <SecondaryButton type="button" @click="closeEdit">Cancel</SecondaryButton>
              <PrimaryButton
                :disabled="adjustSubmitting || !Number(adjust.delta) || !adjust.reason.trim()"
              >
                {{ adjustSubmitting ? 'Saving…' : 'Apply adjustment' }}
                <span class="text-base">→</span>
              </PrimaryButton>
            </div>
          </form>
        </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
