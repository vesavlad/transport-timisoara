<script setup lang="ts">
import type { Vehicle } from '../data/types'
import { computed } from 'vue'

const props = defineProps<{
  vehicles: Vehicle[]
  selectedVehicleId: string | null
  isLoading?: boolean
}>()

const emit = defineEmits<{ (e: 'select', id: string): void }>()

const sorted = computed(() => {
  return [...props.vehicles].sort((a, b) => (a.label ?? a.id).localeCompare(b.label ?? b.id))
})
</script>

<template>
  <div class="space-y-2">
    <div class="text-xs uppercase tracking-wide text-base-content/70">
      Vehicles
    </div>

    <div v-if="props.isLoading" class="space-y-2">
      <div class="skeleton h-10 w-full" />
      <div class="skeleton h-10 w-full" />
      <div class="skeleton h-10 w-full" />
    </div>

    <div v-else-if="sorted.length === 0" class="text-sm text-base-content/70">
      No vehicles reported.
    </div>

    <ul v-else class="list rounded-box border border-base-300 bg-base-100">
      <li v-for="v in sorted" :key="v.id" class="list-row p-0">
        <button
          type="button"
          class="btn h-auto w-full justify-between rounded-none border-0 bg-transparent px-3 py-2 font-normal shadow-none"
          :class="v.id === selectedVehicleId ? 'btn-active btn-soft btn-primary' : 'btn-ghost'"
          @click="emit('select', v.id)"
        >
          <span class="truncate text-left text-sm">
            <span class="font-medium">{{ v.label ?? 'Vehicle' }}</span>
            <span class="badge badge-ghost badge-xs ml-2">{{ v.id }}</span>
          </span>
          <span class="text-xs opacity-70">
            {{ new Date(v.updatedAt).toLocaleTimeString() }}
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
