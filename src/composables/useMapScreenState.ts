import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useMapStore } from '../stores/mapStore'
import { isDark } from './dark'
import { useMediaQuery } from './useMediaQuery'

export type PanelPage = 'home' | 'routes' | 'route' | 'stop'
type MobileViewportMode = 'map' | 'split' | 'panel'

const MOBILE_SPLIT_PANEL_DVH = 70

export function useMapScreenState(forcedPage: PanelPage) {
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

  const mobileViewportMode = ref<MobileViewportMode>('panel')
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

  const showMap = computed(() => {
    if (!isMobile.value)
      return true
    return mobileViewportMode.value !== 'panel'
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
      height: `calc(${MOBILE_SPLIT_PANEL_DVH}dvh - env(safe-area-inset-bottom))`,
    }
  })

  const showFloatingThemeToggle = computed(() => true)

  const mobileSheetCardClass = computed(() => {
    if (!isMobile.value)
      return ''
    if (mobileViewportMode.value === 'panel')
      return 'shadow-none'
    return 'shadow-[0_-14px_30px_-16px_rgba(0,0,0,0.38)]'
  })

  function setMobileViewportMode(mode: MobileViewportMode) {
    if (!isMobile.value)
      return

    mobileViewportMode.value = mode
  }

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

  return {
    forcedPage,
    isDark,
    mobileViewportMode,
    showFloatingThemeToggle,
    setMobileViewportMode,
    showMap,
    showPanel,
    panelTransitionClass,
    mobilePanelInlineStyle,
    mobileSheetCardClass,
  }
}
