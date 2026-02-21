<script setup lang="ts">
import type { Stop } from '../../data/types'

import { computed } from 'vue'

const props = defineProps<{
  stop: Stop
  selectedStopId: string | null
  direction: 'tur' | 'retur'
  displayTime: string
  displayMinutes: string | null
}>()

defineEmits<{
  open: [stopId: string]
}>()

const isSelected = computed(() => props.selectedStopId === props.stop.id)

const markerClass = computed(() => {
  if (isSelected.value) {
    return props.direction === 'tur'
      ? 'border-info bg-info/30'
      : 'border-secondary bg-secondary/30'
  }

  return 'border-red-300 bg-base-100'
})

const rowClass = computed(() => {
  if (isSelected.value) {
    return props.direction === 'tur'
      ? 'border-info/40 bg-info/10 shadow-sm'
      : 'border-secondary/40 bg-secondary/10 shadow-sm'
  }

  return 'border-transparent hover:border-base-300 hover:bg-base-200/70'
})
</script>

<template>
  <div class="relative mt-1">
    <span
      class="absolute left-1.25 top-3 h-3 w-3 rounded-full border-2"
      :class="markerClass"
    />
    <button
      type="button"
      class="w-full rounded-box border py-2 pl-7 pr-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      :class="rowClass"
      :data-stop-id="stop.id"
      @click="$emit('open', stop.id)"
    >
      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2">
          <span class="truncate text-[15px] font-semibold text-base-content">
            {{ stop.name }}
          </span>
        </div>
        <div class="flex shrink-0 flex-col items-end gap-1">
          <span class="font-mono text-sm font-medium text-base-content/70">
            {{ displayTime }}
          </span>
        </div>
      </div>
    </button>
  </div>
</template>
