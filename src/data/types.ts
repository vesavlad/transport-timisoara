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
  lat: number
  lon: number
  speed?: number | null
  direction: number
  stop?: string
  headsign?: string
  updatedAt: number
  accessible?: boolean
}

export interface RouteShape {
  routeId: string
  // GeoJSON LineString coordinates [lon, lat]
  coordinates: Array<[number, number]>
}
