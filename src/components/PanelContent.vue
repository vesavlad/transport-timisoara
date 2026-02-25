<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { computed } from 'vue'
import { useMapStore } from '../stores/mapStore'
import PanelPageSwitch from './panel/PanelPageSwitch.vue'
import PanelToolbar from './panel/PanelToolbar.vue'

type PanelPage = 'home' | 'routes' | 'route' | 'stop'

const props = defineProps<{
  forcedPage?: PanelPage
}>()

const router = useRouter()
const route = useRoute()
const mapStore = useMapStore()
const { selectedRouteId } = storeToRefs(mapStore)

const pageKind = computed<PanelPage>(() => {
  if (props.forcedPage)
    return props.forcedPage

  if (route.name === 'routes')
    return 'routes'

  if (route.name === 'stop')
    return 'stop'

  const routeId = typeof route.params.routeId === 'string' ? route.params.routeId.trim() : ''
  if (routeId)
    return 'route'
  return 'home'
})

const isHomePage = computed(() => pageKind.value === 'home')
const isRoutesPage = computed(() => pageKind.value === 'routes')
const isRoutePage = computed(() => pageKind.value === 'route')
const isStopPage = computed(() => pageKind.value === 'stop')

const currentRouteId = computed(() => {
  const routeId = typeof route.params.routeId === 'string' ? route.params.routeId.trim() : ''
  if (routeId)
    return routeId
  return selectedRouteId.value ?? ''
})

const currentStop = computed(() => {
  const stopId = typeof route.params.stopId === 'string' ? route.params.stopId.trim() : ''
  if (stopId)
    return stopId
  return null
})

const backLabel = computed(() => {
  if (isStopPage.value)
    return 'Back to route'
  if (isRoutePage.value)
    return 'Back to routes'
  if (isRoutesPage.value)
    return 'Back to home'
  return 'Back'
})

function goBack() {
  if (isStopPage.value) {
    if (currentRouteId.value) {
      router.push(`/route/${encodeURIComponent(currentRouteId.value)}`)
      return
    }
    router.push('/routes')
    return
  }

  if (isRoutePage.value) {
    router.push('/routes')
    return
  }

  router.push('/')
}
</script>

<template>
  <div class="space-y-3">
    <PanelToolbar
      :is-home-page="isHomePage"
      :is-routes-page="isRoutesPage"
      :is-route-page="isRoutePage"
      :is-stop-page="isStopPage"
      :current-route-id="currentRouteId"
      :current-stop="currentStop"
      :back-label="backLabel"
      @back="goBack"
    />

    <PanelPageSwitch :page-kind="pageKind" />
  </div>
</template>
