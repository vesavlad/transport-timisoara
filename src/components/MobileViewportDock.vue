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
  <div class="dock dock-md z-40 border-t border-base-300/80 bg-base-100/95 text-base-content backdrop-blur md:hidden">
    <button
      :class="activeTab === 'nearby' ? 'dock-active' : ''"
      aria-label="Nearby"
      @click="openTab('nearby')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="size-[1.2em]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 2l7 4v6c0 5-3.5 8.7-7 10-3.5-1.3-7-5-7-10V6l7-4z" />
      </svg>
      <span class="dock-label">Nearby</span>
    </button>

    <button
      :class="activeTab === 'routes' ? 'dock-active' : ''"
      aria-label="Routes"
      @click="openTab('routes')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="size-[1.2em]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M4 12h16M4 17h16" />
      </svg>
      <span class="dock-label">Routes</span>
    </button>

    <button
      :class="activeTab === 'about' ? 'dock-active' : ''"
      aria-label="About"
      @click="openTab('about')"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="size-[1.2em]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0-9h.01" />
      </svg>
      <span class="dock-label">About</span>
    </button>
  </div>
</template>
