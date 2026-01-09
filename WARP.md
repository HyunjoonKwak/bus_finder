# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Commands and Tooling

This is a Next.js App Router project (Next 16, React 19) managed via npm.

### Setup
- Install dependencies: `npm install`

### Development
- Run dev server: `npm run dev`
  - Starts Next.js on the default port (typically http://localhost:3000).
- Build for production: `npm run build`
- Run production server (after build): `npm run start`
- Lint the project: `npm run lint`

### Tests
- There is currently no test runner or `test` script configured in `package.json`.
  - Before asking Warp to run tests or a single test file, add a test framework (e.g. Jest/Vitest/Playwright) and wire it via `"test"`/`"test:watch"` scripts in `package.json`.

## High-Level Architecture

### Framework and Routing
- The app uses the Next.js **App Router** with the `app/` directory.
- Route groups split the UI into two major shells:
  - `app/(main)/` – primary application experience.
    - `app/(main)/layout.tsx` defines the main layout, wrapping pages with a shared `Header` and `BottomNav`.
    - Top-level feature routes under this group include (non-exhaustive):
      - `app/(main)/page.tsx` – home screen combining the map and origin/destination search.
      - `app/(main)/bus/...` – bus search and route-detail flows.
      - `app/(main)/station/...` – station search and arrival info.
      - `app/(main)/nearby`, `favorites`, `history`, `tracking`, `memo`, `commute`, `settings`, `map-select`, etc.
  - `app/(auth)/` – authentication flows.
    - `app/(auth)/layout.tsx` centers auth pages on a neutral background.
    - `app/(auth)/login/page.tsx` handles email/password login using the browser Supabase client.

- **API routes** live under `app/api/**/route.ts` and are organized by domain:
  - `app/api/search/route.ts` – origin/destination search:
    - Uses Kakao Local API to geocode free-text addresses to coordinates.
    - Uses the ODSay API to compute transit routes between coordinates when `ODSAY_API_KEY` is configured.
    - Falls back to mock route data when Kakao or ODSay keys are missing or external calls fail.
  - `app/api/odsay/bus/**` and `app/api/odsay/station/**` – thin HTTP wrappers around the `lib/odsay` helpers for bus and station search.
  - `app/api/notifications/**` – CRUD endpoints for notification settings backed by Supabase tables (`notification_settings`).
  - `app/api/tracking/**` – APIs for logging and querying bus arrival history (e.g., `bus_arrival_logs`), including filtering by bus, station, and time window.

### State Management
- Client-side state relevant to searches is centralized in a **Zustand** store:
  - `lib/store.ts` exports `useSearchStore` which manages:
    - `origin` / `destination` locations (typed via `Location` from `@/types`).
    - `filters` such as `minimizeWalk`, `minimizeTransfer`, `hasLuggage`, `isRainy`.
    - `recentSearches` (kept to the latest 5 unique origin/destination pairs).
  - The home page (`app/(main)/page.tsx`) and related search components read from and update this store.

### External Service Integrations

#### ODSay (Transit API)
- `lib/odsay/index.ts` contains typed wrappers around the ODSay transit REST API, using types from `lib/odsay/types.ts`.
  - `searchStation`, `searchBusLane`, `searchNearbyStations` for station and bus discovery.
  - `getRealtimeArrival` for real-time arrival info per station.
  - `getBusLaneDetail` for route details including stops and live bus positions.
  - Utility formatters like `formatArrivalTime` and `formatDistance` are provided for UI-friendly strings.
- All wrappers depend on `process.env.ODSAY_API_KEY`; if it is not set, these helpers throw, so some higher-level routes (e.g. `app/api/search/route.ts`) explicitly guard this and return mock data instead.

#### Kakao Maps
- `lib/kakao/index.ts` encapsulates Kakao Maps and geolocation concerns:
  - `KAKAO_MAP_KEY` is read from `process.env.NEXT_PUBLIC_KAKAO_MAP_KEY`.
  - `loadKakaoMapScript()` dynamically injects the Kakao JS SDK and resolves when `kakao.maps` is ready.
  - `getCurrentPosition()` wraps `navigator.geolocation.getCurrentPosition` with reasonable defaults.
- `components/map/MapContainer.tsx` is the main map UI:
  - On mount, it loads the Kakao script, attempts to center on the user’s current location (with a fallback to central Seoul), and places a marker.
  - Exposes an `onLocationChange(lat, lng)` callback so higher-level pages can react to the resolved coordinates.

#### Supabase (Auth and Persistence)
- Supabase configuration lives under `lib/supabase/`:
  - `client.ts` – `createClient()` for **browser** usage, reading `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
  - `server.ts` – `createClient()` for **server-side** usage, wiring cookies via `next/headers` for RSC and route handlers.
  - `middleware.ts` – `updateSession(request)` keeps Supabase auth cookies in sync and enforces simple access control.
- Root `middleware.ts` delegates to `updateSession` and configures a matcher that applies middleware to all non-static routes.
  - `protectedRoutes` in `lib/supabase/middleware.ts` currently include `/history` and `/memo`; unauthenticated access to these routes redirects to `/login`.
- Auth UI:
  - `app/(auth)/login/page.tsx` calls the browser client’s `auth.signInWithPassword` and redirects to `/` on success.

#### Notifications (Discord and Telegram)
- `lib/notifications/discord.ts` and `lib/notifications/telegram.ts` provide helpers for sending richly formatted notifications:
  - `sendDiscordMessage` posts to a Discord webhook with optional embeds; `createBusArrivalEmbed` and `createLastBusEmbed` generate standard payloads for arrival/last-bus alerts.
  - `sendTelegramMessage` uses the Telegram Bot API; `formatBusArrivalMessage` and `formatLastBusMessage` format localized messages.
- `app/api/notifications/settings/route.ts` ties these concepts to Supabase-backed `notification_settings`, enabling CRUD for per-user webhook configurations (e.g., target bus/station, lead time, and webhook type).

### UI Composition
- UI is organized into domain-specific and generic layers:
  - Domain components:
    - `components/bus/*` – bus search input and route cards, wired to `/api/odsay/bus/search` and ODSay types.
    - `components/station/*` – station search input and lists, wired to `/api/odsay/station/search`.
    - `components/map/MapContainer.tsx` – Kakao map integration.
    - `components/layout/BottomNav.tsx` (and `Header`) – mobile-style navigation shell; `BottomNav` derives active state from `usePathname()`.
  - UI primitives under `components/ui/*` (e.g., `button.tsx`, `card.tsx`, `input.tsx`, `tabs.tsx`, `drawer.tsx`, etc.) are built on top of Radix UI and `class-variance-authority`.
- Tailwind CSS v4 is enabled via `postcss.config.mjs` using the `@tailwindcss/postcss` plugin. Class names are used directly in JSX; there is no separate `tailwind.config` checked in.

### TypeScript and Module Resolution
- `tsconfig.json` enables strict TypeScript settings and configures the `@/*` path alias:
  - `"@/*": ["./*"]` – import paths beginning with `@/` resolve from the project root (e.g., `@/lib/odsay`, `@/components/...`).
- The project targets modern browsers (`moduleResolution: "bundler"`, `jsx: "react-jsx"`) and includes all `.ts`/`.tsx` files plus generated `.next` type definitions.

### Environment Configuration Summary
- Key environment variables used throughout the app:
  - `ODSAY_API_KEY` – server-side ODSay transit API key (required by `lib/odsay` wrappers).
  - `KAKAO_REST_API_KEY` – Kakao REST API key for geocoding in `app/api/search/route.ts`.
  - `NEXT_PUBLIC_KAKAO_MAP_KEY` – public Kakao Maps JS SDK key used by `lib/kakao` and map components.
  - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` – Supabase project URL and anon key for both browser and server clients.
- When ODSay or Kakao keys are absent, some routes intentionally degrade to mock data (notably `app/api/search/route.ts`), while others that rely on `lib/odsay` will fail early because `getApiKey()` throws if `ODSAY_API_KEY` is missing.
