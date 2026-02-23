# Transport Timisoara UX spec (MVP)

Date: 2026-02-20

## Product goal

A cross-device map-first app for public transportation where a user can:

1. Pick a route/line
2. See the route geometry + stations/stops
3. Track live vehicles on that route
4. Tap/select a vehicle to keep it in view ("follow")

## Information architecture

- Single primary screen: **Map**
- Secondary context: **Side panel / Bottom sheet** (route selection, layer toggles, vehicle list, details)

## Layout rules

### Desktop (≥ 768px)

- Two columns:
  - Left: panel (fixed width ~360px)
  - Right: map (fills remaining space)

### Mobile (< 768px)

- Map in the background (full screen)
- Bottom sheet panel:
  - Height cap: ~65% of viewport
  - Scrollable content inside

## Core controls

### Route selection

Component: `RoutePicker`

- Search input filters routes by short name + long name
- Select dropdown picks the active route
- On first load: auto-select first available route to reduce empty state friction

States:

- Loading: show "Loading routes…"
- Error: show "Failed to load routes"
- Empty results (after search): show "No routes match" message

### Layer toggles

Component: `LayerToggles`

- Three independent toggles:
  - Routes
  - Stations
  - Live vehicles

Behavior:

- Toggles only affect visibility; they do not change selected entities

### Vehicle list

Component: `VehicleList`

- Lists live vehicles for the selected route
- Selecting a vehicle:
  - Sets selection
  - Highlights list item

States:

- Empty: "No vehicles reported." (can happen if route has no realtime)

### Follow selected vehicle

Component: `ToggleRow` + map behavior in `MapView`

- Disabled when no vehicle is selected
- When enabled:
  - Map eases center to the selected vehicle whenever its position updates

## Map interactions

Component: `MapView`

Layers:

- Route line (blue)
- Stops (green points)
- Vehicles (amber points)

Interactions:

- Tap stop → selects stop
- Tap vehicle → selects vehicle
- Cursor changes on interactive layers (desktop)

## Detail cards (panel)

Priority order:

1. If no route selected → helper text
2. If a stop is selected → Stop card
3. Else if a vehicle is selected → Vehicle card
4. Else → tip text

Vehicle card shows:

- Label (if provided)
- Last updated time
- Vehicle ID
- Lat/Lon
- Clear selection action

## Error handling policy (MVP)

- Fail softly in-panel:
  - Routes: show error message
  - Vehicles: show empty list + keep map usable
- Map should remain interactive even if vendor API is down

## Accessibility notes

- All interactive controls are reachable via keyboard (desktop)
- Ensure sufficient contrast for text and interactive hit targets
- Avoid critical information conveyed only by color (future improvement: add icons/labels)

## Next UX iterations (not implemented yet)

- Stop details: upcoming arrivals
- Vehicle heading arrow + direction
- Route favorites + recent routes
- Quick actions: "Recenter to route", "Locate me"
- Offline-friendly cached base map style and last-known data
