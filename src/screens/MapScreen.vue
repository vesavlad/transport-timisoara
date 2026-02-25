<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import MapView from '../components/MapView.vue'
import Panel from '../components/Panel.vue'
import PanelContent from '../components/PanelContent.vue'
import ThemeToggleButton from '../components/ThemeToggleButton.vue'
import { useAppMediaQuery } from '../composables/useMediaQuery'
import { useMapStore } from '../stores/mapStore'

type PanelPage = 'home' | 'routes' | 'route' | 'stop'

defineProps<{
  panelPage?: PanelPage
}>()

const store = useMapStore()
const route = useRoute()
const router = useRouter()

const { selectedRouteId, selectedStopId } = storeToRefs(store)

const routeParamsSelection = computed(() => {
  const routeId = typeof route.params.routeId === 'string' ? route.params.routeId : null
  const stopId = typeof route.params.stopId === 'string' ? route.params.stopId : null
  const isStopRoute = route.name === 'stop'
  return {
    routeId,
    stopId,
    isStopRoute,
  }
})

const targetPathFromStore = computed(() => {
  if (selectedStopId.value)
    return `/stop/${encodeURIComponent(selectedStopId.value)}`
  if (selectedRouteId.value)
    return `/route/${encodeURIComponent(selectedRouteId.value)}`
  if (route.name === 'routes')
    return '/routes'
  return '/'
})

type MobilePanelMode = 'peek' | 'half' | 'full'
type MobileViewportMode = 'map' | 'split' | 'panel'
const MOBILE_PANEL_DVH: Record<MobilePanelMode, number> = {
  peek: 36,
  half: 70,
  full: 100,
}
const MOBILE_PANEL_MIN_DVH = 34
const MOBILE_PANEL_MAX_DVH = 100

const mobilePanelMode = ref<MobilePanelMode>('full')
const mobileViewportMode = ref<MobileViewportMode>('panel')
const mobilePanelHeightDvh = ref<number>(MOBILE_PANEL_DVH.half)
const isDraggingPanel = ref(false)
const panelDragStartY = ref(0)
const panelDragStartDvh = ref(MOBILE_PANEL_DVH.half)
const isMobile = useAppMediaQuery('(max-width: 767px)')
const prefersReducedMotion = useAppMediaQuery('(prefers-reduced-motion: reduce)')

const panelTransitionClass = computed(() => {
  if (!isMobile.value)
    return ''
  return prefersReducedMotion.value ? 'transition-none' : 'transition-all duration-200 ease-out'
})

const showPanel = computed(() => {
  if (!isMobile.value)
    return true
  return mobileViewportMode.value !== 'map'
})

