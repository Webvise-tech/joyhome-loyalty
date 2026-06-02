<script setup lang="ts">
const model = defineModel<string>({ default: '' })

defineProps<{
  type?: string
  placeholder?: string
  required?: boolean
  autocomplete?: string
  minlength?: number
  maxlength?: number
  id?: string
}>()
</script>

<template>
  <input
    :id="id"
    v-model="model"
    :type="type ?? 'text'"
    :placeholder="placeholder"
    :required="required"
    :autocomplete="autocomplete"
    :minlength="minlength"
    :maxlength="maxlength"
    class="w-full border-0 border-b border-fg/30 bg-transparent px-0 py-2 text-[15px] text-fg shadow-none transition-colors placeholder:text-fg-mute focus:border-clover focus:outline-none focus:ring-0"
  />
</template>
