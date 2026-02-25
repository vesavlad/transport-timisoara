<script setup lang="ts">
import HomePageContent from './HomePageContent.vue'
import RoutePageContent from './RoutePageContent.vue'
import RoutesPageContent from './RoutesPageContent.vue'
import StopPageContent from './StopPageContent.vue'

type PanelPage = 'home' | 'routes' | 'route' | 'stop'

defineProps<{
  pageKind: PanelPage
}>()
</script>

<template>
  <Transition
    mode="out-in"
    enter-active-class="transition-all duration-200 ease-out motion-reduce:transition-none"
    enter-from-class="opacity-0 translate-y-1 motion-reduce:opacity-100 motion-reduce:translate-y-0"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-150 ease-in motion-reduce:transition-none"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-1 motion-reduce:opacity-100 motion-reduce:translate-y-0"
  >
    <HomePageContent v-if="pageKind === 'home'" key="home" />
    <RoutesPageContent v-else-if="pageKind === 'routes'" key="routes" />
    <StopPageContent v-else-if="pageKind === 'stop'" key="stop" />
    <RoutePageContent v-else-if="pageKind === 'route'" key="route" />
  </Transition>
</template>
