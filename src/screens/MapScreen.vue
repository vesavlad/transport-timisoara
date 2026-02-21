<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'

import LayerToggles from '../components/LayerToggles.vue'
import Panel from '../components/Panel.vue'
import PanelContent from '../components/PanelContent.vue'
import { isDark } from '../composables/dark'
import MapView from '../map/MapView.vue'
import { useMapStore } from '../state/mapStore'

const store = useMapStore()
const route = useRoute()
const router = useRouter()

const { selectedRouteId, selectedStopId } = storeToRefs(store)

const routeParamsSelection = computed(() => {
  const routeId = typeof route.params.routeId === 'string' ? route.params.routeId : null
  const stopId = typeof route.params.stopId === 'string' ? route.params.stopId : null
  return {
    routeId,
    stopId,
  }
})

const targetPathFromStore = computed(() => {
  if (selectedRouteId.value && selectedStopId.value)
    return `/route/${encodeURIComponent(selectedRouteId.value)}/stop/${encodeURIComponent(selectedStopId.value)}`
  if (selectedRouteId.value)
    return `/route/${encodeURIComponent(selectedRouteId.value)}`
  return '/'
})

watch(
  routeParamsSelection,
  ({ routeId, stopId }) => {
    if (routeId !== selectedRouteId.value)
      store.selectRoute(routeId)

    if (stopId !== selectedStopId.value)
      store.selectStop(stopId)
  },
  { immediate: true },
)

watch(
  targetPathFromStore,
  (targetPath) => {
    if (route.path === targetPath)
      return
    router.push(targetPath)
  },
)
</script>

<template>
  <div class="relative h-full w-full bg-base-200">
    <MapView />

    <div class="pointer-events-none absolute right-3 top-3 z-30 md:right-4 md:top-4">
      <label
        class="pointer-events-auto inline-flex items-center gap-2 rounded-box border border-base-300 bg-base-100/95 px-3 py-2 text-xs font-medium text-base-content shadow-lg backdrop-blur"
      >
        <span>Dark mode</span>
        <input v-model="isDark" type="checkbox" class="toggle toggle-primary toggle-sm">
      </label>
    </div>

    <div class="pointer-events-none absolute bottom-3 right-3 z-30 md:bottom-4 md:right-4">
      <div
        class="pointer-events-auto "
      >
        <LayerToggles />
      </div>
    </div>

    <div class="pointer-events-none absolute inset-0 z-20 p-3 md:p-4">
      <div class="flex h-full items-end md:items-start">
        <div class="pointer-events-auto h-[65%] w-full max-w-xl md:h-full md:w-95 md:max-w-none">
          <div class="card h-full overflow-hidden border border-base-300 bg-base-100/95 shadow-2xl backdrop-blur">
            <Panel>
              <PanelContent />
            </Panel>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
