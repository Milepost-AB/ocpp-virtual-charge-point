# Admin UI

The repository now includes a minimal React + Vite interface under `admin-ui/`. It talks to the existing Hono-powered Admin API and is automatically served from the same origin once you build it.

## Development workflow

1. Install dependencies at the repo root (`npm install`) and inside the UI package (`cd admin-ui && npm install`).  
   `npm run admin-ui:dev` encapsulates both `cd` + `npm run dev`.
2. The UI defaults to the same origin as the Admin API. When running the Vite dev server against a remote API, set `VITE_ADMIN_API_BASE_URL`:

   ```bash
   VITE_ADMIN_API_BASE_URL=http://localhost:9999 npm run admin-ui:dev
   ```

3. Features included in the first cut:
   - VCP list + status cards (id, version, lifecycle state, timestamps, metadata)
   - Connect / Stop quick actions
   - Manual refresh toggle + auto-refresh (5s)
   - `StartTransaction` dialog with token + connector inputs (supports OCPP 1.6 / 2.0.1 / 2.1)

All background chips ensure black-text readability to honor the user’s accessibility requirement.

## Building & serving via Hono

Run `npm run admin-ui:build` to produce a static bundle in `admin-ui/dist`.  
When you start the main process (`npm run start`), `src/adminServer.ts` looks for that directory:

- If it exists, Hono serves the assets at `/` (and `/assets/*`) alongside the JSON API.
- If it’s missing, the server logs a warning explaining how to build the UI and continues exposing only the JSON endpoints.

This keeps the API callable via `curl` or any other tooling while exposing the new UI when available.

## Directory overview

```
admin-ui/
├── src/
│   ├── components/ui      # Reusable shadcn-style primitives
│   ├── features/vcp       # API client, cards, StartTransaction dialog
│   └── App.tsx            # Page layout + polling
├── index.html             # Vite entry
├── tailwind.config.ts     # Color + typography theme (light only)
└── tsconfig.*             # Project references used by `tsc -b`
```

Feel free to evolve the UI (add routing, charts, etc.); the scripts above should remain the entry points for local dev and production builds.

