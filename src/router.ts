import { createRouter, createWebHistory } from 'vue-router'

import MapScreen from './screens/MapScreen.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: MapScreen,
    },
    {
      path: '/route/:routeId',
      name: 'route',
      component: MapScreen,
    },
    {
      path: '/route/:routeId/stop/:stopId',
      name: 'route-stop',
      component: MapScreen,
    },
  ],
})
