<script setup lang="ts">
import { computed } from 'vue'

import HomePageContent from './panel/HomePageContent.vue'
import RoutePageContent from './panel/RoutePageContent.vue'
import RoutesPageContent from './panel/RoutesPageContent.vue'

const router = useRouter()
const route = useRoute()

const pageKind = computed<'home' | 'routes' | 'route'>(() => {
  if (route.name === 'routes')
    return 'routes'

  const routeId = typeof route.params.routeId === 'string' ? route.params.routeId.trim() : ''
  if (routeId)
    return 'route'
  return 'home'
})

const isHomePage = computed(() => pageKind.value === 'home')
const isRoutesPage = computed(() => pageKind.value === 'routes')
const isRoutePage = computed(() => pageKind.value === 'route')

const backLabel = computed(() => {
  if (isRoutePage.value)
    return 'Back to routes'
  if (isRoutesPage.value)
    return 'Back to home'
  return 'Back'
})

function goBack() {
  if (isRoutePage.value) {
    router.push('/routes')
    return
  }

  router.push('/')
}
</script>

<template>
  <div class="space-y-4 mt-2">
    <div v-if="!isHomePage" class="flex items-start">
      <button
        type="button"
        class="btn btn-sm btn-ghost gap-1.5 rounded-field border border-base-300 bg-base-100/80 text-base-content hover:bg-base-200"
        aria-label="Go back"
        @click="goBack"
      >
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
        <span class="text-xs font-medium">{{ backLabel }}</span>
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
      <RoutesPageContent v-else-if="isRoutesPage" key="routes" />
      <RoutePageContent v-else-if="isRoutePage" key="route" />
    </Transition>
  </div>
</template>
