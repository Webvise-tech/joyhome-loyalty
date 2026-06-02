<script setup lang="ts">
import { onMounted, ref, reactive, computed } from 'vue'
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { uploadImage } from '../../api/client'
import { useDialog } from '../../composables/useDialog'
import InputLabel from '../../components/InputLabel.vue'
import InputError from '../../components/InputError.vue'
import TextInput from '../../components/TextInput.vue'
import PrimaryButton from '../../components/PrimaryButton.vue'
import SecondaryButton from '../../components/SecondaryButton.vue'

interface CatalogueItem {
  id: string
  name: string
  photo_url: string | null
  points_cost: number
  category: string | null
  stock_qty: number
  is_active: boolean
  added_at?: string
}

const items = ref<CatalogueItem[]>([])
const loadingList = ref(false)
const listError = ref<string | null>(null)

const showForm = ref(false)
const submitting = ref(false)
const formError = ref<string | null>(null)
const editingItem = ref<CatalogueItem | null>(null)
const existingPhotoUrl = ref<string | null>(null)

const form = reactive({
  name: '',
  points_cost: 0,
  category: '',
  stock_qty: 0,
  is_active: true,
})
const imageFile = ref<File | null>(null)
const imagePreview = ref<string | null>(null)

const isEditing = computed(() => editingItem.value !== null)

function resetForm() {
  form.name = ''
  form.points_cost = 0
  form.category = ''
  form.stock_qty = 0
  form.is_active = true
  imageFile.value = null
  imagePreview.value = null
  existingPhotoUrl.value = null
  editingItem.value = null
  formError.value = null
}

function openCreate() {
  resetForm()
  showForm.value = true
}

function openEdit(item: CatalogueItem) {
  editingItem.value = item
  form.name = item.name
  form.points_cost = item.points_cost
  form.category = item.category ?? ''
  form.stock_qty = item.stock_qty
  form.is_active = item.is_active
  existingPhotoUrl.value = item.photo_url
  imageFile.value = null
  imagePreview.value = null
  formError.value = null
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  resetForm()
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) {
    imageFile.value = null
    imagePreview.value = null
    return
  }
  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
}

const submitDisabled = computed(
  () => submitting.value || !form.name.trim() || form.points_cost < 1,
)

async function loadItems() {
  loadingList.value = true
  listError.value = null
  try {
    const q = query(collection(db, 'catalogue'), orderBy('added_at', 'desc'))
    const snap = await getDocs(q)
    items.value = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<CatalogueItem, 'id'>) }),
    )
  } catch (e: any) {
    listError.value = e.message ?? 'Failed to load catalogue.'
  } finally {
    loadingList.value = false
  }
}

async function submit() {
  submitting.value = true
  formError.value = null
  try {
    let photo_url: string | null = existingPhotoUrl.value
    if (imageFile.value) {
      photo_url = await uploadImage(imageFile.value, 'catalogue')
    }

    const payload = {
      name: form.name.trim(),
      photo_url,
      points_cost: Number(form.points_cost),
      category: form.category.trim() || null,
      stock_qty: Number(form.stock_qty),
      is_active: form.is_active,
    }

    if (editingItem.value) {
      await updateDoc(doc(db, 'catalogue', editingItem.value.id), payload)
    } else {
      await addDoc(collection(db, 'catalogue'), {
        ...payload,
        added_at: serverTimestamp(),
      })
    }

    closeForm()
    await loadItems()
  } catch (e: any) {
    formError.value = e?.message ?? 'Failed to save item.'
  } finally {
    submitting.value = false
  }
}

async function toggleActive(item: CatalogueItem) {
  try {
    await updateDoc(doc(db, 'catalogue', item.id), { is_active: !item.is_active })
    await loadItems()
  } catch (e: any) {
    listError.value = e?.message ?? 'Failed to update item.'
  }
}

const dialog = useDialog()

