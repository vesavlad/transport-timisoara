interface FetchOptions {
  signal?: AbortSignal
}

function optionalEnv(name: string) {
  const value = import.meta.env[name]
  return typeof value === 'string' ? value : ''
}

function requiredEnv(name: string) {
  return optionalEnv(name)
}

export function getTransitApiConfig() {
  return {
    baseUrl: requiredEnv('VITE_TRANSIT_API_BASE_URL'),
    apiKey: requiredEnv('VITE_TRANSIT_API_KEY'),
  }
}

function parseMs(raw: string, fallbackMs: number) {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : fallbackMs
}

export function getStptConfig() {
  return {
    linesConfigUrl: optionalEnv('VITE_LINES_CONFIG_URL'),
    linesConfigRefetchMs: parseMs(optionalEnv('VITE_LINES_CONFIG_REFETCH_MS'), 15 * 60 * 1000),
    vehiclesUrl: optionalEnv('VITE_STPT_VEHICLES_URL') || 'https://live.stpt.ro/gtfs-vehicles.php',
  }
}

export function getMapConfig() {
  // A Mapbox Style Spec v8 JSON URL compatible with MapLibre.
  // Default: CARTO Voyager (OSM-based) so streets/land cover are visible out of the box.
  return {
    styleUrl:
      optionalEnv('VITE_MAP_STYLE_URL')
      || 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  }
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    // Prefer fresh data when polling config endpoints.
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Request failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`)
  }

  return (await res.json()) as T
}

/**
 * Vendor API adapter placeholder.
 * Replace these endpoints and response shapes with your actual provider.
 */
export const vendorApi = {
  async listRoutes() {
    const { baseUrl, apiKey } = getTransitApiConfig()
    if (!baseUrl)
      throw new Error('VITE_TRANSIT_API_BASE_URL is not set')
    const url = new URL('/routes', baseUrl)
    if (apiKey)
      url.searchParams.set('key', apiKey)
    return fetchJson<unknown>(url.toString())
  },
}
