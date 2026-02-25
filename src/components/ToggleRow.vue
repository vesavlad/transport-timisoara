<script setup lang="ts">
import type { PropType } from 'vue'

defineProps({
  label: { type: String, required: true },
  description: { type: String as PropType<string | undefined>, default: undefined },
  modelValue: { type: Boolean, required: true },
  disabled: { type: Boolean, default: false },
})

defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
</script>

<template>
  <label class="flex items-center justify-between gap-3 rounded-xl border border-base-300 bg-base-200 p-3">
    <div class="min-w-0">
      <div class="text-sm font-medium text-base-content">{{ label }}</div>
      <div v-if="description" class="mt-0.5 text-xs text-base-content/70">{{ description }}</div>
    </div>

    <input
      class="relative inline-block h-6 w-11 cursor-pointer appearance-none rounded-full border border-base-300 bg-base-content/12 align-middle transition before:content-none after:absolute after:top-0.5 after:left-0.5 after:h-4.5 after:w-4.5 after:rounded-full after:bg-base-100 after:transition-transform checked:border-primary/70 checked:bg-primary/70 checked:after:translate-x-5 disabled:cursor-not-allowed disabled:opacity-50"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    >
  </label>
</template>
