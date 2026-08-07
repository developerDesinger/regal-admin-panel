# Regal Admin API — Complete Frontend Reference

**Everything the admin panel needs.** Base URL, auth, conventions, and every endpoint with its request and response payload.

- **Base URL:** `{VITE_API_BASE_URL}/api/v1/admin`
- **Swagger UI:** `http://localhost:5000/docs` (all admin routes under the **Admin** tag)
- **Login:** `admin@gmail.com` / `Admin123@`

All payloads below are the real shapes the server emits — taken from the serializers, not written by hand.

---

## Table of contents

1. [Setup — read this first](#1-setup--read-this-first)
2. [Response envelope & errors](#2-response-envelope--errors)
3. [Conventions: money, dates, pagination, PII](#3-conventions-money-dates-pagination-pii)
4. [Authentication & session](#4-authentication--session)
5. [Roles & permissions](#5-roles--permissions)
6. [Dashboard](#6-dashboard)
7. [Events](#7-events)
8. [Contributions](#8-contributions)
9. [Users](#9-users)
10. [Gift card analytics](#10-gift-card-analytics)
11. [Gift card catalog](#11-gift-card-catalog)
12. [Clovers](#12-clovers)
13. [Withdrawals](#13-withdrawals)
14. [Alerts](#14-alerts)
15. [Exports](#15-exports)
16. [Audit trail](#16-audit-trail)
17. [Admin users](#17-admin-users)
18. [Settings](#18-settings)
19. [Global search](#19-global-search)
20. [Gotchas that will cost you an afternoon](#20-gotchas-that-will-cost-you-an-afternoon)
21. [Known data-model caveats](#21-known-data-model-caveats)

---

## 1. Setup — read this first

### Every request must send cookies

The session is an httpOnly cookie. There is no token in the response body and nothing to store yourself.

```ts
export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api/v1/admin`,
  withCredentials: true,          // ← without this, every call 401s
});
```

```ts
// fetch equivalent
fetch(url, { credentials: "include" })
```

### Every mutation must send the CSRF token

`POST` / `PATCH` / `PUT` / `DELETE` need `X-CSRF-Token`. You get it from the login response and from `GET /auth/me`; it's bound to the session.

```ts
let csrfToken = "";

api.interceptors.request.use((config) => {
  if (config.method?.toUpperCase() !== "GET") {
    config.headers["X-CSRF-Token"] = csrfToken;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const code = error.response?.data?.error?.code;
    if (code === "UNAUTHENTICATED") router.push("/login");
    if (code === "CSRF_INVALID") { /* re-read /auth/me, retry once */ }
    if (code === "RATE_LIMITED") {
      const retryAfter = Number(error.response.headers["retry-after"] ?? 60);
      /* start a countdown */
    }
    return Promise.reject(error);
  },
);
```

### Dev cookie note

The cookie is `SameSite=Strict`. `localhost:5173` → `localhost:5000` works (differing ports are still the same site). A different **host** will not — use a Vite proxy:

```ts
server: { proxy: { "/api": { target: "http://localhost:5000", changeOrigin: true } } }
```

`Secure` is only set in production, so plain `http://localhost` is fine in dev.

---

## 2. Response envelope & errors

Every success:

```json
{ "data": { }, "meta": { } }
```

Every list:

```json
{
  "data": [ ],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "totalRows": 4213,
    "totalPages": 169,
    "dataAsOf": "2026-08-07T09:49:00.000Z"
  }
}
```

`meta.dataAsOf` appears on computed/aggregate responses — render it as the "Data as of HH:MM" stamp.

Every error:

```json
{
  "error": {
    "code": "INSUFFICIENT_PERMISSION",
    "message": "Your role cannot perform this action.",
    "details": { "required": "cards:write" }
  }
}
```

`message` is written for a human — show it directly.

| Code | HTTP | What to do |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Redirect to `/login` |
| `INVALID_CREDENTIALS` | 401 | Inline on the login form |
| `ACCOUNT_DISABLED` | 403 | Show message, don't retry |
| `INSUFFICIENT_PERMISSION` | 403 | Shouldn't happen if you gate on `permissions` — treat as a panel bug |
| `CSRF_INVALID` | 403 | Re-read `/auth/me`, retry once |
| `NOT_FOUND` | 404 | Empty state |
| `VALIDATION_FAILED` | 422 | Map `details` onto form fields by key |
| `CONFLICT` | 409 | Blocking dialog (e.g. "deactivate instead of delete") |
| `RATE_LIMITED` | 429 | Read `Retry-After` (seconds), count down |
| `GONE` | 410 | Export link already used or expired |
| `INTERNAL` | 500 | Generic retry affordance |

`details` on a 422 is keyed by field name:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Please correct the highlighted fields.",
  "details": { "name": "required", "slug": "must be lowercase words separated by hyphens" } } }
```

---

## 3. Conventions: money, dates, pagination, PII

### Money

**Integer minor units + explicit currency. Never a float, never a preformatted string.**

```json
{ "goalAmount": 500000, "currency": "MXN" }   // = $5,000.00 MXN
```

One helper; division by 100 happens nowhere else:

```ts
export const formatMoney = (minor: number, currency = "MXN") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(minor / 100);
```

Three deliberate exceptions, all flagged in the responses:

| Field | Unit | Why |
|---|---|---|
| `settings.financial.min_withdrawal` | **major** (pesos) | Admin config value, not a transaction. `meta.notes` says so |
| Clover amounts everywhere | whole units | Not money |
| `amount` **filter** on `/contributions` (`0-50`, `50-100`…) | **major** | Matches what the admin types; server converts |

### Dates & ranges

All timestamps are ISO 8601 UTC with `Z`.

Every list and aggregate endpoint accepts:

| Param | Values |
|---|---|
| `range` | `today` `yesterday` `7d` `30d` `90d` `mtd` `last_month` `qtd` `ytd` `custom` |
| `from` / `to` | `2026-07-01` / `2026-07-31` — **both inclusive**, used with `range=custom` |
| `tz` | IANA zone, e.g. `America/Mexico_City` |
| `compare` | `1` to include previous-period figures |

**Always send `tz`.** `from`/`to` are civil dates in that zone, so `to=2026-07-31` means end-of-day in Mexico City. Without it, month-end reports quietly lose the last hours of the month.

### KPI shape

With `compare=1`:

```json
{ "value": 1284, "previous": 1142, "delta": 12.4, "deltaUnit": "percent" }
```

- `deltaUnit: "percent"` for counts and money
- `deltaUnit: "pp"` when the metric is itself a rate — 70% → 72.4% is **+2.4pp**, not +3.4%
- **`delta` is `null` when `previous` is 0.** Render "—", never "Infinity%"

### Pagination, sorting, filtering

All server-side. You never receive a full table.

| Param | Notes |
|---|---|
| `page` | 1-indexed, default 1 |
| `pageSize` | default 25, **capped at 100** (larger is clamped, not rejected) |
| `sort` | field name; unknown fields fall back to the default rather than erroring |
| `dir` | `asc` \| `desc` |
| `q` | free-text; scope documented per endpoint |

### PII

Emails and phone numbers are **masked by the server**. There is no unmasked copy hiding in the payload.

```json
{ "email": "s•••@gmail.com", "emailMasked": true, "phoneNumber": "••• ••• 4821" }
```

To reveal:
- `?unmask=true` on `GET /users` or `GET /users/:id` — needs `pii:read`. **Silently stays masked without it.**
- `POST /users/:id/pii/unmask { reason }` — the deliberate "Reveal" button.

Both write an audit entry naming the admin, the user and the reason. Search results are always masked, even for callers who could unmask.

---

## 4. Authentication & session

There is **no signup screen**. The backend seeds one Super Admin on first boot; further admins are created from the Admins screen, which emails an activation link.

### Flow

```
POST /auth/login
   ├─ 200 { data: { admin, csrfToken } }                                  → signed in
   └─ 200 { data: { status: "2fa_required", challengeId, expiresIn } }
            └─ POST /auth/2fa/verify { challengeId, code }                → same success payload
```

### `POST /auth/login` — public

```json
{ "email": "admin@gmail.com", "password": "Admin123@", "rememberMe": false }
```

**200 — signed in**

```json
{
  "data": {
    "admin": {
      "id": "6a7574cf7f110f65871484bb",
      "name": "Regal Admin",
      "email": "admin@gmail.com",
      "role": "super_admin",
      "permissions": ["events:read", "events:write", "contributions:read", "financials:read",
                      "payouts:write", "users:read", "pii:read", "pii:export", "cards:read",
                      "cards:write", "clovers:read", "clovers:adjust", "alerts:manage",
                      "exports:run", "audit:read", "admins:manage", "settings:write"],
      "avatarUrl": null,
      "twoFactorEnabled": false,
      "lastLoginAt": "2026-08-07T06:01:50.410Z",
      "mustChangePassword": false
    },
    "csrfToken": "56AXxAialsrw1B-8roRH8yYYw6i_UGS_"
  },
  "meta": {}
}
```

**200 — 2FA required**

```json
{ "data": { "status": "2fa_required", "challengeId": "6a75…", "expiresIn": 300, "devCode": "418302" } }
```

`devCode` is present **only** outside production, so you can test without a mail server.

**401 — bad credentials.** Identical message whether or not the email exists — don't infer anything from it:

```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "Incorrect email or password." } }
```

**429 — locked out.** 5 failed attempts per email+IP → 15-minute lock. `Retry-After` header carries real remaining seconds:

```json
{ "error": { "code": "RATE_LIMITED", "message": "Too many failed attempts. Try again in 14 minute(s).", "details": { "retryAfter": 840 } } }
```

**403 — disabled account:** `{ "error": { "code": "ACCOUNT_DISABLED", "message": "This account has been disabled. Contact your administrator." } }`

### Other auth endpoints

| Method | Path | Auth | Request | Response |
|---|---|---|---|---|
| POST | `/auth/2fa/verify` | public | `{ challengeId, code }` | Same as login success |
| POST | `/auth/2fa/resend` | public | `{ challengeId }` | `{ data: { challengeId, expiresIn: 300 } }` · 30s cooldown → 429 |
| POST | `/auth/forgot-password` | public | `{ email }` | **204** always (no email oracle) |
| POST | `/auth/reset-password` | public | `{ token, password }` | **204**. Token single-use, 1h. Ends all sessions |
| POST | `/auth/logout` | public | — | **204** |
| GET | `/auth/me` | session | — | `{ data: { admin, csrfToken } }` — call on every app boot |
| POST | `/auth/heartbeat` | session | — | **204**. Extends the idle window |
| POST | `/auth/change-password` | session | `{ currentPassword, newPassword }` | `{ data: { admin, csrfToken } }` — re-mints your session |

### Session rules

- **Idle timeout: 30 minutes of inactivity.** Any request refreshes it, so ordinary use keeps it alive. Show the warning modal at ~28 minutes of true idleness and call `/auth/heartbeat` from "Stay signed in".
- `rememberMe: true` → 30-day cookie. `false` → session cookie (gone when the browser closes).
- If `admin.mustChangePassword` is true, route straight to the change-password screen.
- Password policy: ≥8 chars, upper + lower + digit + special.

---

## 5. Roles & permissions

`admin.permissions` from login / `/auth/me` is authoritative for the session:

```ts
const can = (p: string) => admin.permissions.includes(p);
{can("cards:write") && <Button>New design</Button>}
```

Hiding a button is UX — every route is enforced server-side too. A 403 means your gating is out of step.

### `GET /admins/permissions` — any signed-in admin

```json
{
  "data": {
    "permissions": ["events:read", "events:write", "…"],
    "roles": {
      "super_admin": { "label": "Super Admin", "description": "Everything, including admin management and platform settings.", "permissions": ["…"] },
      "finance":     { "label": "Finance",     "description": "…", "permissions": ["…"] },
      "operations":  { "label": "Operations",  "description": "…", "permissions": ["…"] },
      "support":     { "label": "Support",     "description": "…", "permissions": ["…"] },
      "analyst":     { "label": "Analyst",     "description": "…", "permissions": ["…"] }
    }
  }
}
```

Render the Admins screen from this rather than a hardcoded copy — it's the same object the server enforces with.

### The matrix

| Role | Permissions |
|---|---|
| `super_admin` | all 17 |
| `finance` | events:read, contributions:read, financials:read, payouts:write, users:read, clovers:read, cards:read, exports:run, audit:read |
| `operations` | events:read/write, contributions:read, financials:read, users:read, cards:read/write, clovers:read/adjust, alerts:manage, audit:read |
| `support` | events:read, contributions:read, users:read, **pii:read**, cards:read, clovers:read |
| `analyst` | events:read, contributions:read, financials:read, users:read, cards:read, clovers:read |

Full list: `events:read` `events:write` `contributions:read` `financials:read` `payouts:write` `users:read` `pii:read` `pii:export` `cards:read` `cards:write` `clovers:read` `clovers:adjust` `alerts:manage` `exports:run` `audit:read` `admins:manage` `settings:write`

---

## 6. Dashboard

All accept `range` / `from` / `to` / `tz` / `compare`. All require `events:read`.

### `GET /dashboard/kpis?range=30d&compare=1&tz=America/Mexico_City`

Eight cards. Each carries a `definition` (for the ⓘ tooltip) and a `filter` that reproduces the number for drill-down.

```json
{
  "data": {
    "activeEvents": {
      "value": 16, "previous": 14, "delta": 14.3, "deltaUnit": "percent",
      "definition": "Events currently in an active, published or goal-reached state.",
      "filter": { "status": "active,published,goal_reached" }
    },
    "eventsCreated": {
      "value": 48, "previous": 41, "delta": 17.1, "deltaUnit": "percent",
      "definition": "Events created within the selected range.",
      "filter": { "dateField": "createdAt", "range": "30d" }
    },
    "eventSuccessRate": {
      "value": 72.4, "previous": 70, "delta": 2.4, "deltaUnit": "pp",
      "definition": "Events reaching 100% of goal ÷ events published in range. Cancelled events are excluded from the denominator.",
      "filter": { "progress": "100" }
    },
    "avgEventDurationDays": {
      "value": 8.3, "previous": 9.1, "delta": -8.8, "deltaUnit": "percent",
      "definition": "Mean of (closure − publication), in days, for events closed in range."
    },
    "totalConfirmed": {
      "value": 3420000, "currency": "MXN", "previous": 2980000, "delta": 14.8, "deltaUnit": "percent",
      "definition": "Sum of all confirmed (succeeded) contributions in range.",
      "filter": { "status": "succeeded" }
    },
    "participationRate": {
      "value": 54.1, "previous": 51.7, "delta": 2.4, "deltaUnit": "pp",
      "definition": "Distinct users with ≥1 confirmed contribution ÷ distinct users invited. Failed attempts are not participation."
    },
    "cardDownloads": {
      "unique": 1204, "total": 2310, "previous": 1090, "delta": 10.5, "deltaUnit": "percent",
      "definition": "Gift-card download events in range. `unique` counts distinct users, `total` counts every download."
    },
    "cloverRedemptionRate": {
      "value": 31.7, "previous": 29.9, "delta": 1.8, "deltaUnit": "pp",
      "definition": "Users who redeemed ≥1 premium card ÷ users holding a non-zero clover balance at any point in range."
    }
  },
  "meta": {
    "dataAsOf": "2026-08-07T09:49:00.000Z",
    "range": { "from": "2026-07-09T06:00:00.000Z", "to": "2026-08-08T05:59:59.999Z", "tz": "America/Mexico_City", "preset": "30d" }
  }
}
```

### `GET /dashboard/timeseries?range=30d&granularity=day|week`

```json
{
  "data": [
    {
      "date": "2026-07-08",
      "eventsCreated": 12,
      "eventsCompleted": 8,
      "contributionVolume": 184000,
      "contributionCount": 26,
      "previousVolume": 151000,
      "reminderSent": true
    }
  ],
  "meta": { "dataAsOf": "…", "granularity": "day" }
}
```

`previousVolume` powers the dashed comparison line. `reminderSent` drives the markers overlaid on the volume chart. **Days with no activity are present as zeros** — the series is never sparse, so the line won't jump gaps.

### `GET /dashboard/funnel?range=30d`

```json
{ "data": [
  { "stage": "invited", "value": 8420 },
  { "stage": "opened", "value": 6104 },
  { "stage": "contributed", "value": 4557 }
] }
```

### `GET /dashboard/status-distribution?range=90d`

```json
{
  "data": [
    { "status": "active", "count": 16, "percent": 33.3 },
    { "status": "completed", "count": 13, "percent": 27.1 }
  ],
  "meta": { "dataAsOf": "…", "totalEvents": 48 }
}
```

### `GET /dashboard/lifecycle-timing?range=90d`

Seven rows. **Median is the headline** — one 90-day outlier must not distort it. Mean goes in the tooltip.

```json
{
  "data": [
    {
      "metric": "time_to_first_contribution",
      "label": "Time to First Contribution",
      "definition": "First confirmed contribution ts − publication ts.",
      "median": 5.6,
      "p90": 38.2,
      "mean": 11.4,
      "unit": "hours",
      "sampleSize": 312,
      "trend": [7, 6, 6, 5, 6, 5, 6]
    }
  ],
  "meta": { "dataAsOf": "…", "eventsConsidered": 340 }
}
```

Metrics, in order: `planned_duration` `published_duration` `time_to_first_contribution` `time_to_50pct_goal` `time_to_goal` `actual_duration` `time_to_delivery`. `unit` is `"days"` or `"hours"` per metric. **Use `sampleSize`** — a median over 3 events is a very different claim from one over 300.

### `GET /dashboard/attention-lists?range=30d`

Five rows each.

```json
{
  "data": {
    "atRisk": [
      { "id": "evt_…", "name": "Ana's Birthday", "progressPercent": 22.4, "endDate": "2026-08-09T10:00:00.000Z",
        "goalAmount": 500000, "raisedAmount": 112000, "currency": "MXN" }
    ],
    "largestActive": [
      { "id": "evt_…", "name": "…", "goalAmount": 900000, "raisedAmount": 410000, "progressPercent": 45.6, "currency": "MXN" }
    ],
    "recentlyCompleted": [
      { "id": "evt_…", "name": "…", "closedAt": "2026-08-05T…", "raisedAmount": 620000, "currency": "MXN" }
    ]
  },
  "meta": { "dataAsOf": "…" }
}
```

`atRisk` = still running, under 50% funded, inside its final 72 hours, ranked by least raised.

---

## 7. Events

> The backend model is `Collection`; the API says **Event** everywhere. No translation needed.

**Filters:** `status` `occasion` `source=personal|group` `currency` `card=yes|no` `progress=0-25|25-50|50-75|75-99|100` `groupId` `organizerId` `dateField=createdAt|endDate` `q`
**Sort:** `name` `status` `goalAmount` `raisedAmount` `contributorsCount` `createdAt` `endDate`
**Statuses:** `draft` `active` `published` `paused` `goal_reached` `completed` `delivered` `cancelled`

`progress=100` means **≥100** — an overfunded event belongs there. `progressPercent` itself is uncapped, so 140% is reported as 140.

### `GET /events?page=1&pageSize=25&status=active`

```json
{
  "data": [
    {
      "id": "6a7574ed9c544abe0f4f9536",
      "name": "Ana's Birthday",
      "occasion": "birthday",
      "status": "active",
      "goalAmount": 500000,
      "raisedAmount": 342000,
      "currency": "MXN",
      "progressPercent": 68.4,
      "contributorsCount": 24,
      "totalMembers": 40,
      "organizer": { "id": "usr_1", "name": "Ana Ramírez", "avatarUrl": null },
      "beneficiaryName": "Luis Torres",
      "beneficiaryType": "someone_else",
      "source": "personal",
      "groupName": null,
      "createdAt": "2026-06-02T10:00:00.000Z",
      "endDate": "2026-08-09T10:00:00.000Z",
      "shareSlug": "birthday-3k1",
      "card": { "slug": "card-4", "name": "Confetti Burst", "thumbUrl": "https://…/thumb.webp" }
    }
  ],
  "meta": { "page": 1, "pageSize": 25, "totalRows": 213, "totalPages": 9 }
}
```

`card` is `null` when none attached. `beneficiaryType` is `self` | `someone_else`.

### `GET /events/:eventId`

The list row plus:

```json
{
  "data": {
    "…": "all list-row fields",
    "personalMessage": "¡Felicidades!",
    "location": "Polanco, CDMX",
    "locationUrl": "https://maps.google.com/?q=…",
    "feePayer": "contributor",
    "publishedAt": "2026-06-02T12:00:00.000Z",
    "halfGoalReachedAt": "2026-06-14T08:30:00.000Z",
    "goalReachedAt": null,
    "closedAt": null,
    "deliveredAt": null,
    "cardRevealed": true,
    "flaggedAt": null,
    "flagReason": null,
    "withdrawal": {
      "status": "processing",
      "availableBalance": 319770,
      "requestedAmount": 319770,
      "stripeAccountStatus": "verified",
      "requestedAt": "2026-08-01T…",
      "completedAt": null,
      "failureReason": null,
      "stripePayoutId": "tr_1P…"
    }
  }
}
```

`withdrawal.status`: `none` `requested` `validated` `processing` `completed` `failed`
`stripeAccountStatus`: `not_started` `pending` `verified` `restricted`

### `GET /events/:eventId/financials` — `financials:read`

```json
{
  "data": {
    "currency": "MXN",
    "goalAmount": 500000,
    "byStatus": {
      "succeeded": { "amount": 342000, "count": 28 },
      "pending":   { "amount": 25000,  "count": 2 },
      "failed":    { "amount": 18000,  "count": 3 },
      "cancelled": { "amount": 0,      "count": 0 },
      "refunded":  { "amount": 0,      "count": 0 }
    },
    "uniqueContributors": 24,
    "contributionCount": 28,
    "averageContribution": 12214,
    "medianContribution": 10000,
    "platformFees": 10260,
    "stripeFees": 11970,
    "netToBeneficiary": 319770
  }
}
```

Every status key is always present, even at zero.

### `GET /events/:eventId/timeline`

Ordered ascending.

```json
{
  "data": [
    {
      "id": "tl_1",
      "category": "event",
      "title": "Event published",
      "description": "Share link activated",
      "actor": "Ana Ramírez",
      "timestamp": "2026-06-02T12:00:00.000Z",
      "elapsedFromPublicationHours": 0,
      "payload": { "shareSlug": "birthday-3k1" }
    }
  ]
}
```

`category`: `event` `invitation` `contribution` `reminder` `card` `withdrawal` `admin`. `payload` is free-form JSON — render it in an expandable block.

### `GET /events/:eventId/participants?participation=contributed`

`participation`: `contributed` | `not_contributed` | `opened_not_contributed`

```json
{
  "data": [
    {
      "id": "par_6a75…",
      "user": { "id": "usr_9", "name": "Diego Flores", "avatarUrl": null },
      "invitedAt": "2026-06-02T12:05:00.000Z",
      "openedAt": "2026-06-02T18:20:00.000Z",
      "contributed": true,
      "amount": 15000,
      "decisionTimeHours": 26.4,
      "paymentStatus": "succeeded",
      "remindersReceived": 2
    }
  ],
  "meta": { "page": 1, "pageSize": 25, "totalRows": 40, "totalPages": 2 }
}
```

`decisionTimeHours` = contribution ts − invitation ts, `null` when there's no matching invitation (they arrived via a share link).

### Remaining event reads

| Method | Path | Perm | Response |
|---|---|---|---|
| GET | `/events/:eventId/contributions` | `contributions:read` | Same rows as §8 |
| GET | `/events/:eventId/card` | `events:read` | See below · `data: null` if no card |
| GET | `/events/:eventId/activity` | `events:read` | Audit rows (§16 shape) scoped to this event |

`GET /events/:eventId/card`:

```json
{
  "data": {
    "slug": "card-4",
    "name": "Confetti Burst",
    "tier": "premium",
    "cloverCostPaid": 250,
    "revealed": true,
    "revealedAt": "2026-08-05T…",
    "uniqueDownloads": 8,
    "totalDownloads": 14,
    "uniqueDownloaders": 8,
    "timeToFirstViewHours": 2.1,
    "timeToFirstDownloadHours": 3.4,
    "errors": [ { "type": "download", "message": "…", "occurredAt": "…" } ]
  }
}
```

### Event actions — `events:write`, all require `reason`

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/events/:id/status-override` | `{ status, reason }` | `{ data: { id, status } }` |
| POST | `/events/:id/force-close` | `{ reason }` | `{ data: { id, status, closedAt } }` · **409** if already closed |
| POST | `/events/:id/resend-reminders` | `{ reason, audience }` | `{ data: { queued: 14 } }` |
| POST | `/events/:id/flag` | `{ reason }` | `{ data: { id, status, flaggedAt, flagReason } }` |

`audience`: `all` | `non_contributors` (default) | `opened_not_contributed`

`status-override` also back-fills the matching lifecycle stamp (forcing `delivered` sets `deliveredAt`, etc.) so the timing metrics don't silently exclude the event. `flag` pauses the event only if it's still running — it won't rewrite a completed or cancelled one.

---

## 8. Contributions

**Filters:** `status` `eventId` `contributorId` `guest=guest|registered` `feePayer=contributor|beneficiary` `method` (prefix, e.g. `Visa`) `amount=0-50|50-100|100-250|250-500|500+` (**major units**) `currency` `q`
**Sort:** `amount` `status` `createdAt` `totalCharged`
**Statuses:** `pending` `succeeded` `failed` `cancelled` `refunded`

`q` matches contribution id, Stripe PaymentIntent id, event name, contributor name, guest name/email.

### `GET /contributions?page=1&pageSize=25` — `contributions:read`

```json
{
  "data": [
    {
      "id": "6a7574…",
      "eventId": "6a7574ed9c544abe0f4f9536",
      "eventName": "Ana's Birthday",
      "contributor": { "id": "usr_7", "name": "Sofía Herrera", "avatarUrl": null },
      "isGuest": false,
      "guestName": null,
      "guestEmail": null,
      "amount": 15000,
      "platformFee": 450,
      "stripeFee": 825,
      "totalCharged": 16275,
      "creditedAmount": 15000,
      "feePayer": "contributor",
      "currency": "MXN",
      "status": "succeeded",
      "failureReason": null,
      "paymentMethod": "Visa •••• 4242",
      "stripePaymentIntentId": "pi_3P…",
      "cardSlug": "card-4",
      "revealed": true,
      "message": "¡Felicidades!",
      "createdAt": "2026-07-08T14:22:00.000Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 25, "totalRows": 4213, "totalPages": 169 }
}
```

`contributor` is `null` for guests — distinguish by `isGuest`, not by the null. `failureReason` carries the verbatim Stripe text, e.g. `"card_declined — Your card was declined."`

### `GET /contributions/kpis?range=30d&compare=1` — `financials:read`

```json
{
  "data": {
    "totalConfirmed":      { "value": 3420000, "currency": "MXN", "previous": 2980000, "delta": 14.8, "deltaUnit": "percent" },
    "totalPending":        { "value": 25000, "currency": "MXN" },
    "totalFailed":         { "value": 18000, "currency": "MXN" },
    "totalCancelled":      { "value": 0, "currency": "MXN" },
    "totalRefunded":       { "value": 0, "currency": "MXN" },
    "averageContribution": { "value": 12214, "currency": "MXN" },
    "medianContribution":  { "value": 10000, "currency": "MXN" },
    "failureRate":         { "value": 7.7, "previous": 6.1, "delta": 1.6, "deltaUnit": "pp" },
    "totalFees":           { "value": 222300, "currency": "MXN" }
  },
  "meta": { "dataAsOf": "…", "range": { "from": "…", "to": "…", "tz": "America/Mexico_City" } }
}
```

**`failureRate` = failed ÷ (succeeded + failed).** Pending is excluded from the denominator — an in-flight attempt hasn't failed.

### `GET /contributions/charts?range=30d` — `financials:read`

```json
{
  "data": {
    "volumeOverTime": [
      { "date": "2026-07-08", "succeeded": 184000, "pending": 5000, "failed": 8000, "cancelled": 0, "refunded": 0 }
    ],
    "sizeDistribution": [ { "bucket": "0-50", "count": 41 }, { "bucket": "50-100", "count": 88 } ],
    "failureReasons": [ { "reason": "insufficient_funds", "count": 34 }, { "reason": "do_not_honor", "count": 21 } ]
  },
  "meta": { "dataAsOf": "…" }
}
```

`failureReasons` is keyed on the **decline code** (the part before the em dash), so one cause isn't scattered across a dozen phrasings.

### `GET /contributions/:id` — `contributions:read`

Full row plus the raw Stripe webhook body for support triage:

```json
{
  "data": {
    "…": "all list-row fields",
    "beneficiary": { "id": "usr_9", "name": "Luis Torres", "avatarUrl": null },
    "fee": 1275,
    "revealedAt": "2026-07-09T…",
    "updatedAt": "2026-07-09T…",
    "webhookPayload": { }
  }
}
```

---

## 9. Users

**Filters:** `verified=yes|no` `state=active|deleted` `provider=local|google|apple` `activity=contributed|organized` `clovers=has|none` `groupId` `q` · **`?unmask=true`** (needs `pii:read`)
**Sort:** `firstName` `lastName` `email` `createdAt` `lastLoginAt` `cloverBalance`

### `GET /users?page=1&pageSize=25` — `users:read`

```json
{
  "data": [
    {
      "id": "usr_7",
      "firstName": "Sofía",
      "lastName": "Herrera",
      "name": "Sofía Herrera",
      "email": "s•••@gmail.com",
      "emailMasked": true,
      "phoneNumber": "••• ••• 4821",
      "avatarUrl": null,
      "isActive": true,
      "isVerified": true,
      "isDeleted": false,
      "authProviders": ["local", "google"],
      "createdAt": "2026-01-14T…",
      "lastLoginAt": "2026-08-06T…",
      "cloverBalance": 320,
      "eventsOrganized": 2,
      "eventsContributedTo": 6,
      "invitationsReceived": 11,
      "invitationConversionPercent": 54.5,
      "totalContributed": 184000,
      "currency": "MXN"
    }
  ],
  "meta": { "page": 1, "pageSize": 25, "totalRows": 8420, "totalPages": 337 }
}
```

`invitationConversionPercent` is capped at 100 — a user can contribute via a share link without an invitation.

### `GET /users/kpis?range=30d&compare=1` — `users:read`

```json
{
  "data": {
    "totalUsers":              { "value": 8420, "previous": 8100, "delta": 4, "deltaUnit": "percent" },
    "newUsers":                { "value": 320, "previous": 280, "delta": 14.3, "deltaUnit": "percent" },
    "activeContributors":      { "value": 1204, "…": "…" },
    "recurrentContributors":   { "value": 412, "…": "…" },
    "avgLifetimeContribution": { "value": 184000, "currency": "MXN" },
    "usersWithCloverBalance":  { "value": 3100, "…": "…" }
  },
  "meta": { "dataAsOf": "…" }
}
```

**`recurrentContributors` = 2+ distinct *events***, not 2+ contributions — two gifts to the same birthday is one relationship.

### `GET /users/:userId` — `users:read`

List row plus:

```json
{
  "data": {
    "…": "all list-row fields",
    "invitationsReceived": 11,
    "eventsContributedTo": 6,
    "invitationConversionPercent": 54.5,
    "totalContributed": 184000,
    "averageContribution": 30666,
    "medianDecisionTimeHours": 26.4,
    "contributionFrequency": 6,
    "recurrence": { "isRecurrent": true, "eventCount": 6 },
    "paymentStatusProfile": { "succeeded": 6, "pending": 0, "failed": 1, "cancelled": 0, "refunded": 0 },
    "cloverActivity": { "earned": 1240, "redeemed": 900, "adjusted": 0, "balance": 320 }
  }
}
```

### Sub-resources

| Method | Path | Perm | Returns |
|---|---|---|---|
| GET | `/users/:userId/events` | `users:read` | Event rows + `relationship: { organized, contributed }` |
| GET | `/users/:userId/contributions` | `contributions:read` | §8 rows |
| GET | `/users/:userId/clovers` | `clovers:read` | §12 ledger rows |
| GET | `/users/:userId/cards` | `cards:read` | See below |
| GET | `/users/:userId/activity` | `audit:read` | Audit rows for this user |

`GET /users/:userId/cards`:

```json
{
  "data": [
    {
      "id": "gc_1", "slug": "confetti-burst", "name": "Confetti Burst",
      "thumbUrl": "https://…/thumb.webp",
      "tier": "premium", "cloverCost": 250,
      "unlockedAt": "2026-05-02T…",
      "revealed": true, "revealedAt": "2026-05-03T…",
      "downloaded": true, "downloadCount": 3
    }
  ]
}
```

### User actions

| Method | Path | Perm | Request | Response |
|---|---|---|---|---|
| POST | `/users/:id/suspend` | `users:read` | `{ reason }` | `{ data: { id, isActive: false } }` · **409** if already suspended |
| POST | `/users/:id/reactivate` | `users:read` | `{ reason }` | `{ data: { id, isActive: true } }` |
| POST | `/users/:id/clovers/adjust` | `clovers:adjust` | `{ amount, reason }` | See below |
| POST | `/users/:id/password-reset` | `users:read` | `{}` | `{ data: { requested: true, delivered: true } }` |
| POST | `/users/:id/pii/unmask` | `pii:read` | `{ reason }` | `{ data: { id, email, phoneNumber } }` |
| POST | `/users/:id/export` | `pii:export` | `{ reason }` | **202** + export job (§15) |

`POST /users/:id/clovers/adjust` — `amount` is **signed**; negative debits:

```json
{ "data": {
  "cloverBalance": 570,
  "transaction": { "id": "clv_…", "user": { "id": "usr_7", "name": "Sofía Herrera", "avatarUrl": null },
    "type": "earn", "action": "admin_adjustment", "amount": 250, "balanceAfter": 570,
    "reference": null, "note": "goodwill credit", "adminName": "Admin", "createdAt": "…" } } }
```

- `amount: 0` → **422**
- Non-integer → **422**
- A debit past zero → **409** with `{ "amount": "exceeds_balance", "balance": 320 }`

---

## 10. Gift card analytics

All require `cards:read`, all accept `range` / `compare`.

### `GET /cards/kpis?range=30d&compare=1`

```json
{
  "data": {
    "cardsCreated":                   { "value": 214, "previous": 190, "delta": 12.6, "deltaUnit": "percent" },
    "standardCount":                  { "value": 140, "…": "…" },
    "premiumCount":                   { "value": 74, "…": "…" },
    "premiumRedeemedWithClovers":     { "value": 61, "…": "…" },
    "revealRate":                     { "value": 74.5, "previous": 71.2, "delta": 3.3, "deltaUnit": "pp" },
    "uniqueDownloads":                { "value": 410, "…": "…" },
    "totalDownloads":                 { "value": 820, "…": "…" },
    "uniqueDownloaders":              { "value": 380, "…": "…" },
    "medianTimeToFirstViewHours":     { "value": 2.1, "…": "…" },
    "medianTimeToFirstDownloadHours": { "value": 3.4, "…": "…" },
    "cardErrors":                     { "value": 11, "…": "…" }
  },
  "meta": { "dataAsOf": "…" }
}
```

### `GET /cards/timeseries?range=30d`

```json
{ "data": [ { "date": "2026-07-08", "standard": 9, "premium": 5 } ], "meta": { "dataAsOf": "…" } }
```

### `GET /cards/templates?sort=timesSelected&dir=desc`

Sortable on **every** column (sorted in memory, since most are computed across three collections).

```json
{
  "data": [
    {
      "id": "gc_1", "slug": "confetti-burst", "name": "Confetti Burst",
      "thumbUrl": "https://…/thumb.webp",
      "timesSelected": 940,
      "selectionSharePercent": 18.2,
      "revealRate": 74.5,
      "uniqueDownloads": 410,
      "totalDownloads": 820,
      "downloadsPerReveal": 1.17,
      "cloverCost": 250,
      "revenueInClovers": 96500
    }
  ],
  "meta": { "page": 1, "pageSize": 25, "totalRows": 32, "totalPages": 2, "dataAsOf": "…" }
}
```

### `GET /cards/funnel?range=30d`

```json
{ "data": [
  { "stage": "selected",   "value": 940, "percentOfSelected": 100 },
  { "stage": "available",  "value": 902, "percentOfSelected": 96 },
  { "stage": "revealed",   "value": 700, "percentOfSelected": 74.5 },
  { "stage": "viewed",     "value": 690, "percentOfSelected": 73.4 },
  { "stage": "downloaded", "value": 410, "percentOfSelected": 43.6 },
  { "stage": "shared",     "value": 120, "percentOfSelected": 12.8 }
] }
```

### `GET /cards/errors?range=30d`

```json
{
  "data": {
    "series": [ { "date": "2026-07-08", "generation": 2, "loading": 5, "reveal": 1, "download": 3 } ],
    "records": [
      { "id": "err_…", "type": "download", "cardSlug": "card-4", "userId": "usr_…",
        "message": "Network timeout", "context": { }, "occurredAt": "…" }
    ]
  },
  "meta": { "dataAsOf": "…" }
}
```

---

## 11. Gift card catalog

The catalog manager: upload designs, set the clover price to unlock them.

**Filters:** `category` `tier=free|premium` `state=active|inactive` `q`
**Sort:** `sort_order` (default) `newest` `most_used` `cost`

### `GET /cards/catalog?page=1&pageSize=25` — `cards:read`

```json
{
  "data": [
    {
      "id": "gc_1",
      "slug": "confetti-burst",
      "name": "Confetti Burst",
      "categories": ["birthday", "general"],
      "bg": "#7C3AED",
      "emojiKey": "🎉",
      "images": {
        "thumb":   "https://cdn…/confetti-burst-400-a1b2.webp",
        "preview": "https://cdn…/confetti-burst-800-c3d4.webp",
        "full":    "https://cdn…/confetti-burst-1600-e5f6.webp"
      },
      "cloverCost": 250,
      "tier": "premium",
      "sortOrder": 1,
      "isActive": true,
      "availableFrom": null,
      "availableUntil": null,
      "version": 2,
      "timesSelected": 940,
      "unlocks": 412,
      "canHardDelete": false,
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "meta": { "page": 1, "pageSize": 25, "totalRows": 32, "totalPages": 2 }
}
```

**`canHardDelete` is the server's answer** — don't infer it from `unlocks === 0`. When false, offer Deactivate. `tier` is derived from `cloverCost`, never stored separately.

### Upload flow (two steps)

**1. `POST /cards/catalog/upload-url` — `cards:write`**

```json
{ "filename": "confetti.png", "contentType": "image/png", "byteSize": 2411002 }
```

```json
{ "data": {
  "uploadUrl": "https://s3…/gift-cards/originals/ast_….png?X-Amz-Signature=…",
  "assetId": "ast_9f3a1c…",
  "expiresIn": 900,
  "method": "PUT",
  "storage": "s3"
} }
```

**2. Upload the bytes**, then pass `assetId` to create/update.

```ts
if (target.method === "PUT") {
  await fetch(target.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
} else {
  // Local fallback when S3 isn't configured — same-origin, needs the session + CSRF
  const form = new FormData();
  form.append("file", file);
  await api.post(target.uploadUrl.replace("/api/v1/admin", ""), form);
}
```

**Server-enforced artwork rules** (validated again server-side, not just in your dropzone): PNG/JPG/WEBP/SVG, ≤ 5 MB, ≥ 1200×1600px, type verified by **magic-byte sniff** not extension. Resized to thumb 400w / preview 800w / full 1600w.

### `POST /cards/catalog` — `cards:write` → **201**

```json
{
  "assetId": "ast_9f3a1c…",
  "name": "Confetti Burst",
  "slug": "confetti-burst",
  "categories": ["birthday"],
  "bg": "#7C3AED",
  "emojiKey": "🎉",
  "tier": "premium",
  "cloverCost": 250,
  "sortOrder": 13,
  "isActive": true,
  "availableFrom": null,
  "availableUntil": null
}
```

Returns the full catalog row. Rules: `slug` unique, lowercase-hyphenated, **immutable after creation**. `tier: "standard"` forces `cloverCost: 0`; `tier: "premium"` requires `cloverCost >= 1`.

### `PATCH /cards/catalog/:id` — `cards:write`

Same body, all fields optional. **Supplying a new `assetId` creates a new `version`** — published artwork is never mutated in place, so a user who unlocked v1 keeps v1. A changed `slug` → **409**.

### Catalog actions

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/cards/catalog/:id` | — | One catalog row |
| GET | `/cards/catalog/:id/versions` | — | `[{ version, images, createdAt, createdBy, isCurrent }]` |
| GET | `/cards/catalog/eligible-count?cloverCost=250` | — | `{ data: { eligibleUsers: 1840, cloverCost: 250 } }` |
| POST | `/cards/catalog/:id/price` | `{ cloverCost, reason }` | `{ data: { id, cloverCost, previousCloverCost, retroactive: false } }` |
| POST | `/cards/catalog/:id/activate` | `{ reason }` | `{ data: { id, isActive: true, retainedByExistingOwners: false } }` |
| POST | `/cards/catalog/:id/deactivate` | `{ reason }` | `{ data: { id, isActive: false, retainedByExistingOwners: true } }` |
| POST | `/cards/catalog/:id/duplicate` | `{}` | **201**, inactive, zeroed counters, auto-suffixed slug |
| PUT | `/cards/catalog/order` | `{ orderedIds: ["gc_3","gc_1"] }` | `{ data: { reordered: 2 } }` |
| DELETE | `/cards/catalog/:id` | `{ reason }` | `{ data: { id, deleted: true } }` · **409** if unlocks or usage exist |
| POST | `/cards/catalog/bulk` | `{ cards: [ … ] }` | **201** array · see below |

`/price` returns `retroactive: false` — **a price change never charges or refunds anyone**. State it in the confirm dialog. Re-submitting the same price → 409.

`DELETE` conflict payload:

```json
{ "error": { "code": "CONFLICT",
  "message": "412 user(s) have unlocked this design. Deactivate it instead.",
  "details": { "unlocks": 412, "timesSelected": 940, "suggestion": "deactivate" } } }
```

### `POST /cards/catalog/bulk` — all-or-nothing

Max 100 rows. If **any** row is invalid, **nothing** is written:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "2 of 40 rows are invalid. No designs were created.",
    "details": {
      "rows": [
        { "index": 7,  "slug": "bad slug", "errors": { "slug": "invalid_format" } },
        { "index": 12, "slug": "bulk-a",   "errors": { "slug": "duplicate_in_batch" } }
      ]
    }
  }
}
```

Map `details.rows[].index` onto your import table. Row error codes: `required` `invalid_format` `already_exists` `duplicate_in_batch`.

---

## 12. Clovers

### `GET /clovers/kpis?range=30d&compare=1` — `clovers:read`

```json
{
  "data": {
    "cloversEarned":           { "value": 41200, "previous": 38000, "delta": 8.4, "deltaUnit": "percent" },
    "cloversRedeemed":         { "value": 13100, "…": "…" },
    "outstandingBalance":      { "value": 184000, "…": "…" },
    "redemptionRate":          { "value": 31.7, "previous": 29.9, "delta": 1.8, "deltaUnit": "pp" },
    "burnRate":                { "value": 31.8, "…": "…" },
    "repeatRedemption":        { "value": 210, "…": "…" },
    "premiumCardDownloadRate": { "value": 68.2, "…": "…" }
  },
  "meta": {
    "dataAsOf": "…",
    "definitions": {
      "burnRate": "Clovers redeemed ÷ clovers earned in range × 100.",
      "outstandingBalance": "Sum of every user's current clover balance — the platform's live liability."
    }
  }
}
```

### `GET /clovers/timeseries?range=30d` — `clovers:read`

```json
{ "data": [ { "date": "2026-07-08", "earned": 1240, "redeemed": 820, "outstandingBalance": 184000 } ] }
```

**`outstandingBalance` is a true running balance**, seeded from everything before the window — the platform's liability curve, not a daily delta.

### `GET /clovers/ledger` — `clovers:read`

**Filters:** `userId` `type=earn|redeem|adjust` `action` `q` · **Sort:** `amount` `createdAt` `balanceAfter`

```json
{
  "data": [
    {
      "id": "clv_6a1",
      "user": { "id": "usr_7", "name": "Sofía Herrera", "avatarUrl": null },
      "type": "earn",
      "action": "first_contribution",
      "amount": 150,
      "balanceAfter": 470,
      "reference": { "type": "event", "id": "evt_2a1", "label": "Ana's Birthday" },
      "note": "",
      "adminName": null,
      "createdAt": "…"
    }
  ],
  "meta": { "page": 1, "pageSize": 25, "totalRows": 12043, "totalPages": 482 }
}
```

`amount` is **signed** — positive earns, negative redemptions. `type=adjust` filters on admin adjustments (stored as earn/redeem with `action: "admin_adjustment"`).

### Remaining clover endpoints

| Method | Path | Perm | Response |
|---|---|---|---|
| GET | `/clovers/earn-breakdown` | `clovers:read` | `[{ action, clovers, transactions }]` |
| GET | `/clovers/redemption-by-design` | `clovers:read` | `[{ cardId, slug, name, redemptions, clovers }]` |
| GET | `/clovers/anomalies` | `clovers:read` | See below |
| POST | `/clovers/anomalies/:id/freeze` | `clovers:adjust` | `{ reason }` → `{ data: { id, frozen: true, userId } }` |
| POST | `/clovers/anomalies/:id/dismiss` | `clovers:adjust` | `{ reason }` → `{ data: { id, dismissed: true, userId } }` |

`GET /clovers/anomalies`:

```json
{
  "data": [
    {
      "id": "anm_6a7574…",
      "user": { "id": "usr_4", "name": "Mateo Cruz", "avatarUrl": null },
      "signal": "earn_velocity",
      "magnitude": "4.5× 30-day baseline",
      "detail": "1,840 clovers earned in 24h vs 410 baseline",
      "detectedAt": "2026-08-07T…"
    }
  ],
  "meta": { "dataAsOf": "…", "threshold": "3× 30-day baseline" }
}
```

Threshold comes from Settings (`clover_multiple`). **Freeze suspends the account** — there is no separate "can't earn" flag.

---

## 13. Withdrawals

**Filters:** `status` `account=not_started|pending|verified|restricted` `q` · **Sort:** `amount` `createdAt` `status`

### `GET /withdrawals?page=1&pageSize=25` — `financials:read`

**Failed payouts sort to the top by default.** Pin them with a danger tint until resolved.

```json
{
  "data": [
    {
      "id": "6a7574…",
      "beneficiary": { "id": "usr_9", "name": "Luis Torres", "avatarUrl": null },
      "eventId": "evt_2a1",
      "eventName": "Ana's Birthday",
      "amount": 319770,
      "currency": "MXN",
      "status": "failed",
      "stripeAccountStatus": "restricted",
      "stripePayoutId": "tr_1P…",
      "requestedAt": "2026-08-01T…",
      "completedAt": null,
      "elapsedHours": 96.4,
      "failureReason": "account_closed — The bank account has been closed."
    }
  ],
  "meta": { "page": 1, "pageSize": 25, "totalRows": 42, "totalPages": 2 }
}
```

`elapsedHours` is **age** for an in-flight payout, duration for a completed one. See §21 for the `eventId` caveat.

### `GET /withdrawals/kpis?range=30d&compare=1` — `financials:read`

```json
{
  "data": {
    "availableForWithdrawal":  { "value": 4820000, "currency": "MXN", "…": "…" },
    "requested":               { "value": 0, "…": "…" },
    "processing":              { "value": 6, "…": "…" },
    "completedInPeriod":       { "value": 128, "…": "…" },
    "failed":                  { "value": 3, "…": "…" },
    "medianTimeToPayoutHours": { "value": 18.4, "…": "…" }
  },
  "meta": { "dataAsOf": "…" }
}
```

### Actions — `payouts:write`, all require `reason`

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/withdrawals/:id/retry` | `{ reason }` + **`Idempotency-Key` header** | `{ data: { id, status: "completed", stripePayoutId } }` |
| POST | `/withdrawals/:id/mark-resolved` | `{ reason }` | `{ data: { id, status: "completed" } }` |
| POST | `/withdrawals/:id/contact` | `{ reason, template }` | `{ data: { id, contacted: true, delivered: true } }` |

**`retry` is 422 without `Idempotency-Key`.** Generate a UUID per user-initiated retry and reuse it if the request itself is retried. Non-failed payout → 409. A retry that Stripe rejects → 409 with `details.failureReason`.

`template`: `payout_failed` | `payout_delayed`. `mark-resolved` records that someone dealt with it out of band — it moves no money.

---

## 14. Alerts

**Filters:** `type` `state=open|acknowledged|snoozed|resolved|dismissed` `severity=info|warning|critical` `assignedTo` (or `unassigned`) `refresh=0`

### `GET /alerts/types` — `alerts:manage`

```json
{
  "data": [
    {
      "type": "stagnant_event",
      "label": "Stagnant Event",
      "defaultTrigger": "No confirmed contribution 72h after publication",
      "currentTrigger": "No confirmed contribution 48h after publication",
      "severity": "warning",
      "openCount": 4
    }
  ],
  "meta": { "dataAsOf": "…" }
}
```

**Show `currentTrigger`, not `defaultTrigger`** — it reflects the live Settings values.

Eight types: `stagnant_event` `at_risk_event` `inactive_event` `payment_friction` `unrevealed_card` `premium_card_unused` `withdrawal_pending` `clover_anomaly`

### `GET /alerts?state=open` — `alerts:manage`

```json
{
  "data": [
    {
      "id": "6a7574…",
      "type": "stagnant_event",
      "severity": "warning",
      "subject": { "type": "event", "id": "evt_2a1", "label": "Ana's Birthday" },
      "triggeredAt": "2026-08-06T07:00:00.000Z",
      "ageHours": 26.4,
      "assignedTo": { "id": "adm_1", "name": "Ana Ramírez" },
      "status": "open",
      "snoozedUntil": null,
      "resolvedAt": null,
      "resolutionReason": null,
      "evidence": [
        { "label": "Published", "value": "4 days ago" },
        { "label": "Confirmed contributions since", "value": "0" },
        { "label": "Threshold", "value": "no contribution 48h after publication" }
      ]
    }
  ],
  "meta": { "page": 1, "pageSize": 25, "totalRows": 18, "totalPages": 1, "dataAsOf": "…" }
}
```

**`evidence` is always present** — the actual numbers that fired the rule. Render it as the expandable row so the admin doesn't have to go re-derive it.

`subject.type`: `event` `user` `card` `withdrawal` `platform`

**Alerts recompute on read.** Pass `?refresh=0` if you're polling frequently.

### Actions — `alerts:manage`

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/alerts/:id/acknowledge` | `{}` | `{ data: { id, status: "acknowledged" } }` · 409 if not open |
| POST | `/alerts/:id/assign` | `{ adminId }` | `{ data: { id, status, assignedTo: { id, name } } }` · also acknowledges |
| POST | `/alerts/:id/snooze` | `{ duration, until? }` | `{ data: { id, status: "snoozed", snoozedUntil } }` |
| POST | `/alerts/:id/resolve` | `{ reason }` | `{ data: { id, status: "resolved" } }` |
| POST | `/alerts/:id/dismiss` | `{ reason }` | `{ data: { id, status: "dismissed" } }` |

`duration`: `1h` | `24h` | `7d` | `custom` (then `until` is required and must be in the future).

**Resolve vs dismiss:** resolve = "it was real and is handled"; dismiss = "the rule was wrong". Dismiss records the evidence into the audit entry so it can feed threshold tuning.

---

## 15. Exports

**Datasets:** `events` `contributions` `users` `cards` `card_downloads` `clover_ledger` `withdrawals` `audit_log`
**PII datasets** (need `pii:export` on top of `exports:run`): everything except `events` and `cards`.

### `POST /exports` — `exports:run` → **202**

```json
{
  "dataset": "contributions",
  "format": "csv",
  "columns": ["id", "eventName", "amount", "currency", "status"],
  "filters": { "range": "30d", "tz": "America/Mexico_City", "status": "succeeded" },
  "reason": "monthly reconciliation"
}
```

```json
{
  "data": {
    "id": "6a7574…",
    "dataset": "contributions",
    "format": "csv",
    "filters": "Last 30 days · status=succeeded",
    "rows": 0,
    "status": "queued",
    "progress": 0,
    "requestedBy": "Regal Admin",
    "requestedAt": "2026-08-07T…",
    "expiresAt": "2026-08-08T…",
    "containsPii": true,
    "errorMessage": null
  },
  "meta": {}
}
```

`columns` is optional — omit for all columns. Empty `columns` returns everything.

### `GET /exports` — `exports:run`

Poll for `status` and `progress`. Statuses: `queued` `running` `ready` `expired` `failed`.

### `GET /exports/:id/download` — `exports:run`

Returns the file with `Content-Disposition: attachment`. **Single use** — a second call is **410 GONE**. Expires after 24 hours.

```ts
// Don't use the axios instance — you want the raw bytes
const res = await fetch(`${base}/exports/${id}/download`, { credentials: "include" });
const blob = await res.blob();
```

Don't auto-retry a failed download — offer "Run again" instead.

### `POST /exports/:id/retry` — `exports:run` → **202**

Failed or expired jobs only; anything else is 409.

### CSV format

Server output is byte-compatible with the panel's own client-side downloads:
UTF-8 **with BOM** · CRLF line endings · money as decimal strings (`"1250.00"`) with a **separate currency column** · leading `=` `+` `-` `@` escaped against formula injection · UTC timestamps with the zone named in the header (`createdAt (UTC)`).

---

## 16. Audit trail

**Append-only and immutable.** There is no update or delete route, and the model itself refuses those operations.

### `GET /audit` — `audit:read`

**Filters:** `adminId` `action` `resourceType` `resourceId` `from` `to` `q` · **Sort:** `timestamp` `action` `adminName`

```json
{
  "data": [
    {
      "id": "aud_8f2",
      "timestamp": "2026-08-06T09:12:00.000Z",
      "admin": { "id": "adm_1", "name": "Ana Ramírez", "avatarUrl": null },
      "action": "card.price_change",
      "resourceType": "Gift card",
      "resource": { "type": "gift_card", "id": "gc_1", "label": "Confetti Burst" },
      "before": { "cloverCost": 250 },
      "after": { "cloverCost": 300 },
      "reason": "seasonal promotion",
      "ip": "189.203.14.62",
      "userAgent": "Chrome 141 / macOS 15.2"
    }
  ],
  "meta": { "page": 1, "pageSize": 25, "totalRows": 8231, "totalPages": 330 }
}
```

`admin.name` is snapshotted at write time, so the trail still reads correctly after an admin is renamed or revoked.

### `GET /audit/actions` — `audit:read`

Distinct values **actually present** in the trail, for the filter dropdowns:

```json
{ "data": {
  "actions": ["auth.login", "card.create", "card.price_change", "settings.update", "…"],
  "resourceTypes": ["Admin", "Event", "Gift card", "Settings", "User"],
  "admins": [ { "id": "adm_1", "name": "Regal Admin", "email": "admin@gmail.com" } ]
} }
```

### Action vocabulary

`event.status_override` `event.force_close` `event.resend_reminders` `event.flag_for_review` `user.suspend` `user.reactivate` `user.password_reset` `user.export` `clover.adjust` `clover.anomaly_freeze` `clover.anomaly_dismiss` `card.create` `card.update` `card.price_change` `card.activate` `card.deactivate` `card.duplicate` `card.delete` `card.reorder` `card.bulk_create` `alert.acknowledge` `alert.assign` `alert.snooze` `alert.resolve` `alert.dismiss` `withdrawal.retry` `withdrawal.mark_resolved` `withdrawal.contact` `admin.create` `admin.update` `admin.revoke` `admin.restore` `admin.reset_2fa` `export.run` `export.download` `settings.update` `pii.unmask` `auth.login` `auth.login_failed` `auth.logout` `auth.password_change`

---

## 17. Admin users

All require `admins:manage`. **Filters:** `role` `state=active|revoked` `q`

### `GET /admins`

```json
{
  "data": [
    {
      "id": "adm_2",
      "name": "Diego Flores",
      "email": "diego@regal.app",
      "role": "operations",
      "isActive": true,
      "twoFactorEnabled": true,
      "lastLoginAt": "2026-08-06T08:12:00.000Z",
      "createdAt": "2026-02-01T…"
    }
  ],
  "meta": { "page": 1, "pageSize": 25, "totalRows": 6, "totalPages": 1 }
}
```

### Actions

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/admins` | `{ name, email, role, twoFactorEnabled? }` | **201** + admin row |
| PATCH | `/admins/:id` | `{ name?, role?, twoFactorEnabled?, reason? }` | Admin row |
| POST | `/admins/:id/revoke` | `{ reason }` | Admin row · ends live sessions |
| POST | `/admins/:id/restore` | `{ reason }` | Admin row |
| POST | `/admins/:id/reset-2fa` | `{ reason }` | Admin row · ends live sessions |

**Never send a password on create.** The backend generates the credential and emails an activation link; the new admin has `mustChangePassword: true`.

**You cannot revoke or demote yourself** → 409 "You cannot change your own role or access. Ask another Super Admin."

---

## 18. Settings

### `GET /settings` — any signed-in admin

```json
{
  "data": {
    "alertThresholds": {
      "stagnant_hours": 72, "at_risk_progress": 40, "at_risk_hours": 48, "inactive_days": 7,
      "friction_event": 15, "friction_platform": 10, "unrevealed_hours": 48,
      "premium_unused_days": 7, "withdrawal_hours": 72, "clover_multiple": 3
    },
    "cloverRules": {
      "earn_event_created": 100, "earn_first_contribution": 150, "earn_invite_accepted": 25,
      "earn_referral": 200, "earn_profile": 50, "cap_daily": 500, "expiry_days": 0
    },
    "financial": {
      "platform_fee": 3, "default_fee_payer": "contributor",
      "supported_currencies": ["MXN"], "min_withdrawal": 100
    },
    "notifications": {
      "digest": "daily",
      "routing": { "payment_friction": ["adm_1", "adm_3"], "clover_anomaly": ["adm_1"] }
    },
    "branding": {
      "logoUrl": "", "support_email": "soporte@regal.app",
      "terms_url": "", "privacy_url": "", "maintenance_mode": false
    }
  },
  "meta": {
    "defaults": { "stagnant_hours": 72, "at_risk_progress": 40, "…": "…" },
    "notes": {
      "min_withdrawal": "MAJOR units (pesos) — this is an admin config value, not a transaction amount.",
      "cap_daily": "0 disables the daily clover cap.",
      "expiry_days": "0 means clovers never expire."
    }
  }
}
```

`meta.defaults` powers the "Default: 72 · Reset to default" affordance next to every field — don't keep a second copy.

### `PUT /settings` — `settings:write`

Partial object plus `reason`:

```json
{ "alertThresholds": { "stagnant_hours": 48 }, "reason": "tightening for the holiday season" }
```

```json
{ "data": { "…": "the full settings object" }, "meta": { "changedKeys": ["alertThresholds.stagnant_hours"] } }
```

Writes **one** audit entry containing every changed key's before → after. Out-of-range values are rejected per key:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Some settings could not be saved.",
  "details": { "alertThresholds.stagnant_hours": "must be between 1 and 8760" } } }
```

---

## 19. Global search

### `GET /search?q=ana&limit=12` — any signed-in admin

Powers ⌘K. Minimum 2 characters; below that it returns `[]` with a note.

```json
{
  "data": [
    { "type": "event",        "id": "evt_2a1", "title": "Ana's Birthday", "subtitle": "Ana Ramírez · birthday-3k1", "href": "/events/evt_2a1" },
    { "type": "user",         "id": "usr_1",   "title": "Ana Ramírez",    "subtitle": "a•••@regal.app",             "href": "/users/usr_1" },
    { "type": "contribution", "id": "con_4b2", "title": "150 MXN",        "subtitle": "Ana's Birthday · succeeded", "href": "/contributions/con_4b2" },
    { "type": "card",         "id": "gc_1",    "title": "Confetti Burst", "subtitle": "Premium · 250 clovers",      "href": "/cards/catalog/gc_1" }
  ],
  "meta": { "query": "ana", "totalMatches": 18 }
}
```

**Results respect the caller's permissions** — a role without `contributions:read` never sees a contribution row. Emails are always masked here, even for callers who could unmask.

---

## 20. Gotchas that will cost you an afternoon

1. **`withCredentials: true` on every request.** Forget it and login "succeeds" then everything 401s, which looks like a session bug rather than a config one.

2. **Mandatory `reason` on most mutations** — 422 without it. Make it a required field in every confirm dialog. Affected: status override, force close, resend reminders, flag, suspend, reactivate, clover adjust, price change, activate, deactivate, delete card, alert resolve, alert dismiss, all three payout actions, settings update, admin revoke/restore/reset-2FA, exports, PII unmask, user export.

3. **`POST /withdrawals/:id/retry` needs an `Idempotency-Key` header** — 422 without one.

4. **`delta` is `null` when `previous` is 0.** Render "—", not "Infinity%".

5. **Async endpoints return 202, not 200** — `POST /exports`, `POST /users/:id/export`. Poll for status.

6. **Export downloads are single-use** — second call is 410. Never auto-retry; offer "Run again".

7. **`canHardDelete` comes from the server.** Don't infer it. When false, offer Deactivate.

8. **Card slugs are immutable** — PATCH with a changed slug is 409. Offer Duplicate.

9. **Bulk card import is all-or-nothing** — 422 with `details.rows[]`, nothing written.

10. **`?unmask=true` is silently ignored** without `pii:read`. Check `emailMasked` on the row rather than assuming the flag worked.

11. **Always send `tz`** on ranged queries, or month-end reports lose their last hours.

12. **`pageSize` is capped at 100** — a larger request is clamped, not rejected, so `data.length` may be under what you asked for.

13. **Unknown `sort` fields fall back to the default** rather than erroring — if sorting looks stuck, check the field is in the allow-list for that endpoint.

---

## 21. Known data-model caveats

Two places where this backend genuinely differs from the panel's framing. Neither is a bug; both are worth designing around:

**1. Withdrawals are per-user, not per-event.** The backend credits a beneficiary's wallet from every event they receive and drains it with a single payout. So on a withdrawal row, `eventId` / `eventName` are **best-effort** (the beneficiary's most recent event) and may be `null`. Every other field is recorded, not inferred. Don't build a UI that promises a strict one-payout-per-event relationship.

**2. `requested` and `validated` payout statuses never appear at rest.** The backend passes through them inside a single request. In practice you will only see `processing`, `completed` and `failed`, and the `requested` KPI is always `0`.

### Endpoints that return correctly-shaped zeros until the app emits telemetry

Implemented and stable — they fill in as the mobile app starts writing to the new event streams. Build against them now; the shapes won't change.

- Gift-card analytics (`/cards/kpis`, `/cards/funnel`, `/cards/errors`) — needs the card event log
- Reminder markers on the dashboard timeseries — admin-triggered resends already write them; scheduled ones don't yet
- Invitation open rates and the funnel's "opened" stage — needs `openedAt` on invitations

---

## Quick verification

```bash
# 1. Log in, keep the cookie
curl -s -c jar.txt -X POST http://localhost:5000/api/v1/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@gmail.com","password":"Admin123@"}' | jq

# 2. Use it
curl -s -b jar.txt 'http://localhost:5000/api/v1/admin/dashboard/kpis?range=30d&compare=1&tz=America/Mexico_City' | jq

# 3. A mutation needs the CSRF token from step 1
curl -s -b jar.txt -X POST http://localhost:5000/api/v1/admin/cards/catalog \
  -H 'Content-Type: application/json' -H 'X-CSRF-Token: <token from step 1>' \
  -d '{"name":"Test","slug":"test-card","tier":"premium","cloverCost":250}' | jq
```
