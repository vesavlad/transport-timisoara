<script setup lang="ts">
import { computed } from 'vue'

const route = useRoute()
const router = useRouter()

type DockTab = 'nearby' | 'routes' | 'about'

const activeTab = computed<DockTab>(() => {
  if (route.name === 'about')
    return 'about'
  if (route.name === 'routes' || route.name === 'route' || route.name === 'stop')
    return 'routes'
  return 'nearby'
})

function openTab(tab: DockTab) {
  if (tab === 'nearby') {
    router.push('/')
    return
  }

  if (tab === 'routes') {
    router.push('/routes')
    return
  }

  router.push('/about')
}
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-base-300/80 bg-base-100/95 text-base-content backdrop-blur md:hidden" aria-label="Primary mobile navigation">
    <button
      class="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors"
      :class="activeTab === 'nearby' ? 'bg-primary/15 text-primary' : 'text-base-content/75 hover:text-base-content'"
      aria-label="Nearby"
      @click="openTab('nearby')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="size-[1.2em]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7-7.5 11.5-7.5 11.5S4.5 17.5 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
      <span>Nearby</span>
    </button>

    <button
      class="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors"
      :class="activeTab === 'routes' ? 'bg-primary/15 text-primary' : 'text-base-content/75 hover:text-base-content'"
      aria-label="Routes"
      @click="openTab('routes')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="size-[1.2em]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M4 12h16M4 17h16" />
      </svg>
      <span>Routes</span>
    </button>

    <button
      class="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors"
      :class="activeTab === 'about' ? 'bg-primary/15 text-primary' : 'text-base-content/75 hover:text-base-content'"
      aria-label="About"
      @click="openTab('about')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="size-[1.2em]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v5m0-8h.01" />
      </svg>
      <span>About</span>
    </button>
  </nav>
</template>
