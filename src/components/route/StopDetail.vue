<script setup lang="ts">
import type { Stop } from '../../data/types'

import { computed } from 'vue'

const props = defineProps<{
  stop: Stop
  selectedStopId: string | null
  direction: 'tur' | 'retur'
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

const etaBadgeClass = computed(() => {
  const minutes = props.displayMinutes
  if (minutes == null)
    return 'badge-ghost'
  if (minutes === 'due')
    return 'badge-success'
  const value = Number.parseInt(minutes, 10)
  if (Number.isFinite(value) && value <= 5)
    return 'badge-warning'
  return 'badge-neutral'
})
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="w-full rounded-box border px-3 py-1.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      :class="rowClass"
      :data-stop-id="stop.id"
      @click="$emit('open', stop.id)"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <span class="truncate text-[13px] font-medium text-base-content">
            {{ stop.name }}
          </span>
        </div>
        <span class="badge shrink-0 badge-xs" :class="etaBadgeClass">
          {{ displayMinutes ?? '—' }}
        </span>
      </div>
    </button>
  </div>
</template>
