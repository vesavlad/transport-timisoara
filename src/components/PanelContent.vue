<script setup lang="ts">
import { computed } from 'vue'

import HomePageContent from './panel/HomePageContent.vue'
import RoutePageContent from './panel/RoutePageContent.vue'
import StopPageContent from './panel/StopPageContent.vue'

const router = useRouter()
const route = useRoute()

const pageKind = computed<'home' | 'route' | 'stop'>(() => {
  const routeId = typeof route.params.routeId === 'string' ? route.params.routeId.trim() : ''
  const stopId = typeof route.params.stopId === 'string' ? route.params.stopId.trim() : ''
  if (routeId && stopId)
    return 'stop'
  if (routeId)
    return 'route'
  return 'home'
})

const isHomePage = computed(() => pageKind.value === 'home')
const isRoutePage = computed(() => pageKind.value === 'route')
const isStopPage = computed(() => pageKind.value === 'stop')

const routeParamId = computed(() => {
  return typeof route.params.routeId === 'string' ? route.params.routeId : null
})

function goBack() {
  if (isStopPage.value && routeParamId.value) {
    router.push(`/route/${encodeURIComponent(routeParamId.value)}`)
    return
  }

  router.push('/')
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="!isHomePage" class="flex items-start">
      <button type="button" class="btn btn-xs btn-ghost" aria-label="Go back" @click="goBack">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="h-4 w-4"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6" />
        </svg>
      </button>
    </div>

    <Transition
      mode="out-in"
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <HomePageContent v-if="isHomePage" key="home" />
      <RoutePageContent v-else-if="isRoutePage" key="route" />
      <StopPageContent v-else-if="isStopPage" key="stop" />
    </Transition>
  </div>
</template>
