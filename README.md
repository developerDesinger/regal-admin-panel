# Regal Admin Panel

Internal operations and analytics console for Regal, the group-gifting app.
React + TypeScript + Vite + Tailwind, running against the Regal admin API.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
```

Sign in with an admin account issued by the backend. There is no signup — the
first Super Admin is seeded server-side, and further admins are invited from
the Admins screen.

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with the API proxy |
| `npm run build` | Typecheck (`tsc -b`) then production build |
| `npm run preview` | Serve the build locally, with the same API proxy |
| `npm run lint` | ESLint |

## How it talks to the API

**The panel always calls a same-origin `/api/...` path.** Something in front
proxies that to the backend:

| Environment | Proxy | Target |
|---|---|---|
| `npm run dev` / `npm run preview` | `server.proxy` / `preview.proxy` in `vite.config.ts` | `VITE_API_TUNNEL` |
| Production | the `/api/:path*` rewrite in `vercel.json` | the deployed backend |

This is deliberate, and the two rules below are load-bearing:

1. **`VITE_API_BASE_URL` must stay empty in every environment**, including
   Vercel. The session is an httpOnly cookie marked `Secure; SameSite=Strict`,
   and a strict cookie is *never* sent on a cross-site request. The panel on
   `*.vercel.app` calling the backend on `*.ondigitalocean.app` is cross-site,
   so a direct call would let login appear to succeed and then 401 on every
   request after it. Proxying keeps the browser seeing one origin.

2. **In `vercel.json`, the `/api/:path*` rewrite must stay above the SPA
   fallback.** The `/(.*) → /index.html` rule matches everything, so an `/api`
   rule below it would never run and the API would return the HTML shell.

   `vercel.json` also cannot carry comments — Vercel's schema rejects unknown
   keys, including `"//"`, and the whole deployment fails validation. That is
   why this explanation lives here instead.

To point at a different backend locally, put it in `.env.local` (gitignored):

```
VITE_API_TUNNEL=http://localhost:5000
```

## Environment variables

| Variable | Purpose |
|---|---|
| `VITE_API_TUNNEL` | Backend origin the dev/preview proxy targets. Never reaches the bundle. |
| `VITE_API_BASE_URL` | Leave empty — see above. |
| `VITE_ENV` | `PROD` or `STAGING`, drives the environment chip in the topbar. |

## Layout

```
src/
  lib/api/        client, wire types, one function per endpoint, wire→view adapters
  hooks/data/     query hooks (reads) and mutations, one per screen concern
  components/     ui/ primitives · common/ the shared library · layout/ the shell
  pages/          one folder per screen
docs/
  ADMIN_PANEL_API.md              the backend's endpoint reference
  BACKEND_API_REQUIREMENTS.md     what the panel needs, written for the backend
```

Screens read through `hooks/data` and never call axios directly. Money is
transmitted in **minor units** and formatted only by `formatMoney` — no
component divides by 100 itself.

## Notes

- Permissions come from the session, not a local table; the API re-authorizes
  every call regardless of what the UI hides.
- Ranged queries always send `tz`, or month-end reports lose their last hours.
- Payouts are per-user, not per-event, so a withdrawal's `eventId` is
  best-effort and may be absent.
