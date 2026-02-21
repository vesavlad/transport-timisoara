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
  <label class="flex items-center justify-between gap-3 rounded-box border border-base-300 bg-base-200 p-3">
    <div class="min-w-0">
      <div class="text-sm font-medium text-base-content">{{ label }}</div>
      <div v-if="description" class="mt-0.5 text-xs text-base-content/70">{{ description }}</div>
    </div>

    <input
      class="toggle toggle-primary"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    >
  </label>
</template>
