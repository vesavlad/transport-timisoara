import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
// MapLibre worker fix:
// In some bundler setups the default "blob worker" can break at runtime with
// errors like "__publicField is not defined". Point MapLibre to its packaged
// CSP worker bundle instead.
// import { setWorkerUrl } from 'maplibre-gl'
// import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url'

import { createPinia } from 'pinia'
import { createApp, watchEffect } from 'vue'

import App from './App.vue'
import { isDark } from './composables/dark'
import { router } from './router'
// Global MapLibre + vue-maplibre-gl styles
import './style.css'

// setWorkerUrl(maplibreWorkerUrl)

watchEffect(() => {
  document.documentElement.setAttribute('data-theme', isDark.value ? 'cityradar-dark' : 'cityradar')
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createApp(App)
  .use(router)
  .use(createPinia())
  .use(VueQueryPlugin, { queryClient })
  .mount('#app')
