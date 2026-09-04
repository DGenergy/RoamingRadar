# Radar Route

A client-only web app (installable PWA) that puts your route on the same map as
regional radar, 90-minute storm cones, NWS alerts and wind. No backend: the phone
fetches every layer straight from public endpoints.

## Files

| File | What it is |
|---|---|
| `index.html` | App shell — map, route pill, scrub card, bottom nav, sheets |
| `styles.css` | Mobile-first styling (Pixel 10 layout; wide screens get a side panel) |
| `app.js` | All layers, routing, alerts, saved routes/places, diagnostics |
| `tracker.js` | Radar edge tracker — reads radar tiles, estimates motion, draws leading-edge cones |
| `wind.js` | Particle wind renderer — canvas over the map, particles advected through the interpolated grid |
| `sw.js` | Service worker — caches the app shell and the map library (never weather data) |
| `manifest.webmanifest`, `icons/` | PWA install metadata |

## Run it locally (desktop)

Any static file server works. From this folder:

```sh
python3 -m http.server 8080
```

then open <http://localhost:8080>. Opening `index.html` directly from the
Finder also works (the service worker is skipped on `file://`).

## Put it on your phone

A PWA installs only from an **https** origin (or localhost), so the folder needs
to be hosted somewhere. The simplest free option is GitHub Pages:

1. Create a repository (e.g. `radar-route`) and push this folder to it.
2. Settings → Pages → Source: *Deploy from a branch* → `main` / root.
3. Open the `https://<you>.github.io/radar-route/` URL in Chrome on the phone,
   then **Add to Home screen** (Chrome offers *Install app*).

Netlify Drop and Cloudflare Pages work the same way (drag the folder in).

## Data sources

| Layer | Source | Notes |
|---|---|---|
| Radar loop (US) | Iowa State Mesonet tile cache, `mrms::lcref-YYYYMMDDHHMM` | MRMS composite reflectivity, 2-min archive, 1–12 h loop |
| Radar loop (elsewhere) | RainViewer public API + tile cache | global composite of national radars (NZ, Australia, parts of Colombia), 2 h past + 30 min nowcast; auto-selected outside the US |
| Storm objects | NOAA ProbSevere v3 via the `noaa-mrms-pds` S3 bucket | polygons + motion; grouped into line cones |
| Radar edges | `tracker.js` on the IEM tiles | needs CORS-readable tiles (the Data sources row says) |
| Alerts | `api.weather.gov/alerts/active` | polygon alerts drawn; zone-based products counted but not drawn yet |
| Wind field | Open-Meteo hourly, 14×12 grid around the viewport (`wind.js`) | animated particles, now to +6 h on the WIND slider; tap the map for a reading |
| METAR | Aviation Weather Center → IEM ASOS fallback | station/dir/speed labels |
| Routes | OSRM demo (no key), Google Routes (key), straight line | ticks every N minutes along the route |
| Point forecast | `api.weather.gov` hourly | tap a route tick |
| Basemap | OpenFreeMap (dark, fiord, light, liberty, bright) | plus OpenTopoMap / OSM / Esri overlays and AWS terrain hillshade |

The OSRM demo router and Nominatim geocoder are community services with usage
limits — fine for personal use, not for anything public. For traffic-aware
timings, paste a Google Maps Platform key (Routes API enabled) into the Route
sheet; the key is stored only in the browser.

## Alerts at your location

Tap **LOCATE** to start GPS. When a new *warning* polygon (severe thunderstorm,
tornado, flash flood…) covers your position the app beeps, vibrates, flashes
the screen and shows a banner. This runs only while the app is open — a PWA
can't poll in the background on Android.

## Settings that persist

Layer toggles, map style, overlay, relief, cone mode, loop length, the last map
view, saved routes and places all live in the browser's local storage for this
site.
