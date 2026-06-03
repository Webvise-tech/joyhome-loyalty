import { reactive } from 'vue'

export type ToastTone = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  tone: ToastTone
  title?: string
  message: string
  duration: number
}

interface ToastState {
  items: Toast[]
}

const state = reactive<ToastState>({ items: [] })
let nextId = 1

interface ToastOpts {
  title?: string
  duration?: number
}

function push(tone: ToastTone, message: string, opts: ToastOpts = {}): number {
  const id = nextId++
  const duration = opts.duration ?? (tone === 'error' ? 6000 : 4000)
  state.items.push({ id, tone, title: opts.title, message, duration })
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration)
  }
  return id
}

function dismiss(id: number) {
  const i = state.items.findIndex((t) => t.id === id)
  if (i >= 0) state.items.splice(i, 1)
}

export function useToast() {
  return {
    state,
    dismiss,
    success: (message: string, opts?: ToastOpts) => push('success', message, opts),
    error: (message: string, opts?: ToastOpts) => push('error', message, opts),
    info: (message: string, opts?: ToastOpts) => push('info', message, opts),
  }
}
