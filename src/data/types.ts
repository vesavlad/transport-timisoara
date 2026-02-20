export interface Route {
  id: string
  shortName: string
  longName?: string
  color?: string
}

export interface Stop {
  id: string
  name: string
  lat: number
  lon: number
}

export interface Vehicle {
  id: string
  routeId: string
  label?: string
  lat: number
  lon: number
  heading?: number
  updatedAt: number
}

export interface RouteShape {
  routeId: string
  // GeoJSON LineString coordinates [lon, lat]
  coordinates: Array<[number, number]>
}
