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
  <label class="flex items-center justify-between gap-3 rounded-xl border border-app-border bg-app-panel2 p-3">
    <div class="min-w-0">
      <div class="text-sm font-medium text-app-text">{{ label }}</div>
      <div v-if="description" class="mt-0.5 text-xs text-app-muted">{{ description }}</div>
    </div>

    <input
      class="h-5 w-9 accent-blue-400"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    >
  </label>
</template>
