import { computed, ref, watch, type Ref, type ComputedRef } from 'vue'

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

interface UsePaginationOpts {
  defaultPageSize?: PageSize
}

export interface UsePaginationReturn<T> {
  page: Ref<number>
  pageSize: Ref<PageSize>
  total: ComputedRef<number>
  totalPages: ComputedRef<number>
  paged: ComputedRef<T[]>
  rangeStart: ComputedRef<number>
  rangeEnd: ComputedRef<number>
  reset: () => void
}

/**
 * Paginate any reactive source array. The list is sliced reactively, the page
 * auto-clamps when the source shrinks, and switching page size resets to page 1.
 */
export function usePagination<T>(
  source: Ref<T[]> | ComputedRef<T[]>,
  opts: UsePaginationOpts = {},
): UsePaginationReturn<T> {
  const page = ref(1)
  const pageSize = ref<PageSize>(opts.defaultPageSize ?? 10)

  const total = computed(() => source.value.length)
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

  // Reset to page 1 when page size changes.
  watch(pageSize, () => {
    page.value = 1
  })

  // Clamp page if source shrinks (e.g. after a filter or delete).
  watch(total, () => {
    if (page.value > totalPages.value) {
      page.value = totalPages.value
    }
  })

  const paged = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return source.value.slice(start, start + pageSize.value)
  })

  const rangeStart = computed(() => (total.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1))
  const rangeEnd = computed(() => Math.min(page.value * pageSize.value, total.value))

  function reset() {
    page.value = 1
  }

  return { page, pageSize, total, totalPages, paged, rangeStart, rangeEnd, reset }
}
