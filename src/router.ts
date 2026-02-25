import { createRouter, createWebHistory } from 'vue-router'

import AboutScreen from './screens/AboutScreen.vue'
import NearbyScreen from './screens/NearbyScreen.vue'
import RouteDetailsScreen from './screens/RouteDetailsScreen.vue'
import RoutesScreen from './screens/RoutesScreen.vue'
import StopDetailsScreen from './screens/StopDetailsScreen.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: NearbyScreen,
    },
    {
      path: '/routes',
      name: 'routes',
      component: RoutesScreen,
    },
    {
      path: '/about',
      name: 'about',
      component: AboutScreen,
    },
    {
      path: '/route/:routeId',
      name: 'route',
      component: RouteDetailsScreen,
    },
    {
      path: '/stop/:stopId',
      name: 'stop',
      component: StopDetailsScreen,
    },
  ],
})
