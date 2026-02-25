<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import MapView from '../components/MapView.vue'
import Panel from '../components/Panel.vue'
import PanelContent from '../components/PanelContent.vue'
import { isDark } from '../composables/dark'
import { useMediaQuery } from '../composables/useMediaQuery'
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
const isMobile = useMediaQuery('(max-width: 767px)')
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

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
      <label
        class="swap swap-rotate pointer-events-auto inline-flex rounded-box border border-base-300/80 bg-base-100/88 p-2 text-base-content shadow-xl backdrop-blur-md transition-colors hover:bg-base-100"
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

    <div class="pointer-events-none absolute left-3 top-[max(env(safe-area-inset-top),0.75rem)] z-30 md:hidden">
      <div class="join pointer-events-auto rounded-box border border-base-300/80 bg-base-100/88 p-1 shadow-lg backdrop-blur-md">
        <button
          type="button"
          class="btn btn-sm join-item"
          :class="mobileViewportMode === 'map' ? 'btn-primary' : 'btn-ghost'"
          aria-label="Map only"
          title="Map only"
          @click="setMobileViewportMode('map')"
        >
          Map
        </button>
        <button
          type="button"
          class="btn btn-sm join-item"
          :class="mobileViewportMode === 'split' ? 'btn-primary' : 'btn-ghost'"
          aria-label="Map and panel"
          title="Map and panel"
          @click="setMobileViewportMode('split')"
        >
          Split
        </button>
        <button
          type="button"
          class="btn btn-sm join-item"
          :class="mobileViewportMode === 'panel' ? 'btn-primary' : 'btn-ghost'"
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
            class="card relative h-full overflow-hidden rounded-t-[1.25rem] border-x border-t border-base-300/75 bg-base-100/90 backdrop-blur md:rounded-[1.1rem] md:border md:bg-base-100/80 md:shadow-[0_30px_60px_-28px_rgba(0,0,0,0.65)]"
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
                class="btn btn-sm btn-ghost border border-base-300/70 bg-base-100/70"
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
