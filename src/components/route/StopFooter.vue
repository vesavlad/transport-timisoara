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
  <div class="relative">
    <button
      type="button"
      class="w-full rounded-box border px-3 py-2 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      :class="rowClass"
      :data-stop-id="stop.id"
      @click="$emit('open', stop.id)"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2">
          <span class="truncate text-[18px] font-semibold text-base-content">
            {{ stop.name }}
          </span>
        </div>
        <div class="flex shrink-0 flex-col items-end gap-1">
          <span class="font-mono text-sm font-medium text-base-content/70">
            {{ displayTime }}
          </span>
        </div>
      </div>

      <div class="mt-1 flex items-start justify-between gap-2">
        <div class="truncate text-xs text-base-content/70">
          • Final stop
        </div>
        <div class="badge badge-xs badge-neutral shrink-0 text-[11px] text-base-content/60">
          {{ displayMinutes ? `ETA ${displayMinutes}` : 'ETA unavailable' }}
        </div>
      </div>
    </button>
  </div>
</template>
