import { defineStore } from 'pinia'

export type LayerId = 'routes' | 'stops' | 'vehicles'
export type RouteDirection = 'tur' | 'retur'

type LayerState = Record<LayerId, boolean>

export const useMapStore = defineStore('map', {
  state: () => ({
    layers: {
      routes: true,
      stops: true,
      vehicles: true,
    } as LayerState,
    selectedRouteId: null as string | null,
    selectedDirection: 'tur' as RouteDirection,
    selectedStopId: null as string | null,
    selectedVehicleId: null as string | null,
    followSelectedVehicle: true,
  }),
  actions: {
    setLayer(id: LayerId, enabled: boolean) {
      this.layers[id] = enabled
    },
    toggleLayer(id: LayerId) {
      this.layers[id] = !this.layers[id]
    },
    selectRoute(routeId: string | null) {
      this.selectedRouteId = routeId
      this.selectedDirection = 'tur'
      this.selectedStopId = null
      this.selectedVehicleId = null
      this.followSelectedVehicle = true
    },
    setSelectedDirection(direction: RouteDirection) {
      this.selectedDirection = direction
    },
    selectStop(stopId: string | null) {
      this.selectedStopId = stopId
      this.selectedVehicleId = null
    },
    selectVehicle(vehicleId: string | null) {
      this.selectedVehicleId = vehicleId
      this.selectedStopId = null
    },
    setFollowSelectedVehicle(enabled: boolean) {
      this.followSelectedVehicle = enabled
    },
  },
})
