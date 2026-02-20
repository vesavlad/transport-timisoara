<script setup lang="ts">
import type { Vehicle } from '../data/types'
import { computed } from 'vue'

const props = defineProps<{
  vehicles: Vehicle[]
  selectedVehicleId: string | null
}>()

const emit = defineEmits<{ (e: 'select', id: string): void }>()

const sorted = computed(() => {
  return [...props.vehicles].sort((a, b) => (a.label ?? a.id).localeCompare(b.label ?? b.id))
})
</script>

<template>
  <div class="space-y-2">
    <div class="text-xs uppercase tracking-wide text-app-muted">
      Vehicles
    </div>
    <div v-if="sorted.length === 0" class="text-sm text-app-muted">
      No vehicles reported.
    </div>

    <div v-else class="space-y-2">
      <button
        v-for="v in sorted"
        :key="v.id"
        type="button"
        class="w-full rounded-xl border px-3 py-2 text-left transition"
        :class="
          v.id === selectedVehicleId
            ? 'border-app-border bg-app-panel2 text-app-text'
            : 'border-app-border/60 bg-transparent text-app-muted hover:bg-app-panel2/40'
        "
        @click="emit('select', v.id)"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="truncate text-sm font-medium">
            {{ v.label ?? 'Vehicle' }}
            <span class="ml-2 text-xs text-app-muted">({{ v.id }})</span>
          </div>
          <div class="text-xs text-app-muted">
            {{ new Date(v.updatedAt).toLocaleTimeString() }}
          </div>
        </div>
      </button>
    </div>
  </div>
</template>
