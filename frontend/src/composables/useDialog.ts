import { reactive } from 'vue'

export type DialogTone = 'default' | 'danger'
export type DialogType = 'confirm' | 'prompt' | 'alert'

interface DialogState {
  open: boolean
  type: DialogType
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  promptInitial: string
  promptPlaceholder?: string
  tone: DialogTone
  resolver: ((value: any) => void) | null
}

const state = reactive<DialogState>({
  open: false,
  type: 'confirm',
  message: '',
  promptInitial: '',
  tone: 'default',
  resolver: null,
})

function close(value: any) {
  if (state.resolver) state.resolver(value)
  state.resolver = null
  state.open = false
}

interface ConfirmOpts {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: DialogTone
}

interface PromptOpts {
  title?: string
  message: string
  placeholder?: string
  initial?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: DialogTone
}

interface AlertOpts {
  title?: string
  message: string
  confirmLabel?: string
  tone?: DialogTone
}

export function useDialog() {
  function confirm(opts: ConfirmOpts): Promise<boolean> {
    return new Promise((resolve) => {
      state.type = 'confirm'
      state.title = opts.title
      state.message = opts.message
      state.confirmLabel = opts.confirmLabel
      state.cancelLabel = opts.cancelLabel
      state.tone = opts.tone ?? 'default'
      state.resolver = resolve
      state.open = true
    })
  }

  function prompt(opts: PromptOpts): Promise<string | null> {
    return new Promise((resolve) => {
      state.type = 'prompt'
      state.title = opts.title
      state.message = opts.message
      state.confirmLabel = opts.confirmLabel
      state.cancelLabel = opts.cancelLabel
      state.promptPlaceholder = opts.placeholder
      state.promptInitial = opts.initial ?? ''
      state.tone = opts.tone ?? 'default'
      state.resolver = resolve
      state.open = true
    })
  }

  function alert(opts: AlertOpts): Promise<void> {
    return new Promise((resolve) => {
      state.type = 'alert'
      state.title = opts.title
      state.message = opts.message
      state.confirmLabel = opts.confirmLabel
      state.tone = opts.tone ?? 'default'
      state.resolver = resolve
      state.open = true
    })
  }

  return { state, close, confirm, prompt, alert }
}