const mobilePanelInlineStyle = computed(() => {
  if (!isMobile.value)
    return {}

  if (mobileViewportMode.value === 'panel') {
    return {
      height: 'calc(100dvh - env(safe-area-inset-bottom))',
    }
  }

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

const mobileSheetCardClass = computed(() => {
  if (!isMobile.value)
    return ''
  if (mobilePanelMode.value === 'full')
    return 'shadow-none'
  if (mobilePanelMode.value === 'peek')
    return 'shadow-[0_-18px_34px_-18px_rgba(0,0,0,0.48)]'
  return 'shadow-[0_-14px_30px_-16px_rgba(0,0,0,0.38)]'
})

const mobileHandleClass = computed(() => {
  if (!isMobile.value)
    return ''
  if (mobilePanelMode.value === 'peek')
    return 'h-3.5 w-14 bg-base-content/45 shadow-[0_0_0_1px_rgba(255,255,255,0.22)]'
  if (mobilePanelMode.value === 'full')
    return 'h-2.5 w-12 bg-base-content/20'
  return 'h-3 w-12 bg-base-content/30'
})

function cycleMobilePanelMode() {
  if (mobileViewportMode.value !== 'split')
    mobileViewportMode.value = 'split'

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

function setMobileViewportMode(mode: MobileViewportMode) {
  if (!isMobile.value)
    return

  mobileViewportMode.value = mode

  if (mode === 'panel') {
    mobilePanelMode.value = 'full'
    mobilePanelHeightDvh.value = MOBILE_PANEL_DVH.full
    return
  }

  if (mode === 'split') {
    if (mobilePanelMode.value === 'full') {
      mobilePanelMode.value = 'half'
      mobilePanelHeightDvh.value = MOBILE_PANEL_DVH.half
      return
    }
    mobilePanelHeightDvh.value = MOBILE_PANEL_DVH[mobilePanelMode.value]
  }
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
  ({ routeId, stopId, isStopRoute }) => {
    if (!isStopRoute && routeId !== selectedRouteId.value)
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

watch(
  isMobile,
  (mobile) => {
    if (!mobile)
      mobileViewportMode.value = 'split'
  },
)
</script>

<template>
  <div class="relative h-full w-full overflow-hidden bg-base-200">
    <div class="absolute inset-0 z-0">
      <MapView />
    </div>

    <div class="pointer-events-none absolute inset-0 z-10 bg-linear-to-b from-base-300/10 via-transparent to-transparent" />
    <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-linear-to-t from-base-content/12 to-transparent md:h-40" />

    <div
      class="pointer-events-none absolute right-3 top-[max(env(safe-area-inset-top),0.75rem)] z-30 transition-all duration-200 md:right-4 md:top-4"
      :class="showFloatingThemeToggle ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <ThemeToggleButton class="pointer-events-auto" />
    </div>

    <div class="pointer-events-none absolute left-3 top-[max(env(safe-area-inset-top),0.75rem)] z-30 md:hidden">
      <div class="pointer-events-auto inline-flex overflow-hidden rounded-[0.75rem] border border-base-300/80 bg-base-100/88 p-1 shadow-lg backdrop-blur-md">
        <button
          type="button"
          class="inline-flex min-h-8 items-center px-3 text-xs font-medium transition-colors"
          :class="mobileViewportMode === 'map' ? 'rounded-md bg-primary text-primary-content' : 'rounded-md text-base-content hover:bg-base-200'"
          aria-label="Map only"
          title="Map only"
          @click="setMobileViewportMode('map')"
        >
          Map
        </button>
        <button
          type="button"
          class="inline-flex min-h-8 items-center px-3 text-xs font-medium transition-colors"
          :class="mobileViewportMode === 'split' ? 'rounded-md bg-primary text-primary-content' : 'rounded-md text-base-content hover:bg-base-200'"
          aria-label="Map and panel"
          title="Map and panel"
          @click="setMobileViewportMode('split')"
        >
          Split
        </button>
        <button
          type="button"
          class="inline-flex min-h-8 items-center px-3 text-xs font-medium transition-colors"
          :class="mobileViewportMode === 'panel' ? 'rounded-md bg-primary text-primary-content' : 'rounded-md text-base-content hover:bg-base-200'"
          aria-label="Panel only"
          title="Panel only"
          @click="setMobileViewportMode('panel')"
        >
          Panel
        </button>
      </div>
    </div>

    <div class="pointer-events-none absolute inset-x-0 bottom-0 z-20 md:inset-y-0 md:left-0 md:right-auto">
      <div class="flex h-full items-end md:items-start">
        <div
          v-if="showPanel"
          class="pointer-events-auto w-full max-w-xl pb-[env(safe-area-inset-bottom)] md:h-full md:w-96 md:max-w-none md:px-3 md:pt-3 md:pb-3 lg:w-104"
          :class="panelTransitionClass"
          :style="mobilePanelInlineStyle"
        >
          <div
            class="relative h-full overflow-hidden rounded-t-[1.25rem] border-x border-t border-base-300/75 bg-base-100/90 text-base-content backdrop-blur md:rounded-[1.1rem] md:border md:bg-base-100/80 md:shadow-[0_30px_60px_-28px_rgba(0,0,0,0.65)]"
            :class="mobileSheetCardClass"
          >
            <div class="pointer-events-none absolute inset-x-0 top-0 h-8 bg-linear-to-b from-base-content/12 to-transparent md:hidden" />
            <div class="flex items-center justify-center gap-2 border-b border-base-300/70 bg-base-100/55 pt-1.5 pb-1.5 backdrop-blur-sm md:hidden">
              <button
                type="button"
                class="rounded-full touch-none cursor-row-resize p-1.5 transition-all duration-150 active:scale-95"
                :class="mobileHandleClass"
                aria-label="Drag to resize panel"
                title="Drag to resize panel"
                @pointerdown="onPanelHandlePointerDown"
              />
              <button
                type="button"
                class="inline-flex min-h-8 items-center rounded-md border border-base-300/70 bg-base-100/70 px-3 text-xs font-medium text-base-content transition-colors hover:bg-base-100"
                :aria-label="`Panel size: ${mobilePanelModeLabel}. Tap to switch size.`"
                :title="`Panel size: ${mobilePanelModeLabel}`"
                @pointerdown.stop
                @click="cycleMobilePanelMode"
              >
                {{ mobilePanelModeLabel }}
              </button>
            </div>
            <Panel>
              <PanelContent :forced-page="panelPage" />
            </Panel>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