async function remove(item: CatalogueItem) {
  const ok = await dialog.confirm({
    title: 'Delete item',
    message: `Delete "${item.name}"?\nThis cannot be undone.`,
    confirmLabel: 'Delete',
    cancelLabel: 'Keep it',
    tone: 'danger',
  })
  if (!ok) return
  try {
    await deleteDoc(doc(db, 'catalogue', item.id))
    await loadItems()
  } catch (e: any) {
    listError.value = e?.message ?? 'Failed to delete item.'
  }
}

onMounted(loadItems)
</script>

<template>
  <div class="space-y-10">
    <header
      class="reveal-child section-rule flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Rewards</p>
        <h1
          class="mt-2 font-display text-4xl font-light leading-none tracking-tight text-fg sm:text-5xl"
        >
          Catalogue.
        </h1>
        <p class="mt-3 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
          {{ items.length }} item{{ items.length === 1 ? '' : 's' }} in the weekly rewards catalogue.
        </p>
      </div>
      <PrimaryButton type="button" @click="openCreate">
        + New item
      </PrimaryButton>
    </header>

    <section class="reveal-child">
      <p v-if="listError" class="font-mono text-[11px] tracking-[0.04em] text-oxblood">
        {{ listError }}
      </p>

      <div v-if="loadingList && !items.length" class="border-t border-surface-rim py-24 text-center">
        <p class="font-display text-2xl font-light italic text-fg-mute">Loading…</p>
      </div>

      <div v-else-if="!items.length" class="border-t border-surface-rim py-24 text-center">
        <p class="font-display text-2xl font-light italic text-fg-soft">Empty catalogue.</p>
        <p class="mt-2 font-mono text-[11px] tracking-[0.04em] text-fg-mute">
          Click "+ New item" to add your first reward.
        </p>
      </div>

      <table v-else class="w-full">
        <thead>
          <tr class="border-b border-surface-rim text-left">
            <th class="py-3 pr-6 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Item</th>
            <th class="py-3 pr-6 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Category</th>
            <th class="py-3 pr-6 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Points</th>
            <th class="py-3 pr-6 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Stock</th>
            <th class="py-3 pr-6 font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Status</th>
            <th class="py-3 pr-0 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in items"
            :key="item.id"
            class="cursor-pointer border-b border-surface-rim transition-colors hover:bg-clover/5"
            @click="openEdit(item)"
          >
            <td class="py-4 pr-6">
              <div class="flex items-center gap-3">
                <img
                  v-if="item.photo_url"
                  :src="item.photo_url"
                  :alt="item.name"
                  class="h-12 w-12 border border-surface-rim object-cover"
                />
                <div
                  v-else
                  class="grid h-12 w-12 place-items-center border border-surface-rim bg-surface text-[10px] text-fg-mute"
                >
                  no img
                </div>
                <span class="text-[15px] text-fg">{{ item.name }}</span>
              </div>
            </td>
            <td class="py-4 pr-6 font-mono text-[12px] text-fg-soft">{{ item.category || '—' }}</td>
            <td class="py-4 pr-6 text-right font-mono tabular-nums text-[14px] text-fg">
              {{ item.points_cost }} pts
            </td>
            <td class="py-4 pr-6 text-right font-mono tabular-nums text-[14px] text-fg">
              {{ item.stock_qty }}
            </td>
            <td class="py-4 pr-6">
              <span
                class="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em]"
                :class="item.is_active ? 'text-clover' : 'text-fg-mute'"
              >
                <span
                  class="inline-block h-1.5 w-1.5"
                  :class="item.is_active ? 'bg-clover' : 'bg-fg-mute'"
                />
                {{ item.is_active ? 'Active' : 'Hidden' }}
              </span>
            </td>
            <td class="py-4 pr-0 text-right">
              <div class="inline-flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.18em]">
                <button class="text-fg-soft hover:text-clover" @click.stop="toggleActive(item)">
                  {{ item.is_active ? 'Hide' : 'Show' }}
                </button>
                <button class="text-fg-soft hover:text-oxblood" @click.stop="remove(item)">
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Catalogue item modal (create + edit) -->
    <Teleport to="body">
      <div
        v-if="showForm"
        class="fixed inset-0 z-50 grid place-items-center bg-overlay/80 backdrop-blur-sm px-4 py-8"
        @click.self="closeForm"
      >
        <div class="reveal w-full max-w-lg border border-surface-rim bg-surface-elev shadow-pop">
          <header class="border-b border-surface-rim px-6 py-5">
            <p class="font-mono text-[10px] uppercase tracking-[0.22em] text-fg-mute">Rewards</p>
            <h2 class="mt-1 font-display text-2xl font-light leading-tight text-fg">
              {{ isEditing ? 'Edit catalogue item.' : 'New catalogue item.' }}
            </h2>
          </header>

          <form class="space-y-5 px-6 py-6" @submit.prevent="submit">
            <div>
              <InputLabel for="name" value="Name" />
              <TextInput id="name" v-model="form.name" required />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <InputLabel for="points" value="Points cost" />
                <input
                  id="points"
                  v-model.number="form.points_cost"
                  type="number"
                  min="1"
                  required
                  class="w-full border-0 border-b border-fg/30 bg-transparent px-0 py-2 text-[15px] text-fg focus:border-clover focus:outline-none focus:ring-0"
                />
              </div>
              <div>
                <InputLabel for="stock" value="Stock qty" />
                <input
                  id="stock"
                  v-model.number="form.stock_qty"
                  type="number"
                  min="0"
                  required
                  class="w-full border-0 border-b border-fg/30 bg-transparent px-0 py-2 text-[15px] text-fg focus:border-clover focus:outline-none focus:ring-0"
                />
              </div>
            </div>

            <div>
              <InputLabel for="category" value="Category (optional)" />
              <TextInput id="category" v-model="form.category" placeholder="e.g. Mugs, Decor" />
            </div>

            <div>
              <InputLabel value="Photo" />
              <div class="mt-2 flex items-center gap-4">
                <label
                  class="inline-flex cursor-pointer items-center border border-fg/20 bg-transparent px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-soft transition-colors hover:border-clover hover:text-clover"
                >
                  {{ imageFile ? 'Change' : isEditing && existingPhotoUrl ? 'Replace' : 'Choose file' }}
                  <input
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="onFileChange"
                  />
                </label>
                <span v-if="imageFile" class="font-mono text-[11px] tracking-[0.04em] text-fg-mute">
                  {{ imageFile.name }}
                </span>
                <span v-else-if="isEditing && existingPhotoUrl" class="font-mono text-[11px] tracking-[0.04em] text-fg-mute">
                  Keep current photo
                </span>
              </div>
              <img
                v-if="imagePreview"
                :src="imagePreview"
                alt="Preview"
                class="mt-3 h-24 w-24 border border-surface-rim object-cover"
              />
              <img
                v-else-if="isEditing && existingPhotoUrl"
                :src="existingPhotoUrl"
                alt="Current"
                class="mt-3 h-24 w-24 border border-surface-rim object-cover"
              />
            </div>

            <label class="flex cursor-pointer items-center gap-2">
              <input
                v-model="form.is_active"
                type="checkbox"
                class="h-4 w-4 accent-clover"
              />
              <span class="font-mono text-[11px] uppercase tracking-[0.18em] text-fg-soft">
                Visible to customers
              </span>
            </label>

            <InputError :message="formError" />

            <div class="flex items-center justify-end gap-3 border-t border-surface-rim pt-5">
              <SecondaryButton type="button" @click="closeForm">
                Cancel
              </SecondaryButton>
              <PrimaryButton :disabled="submitDisabled">
                {{ submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Add item' }}
                <span class="text-base">→</span>
              </PrimaryButton>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
