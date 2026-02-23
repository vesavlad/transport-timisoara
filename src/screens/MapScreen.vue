<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import MapView from '../components/MapView.vue'
import Panel from '../components/Panel.vue'
import PanelContent from '../components/PanelContent.vue'
import { isDark } from '../composables/dark'
import { useMediaQuery } from '../composables/useMediaQuery'
import { useMapStore } from '../stores/mapStore'

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
  if (selectedRouteId.value)
    return `/route/${encodeURIComponent(selectedRouteId.value)}`
  if (route.name === 'routes')
    return '/routes'
  return '/'
})

type MobilePanelMode = 'peek' | 'half' | 'full'
const MOBILE_PANEL_DVH: Record<MobilePanelMode, number> = {
  peek: 32,
  half: 58,
  full: 100,
}
const MOBILE_PANEL_MIN_DVH = 28
const MOBILE_PANEL_MAX_DVH = 100

const mobilePanelMode = ref<MobilePanelMode>('half')
const mobilePanelHeightDvh = ref<number>(MOBILE_PANEL_DVH.half)
const isDraggingPanel = ref(false)
const panelDragStartY = ref(0)
const panelDragStartDvh = ref(MOBILE_PANEL_DVH.half)
const isMobile = useMediaQuery('(max-width: 767px)')

const mobilePanelInlineStyle = computed(() => {
  if (!isMobile.value)
    return {}
  return {
    height: `calc(${mobilePanelHeightDvh.value}dvh - env(safe-area-inset-bottom))`,
  }
})

const mobilePanelModeLabel = computed(() => {
  if (mobilePanelMode.value === 'peek')
    return 'Peek'
  if (mobilePanelMode.value === 'full')
    return 'Full'
  return 'Half'
})

const showFloatingThemeToggle = computed(() => {
  if (!isMobile.value)
    return true
  return mobilePanelMode.value !== 'full'
})

function cycleMobilePanelMode() {
  if (mobilePanelMode.value === 'peek') {
    mobilePanelMode.value = 'half'
    mobilePanelHeightDvh.value = MOBILE_PANEL_DVH.half
    return
  }
  if (mobilePanelMode.value === 'half') {
    mobilePanelMode.value = 'full'
    mobilePanelHeightDvh.value = MOBILE_PANEL_DVH.full
    return
  }
  mobilePanelMode.value = 'peek'
  mobilePanelHeightDvh.value = MOBILE_PANEL_DVH.peek
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function nearestPanelMode(heightDvh: number): MobilePanelMode {
  const entries = Object.entries(MOBILE_PANEL_DVH) as Array<[MobilePanelMode, number]>
  let best: MobilePanelMode = 'half'
  let bestDistance = Number.POSITIVE_INFINITY

  for (const [mode, dvh] of entries) {
    const distance = Math.abs(heightDvh - dvh)
    if (distance < bestDistance) {
      bestDistance = distance
      best = mode
    }
  }

  return best
}

function onPanelPointerMove(event: PointerEvent) {
  if (!isDraggingPanel.value || !isMobile.value)
    return

  const viewportHeight = window.innerHeight || 1
  const deltaPx = panelDragStartY.value - event.clientY
  const deltaDvh = (deltaPx / viewportHeight) * 100
  const nextHeightDvh = panelDragStartDvh.value + deltaDvh

  mobilePanelHeightDvh.value = clamp(nextHeightDvh, MOBILE_PANEL_MIN_DVH, MOBILE_PANEL_MAX_DVH)
}

function stopPanelDragging() {
  if (!isDraggingPanel.value)
    return

  isDraggingPanel.value = false
  window.removeEventListener('pointermove', onPanelPointerMove)
  window.removeEventListener('pointerup', stopPanelDragging)
  window.removeEventListener('pointercancel', stopPanelDragging)

  const snappedMode = nearestPanelMode(mobilePanelHeightDvh.value)
  mobilePanelMode.value = snappedMode
  mobilePanelHeightDvh.value = MOBILE_PANEL_DVH[snappedMode]
}

function onPanelHandlePointerDown(event: PointerEvent) {
  if (!isMobile.value)
    return
  if (event.pointerType === 'mouse' && event.button !== 0)
    return

  isDraggingPanel.value = true
  panelDragStartY.value = event.clientY
  panelDragStartDvh.value = mobilePanelHeightDvh.value

  window.addEventListener('pointermove', onPanelPointerMove)
  window.addEventListener('pointerup', stopPanelDragging)
  window.addEventListener('pointercancel', stopPanelDragging)
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPanelPointerMove)
  window.removeEventListener('pointerup', stopPanelDragging)
  window.removeEventListener('pointercancel', stopPanelDragging)
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
  <div class="flex h-full w-full bg-base-200">
    <div
      class="pointer-events-none absolute right-3 top-3 z-30 transition-opacity duration-200 md:right-4 md:top-4"
      :class="showFloatingThemeToggle ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <label
        class="swap swap-rotate pointer-events-auto inline-flex rounded-box border border-base-300 bg-base-100/95 p-2 text-base-content shadow-lg backdrop-blur"
        aria-label="Toggle dark mode"
        title="Toggle dark mode"
      >
        <input v-model="isDark" type="checkbox" class="sr-only">

        <svg
          class="swap-off h-5 w-5 fill-current"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z" /></svg>

        <svg
          class="swap-on h-5 w-5 fill-current"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          aria-hidden="true"
        ><path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z" /></svg>
      </label>
    </div>

    <div class="pointer-events-none">
      <div class="flex h-full items-end md:items-start">
        <div
          class="pointer-events-auto w-full max-w-xl pb-[env(safe-area-inset-bottom)] md:h-full md:w-95 md:max-w-none md:pb-0"
          :style="mobilePanelInlineStyle"
        >
          <div class="card relative h-full overflow-hidden rounded-none border-x-0 border-b-0 border-base-300 bg-base-100/98 shadow-none md:rounded-box md:border md:bg-base-100/95 md:shadow-2xl">
            <div class="flex items-center justify-center gap-2 pt-1.5 pb-0.5 md:hidden">
              <button
                type="button"
                class="h-3 w-12 rounded-full bg-base-content/25 touch-none cursor-row-resize active:scale-95"
                aria-label="Drag to resize panel"
                title="Drag to resize panel"
                @pointerdown="onPanelHandlePointerDown"
              />
              <button
                type="button"
                class="btn btn-xs btn-ghost"
                :aria-label="`Panel size: ${mobilePanelModeLabel}. Tap to switch size.`"
                :title="`Panel size: ${mobilePanelModeLabel}`"
                @pointerdown.stop
                @click="cycleMobilePanelMode"
              >
                {{ mobilePanelModeLabel }}
              </button>
            </div>
            <Panel>
              <PanelContent />
            </Panel>
          </div>
        </div>
      </div>
    </div>

    <MapView />
  </div>
</template>
