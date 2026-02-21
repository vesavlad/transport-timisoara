# CityRadar

Cross-platform public transportation map (desktop + mobile via PWA) that visualizes:

- **Routes** (line geometry)
- **Stations / stops** (points)
- **Live vehicles** (moving points)

## What’s in the box

- Vite + Vue 3 + TypeScript
- Tailwind CSS + daisyUI for UI
- MapLibre GL JS (OpenStreetMap-based map)
- Pinia for UI/map state (selected route, layer toggles)
- TanStack Vue Query for caching + live polling
- Basic PWA setup (service worker + manifest)

The app currently runs on **mock data**. When you set `VITE_TRANSIT_API_BASE_URL`, the data layer is ready for a vendor adapter to be implemented.

If you set `VITE_LINES_CONFIG_URL`, the app can also use **STPT live route config** (`lines-config.json`) as an input source for routes + shapes.
Live vehicle status/location can be pulled from **STPT GTFS vehicles** (`gtfs-vehicles.php`).

## Run locally

1. Install dependencies

- `npm install`

2. Start dev server

- `npm run dev`

3. Production build

- `npm run build`

## Styling (daisyUI)

This project uses **daisyUI** on top of Tailwind CSS.

- Use semantic component classes like `btn`, `card`, `input`, `toggle`, `badge`.
- Combine them with Tailwind utilities when needed.
- Themes are enabled globally via `src/style.css` (`light` as default and `dark` for prefers-color-scheme).

## Environment variables

Copy from `.env.example` into `.env` (or set these in your hosting environment):

- `VITE_TRANSIT_API_BASE_URL`
- `VITE_TRANSIT_API_KEY`

### Map tiles / basemap

To use a different tile source (streets/land cover/etc.), set:

- `VITE_MAP_STYLE_URL` (Mapbox Style Spec v8 JSON URL; MapLibre-compatible)

If unset, it defaults to CARTO Voyager:

- `https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json`

### STPT input (optional)

To periodically fetch STPT’s route config:

- `VITE_LINES_CONFIG_URL` (example: `https://live.stpt.ro/lines-config.json`)
- `VITE_LINES_CONFIG_REFETCH_MS` (default: 900000 = 15 minutes)
- `VITE_STPT_VEHICLES_URL` (default: `https://live.stpt.ro/gtfs-vehicles.php`)

Notes:

- In **dev**, if the direct URL is blocked by CORS, set `VITE_LINES_CONFIG_URL=/stpt/lines-config.json` to use the built-in dev proxy.
- In **dev**, if needed, set `VITE_STPT_VEHICLES_URL=/stpt/gtfs-vehicles.php` to use the built-in dev proxy for vehicle data.
- `lines-config.json` does not include precise station coordinates; stop marker positions are approximated along the polyline for now.

## UX structure (current)

- **Desktop**: left sidebar + map
- **Mobile**: map + bottom sheet panel

Primary flow: select a route → show route line + stops + live vehicles → tap a stop/vehicle to see details.

## Where to plug in your vendor API

- `src/data/client.ts` contains a placeholder adapter.
- `src/data/hooks.ts` decides whether to use mock vs vendor.

Once you share your provider’s endpoints and response shapes, we’ll map them to:

- `Route[]`
- `RouteShape`
- `Stop[]`
- `Vehicle[]`
