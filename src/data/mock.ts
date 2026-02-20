import type { Route, RouteShape, Stop, Vehicle } from './types'

const route: Route = {
  id: 'R1',
  shortName: 'R1',
  longName: 'River Line (Mock)',
  color: '#60a5fa',
}

// A simple polyline around a downtown-ish area (mock data).
// Coordinates are [lon, lat].
const shape: RouteShape = {
  routeId: route.id,
  coordinates: [
    [-122.423057, 37.778676],
    [-122.419275, 37.776219],
    [-122.414813, 37.775122],
    [-122.40992, 37.776522],
    [-122.406286, 37.779132],
    [-122.404055, 37.782284],
  ],
}

const stops: Stop[] = [
  { id: 'S1', name: 'Civic Center', lat: 37.778676, lon: -122.423057 },
  { id: 'S2', name: 'Market St', lat: 37.776219, lon: -122.419275 },
  { id: 'S3', name: 'Union Square', lat: 37.775122, lon: -122.414813 },
  { id: 'S4', name: 'Embarcadero', lat: 37.782284, lon: -122.404055 },
]

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function pointOnLine(coords: Array<[number, number]>, t: number): [number, number] {
  if (coords.length === 0)
    return [0, 0]
  if (coords.length === 1)
    return coords[0]!

  const totalSegments = coords.length - 1
  const scaled = t * totalSegments
  const seg = Math.min(totalSegments - 1, Math.max(0, Math.floor(scaled)))
  const localT = scaled - seg

  const p1 = coords[seg]!
  const p2 = coords[seg + 1]!
  const [lon1, lat1] = p1
  const [lon2, lat2] = p2
  return [lerp(lon1, lon2, localT), lerp(lat1, lat2, localT)]
}

export async function mockListRoutes(): Promise<Route[]> {
  return [route]
}

export async function mockGetRouteShape(routeId: string): Promise<RouteShape | null> {
  return routeId === shape.routeId ? shape : null
}

export async function mockListStops(routeId: string): Promise<Stop[]> {
  // In reality you'd filter by route; for mock we return all.
  return routeId === route.id ? stops : []
}

export async function mockListVehicles(routeId: string): Promise<Vehicle[]> {
  if (routeId !== route.id)
    return []

  const now = Date.now()
  // Two vehicles chasing each other along the same shape.
  const t1 = ((now / 1000) % 120) / 120
  const t2 = (((now / 1000) + 40) % 120) / 120

  const [lonA, latA] = pointOnLine(shape.coordinates, t1)
  const [lonB, latB] = pointOnLine(shape.coordinates, t2)

  return [
    {
      id: 'V1',
      routeId,
      label: 'Train 12',
      lat: latA,
      lon: lonA,
      updatedAt: now,
    },
    {
      id: 'V2',
      routeId,
      label: 'Train 7',
      lat: latB,
      lon: lonB,
      updatedAt: now,
    },
  ]
}
