# Regal Admin Panel — Backend API Requirements

**For:** backend developer
**From:** admin panel frontend
**Status:** the panel is fully built and currently runs on fixtures in `src/lib/mock/data.ts`. This document is the complete list of endpoints needed to replace those fixtures with real data. Nothing else is missing — when these ship, the mock layer is deleted.

**Ground rule on naming:** the backend model is called `Collection`; the UI says **Event** everywhere. Please expose it as `event` in the admin API so no translation layer is needed. Every other field name below matches `src/lib/types.ts` exactly — if you return these names verbatim, the frontend needs zero mapping code.

---

## Table of contents

1. [Conventions](#1-conventions)
2. [Authentication & session](#2-authentication--session)
3. [Roles & permissions](#3-roles--permissions)
4. [Dashboard](#4-dashboard)
5. [Events](#5-events)
6. [Contributions](#6-contributions)
7. [Users](#7-users)
8. [Gift card analytics](#8-gift-card-analytics)
9. [Gift card catalog](#9-gift-card-catalog)
10. [Clovers](#10-clovers)
11. [Withdrawals](#11-withdrawals)
12. [Alerts](#12-alerts)
13. [Exports](#13-exports)
14. [Audit trail](#14-audit-trail)
15. [Admin users](#15-admin-users)
16. [Settings](#16-settings)
17. [Global search](#17-global-search)
18. [Schema gaps that block screens](#18-schema-gaps-that-block-screens)
19. [Analytics events to emit](#19-analytics-events-to-emit)
20. [Non-functional requirements](#20-non-functional-requirements)
21. [Suggested delivery order](#21-suggested-delivery-order)

---

## 1. Conventions

### Base URL

```
{API_BASE}/api/v1/admin
```

The frontend reads `VITE_API_BASE_URL`. Admin routes must be namespaced separately from the mobile app's routes so they can be firewalled, rate-limited and audited independently.

### Response envelope

Every successful response:

```json
{
  "data": { },
  "meta": { }
}
```

Every list response:

```json
{
  "data": [ ],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "totalRows": 4213,
    "totalPages": 169,
    "dataAsOf": "2026-08-06T09:49:00.000Z"
  }
}
```

`meta.dataAsOf` is required on anything served from a pre-computed rollup rather than a live query. The panel renders it as a "Data as of HH:MM" stamp so admins know whether a number is live or cached.

### Errors

HTTP status + a stable machine code. The panel shows `message` to the admin, so write it for a human.

```json
{
  "error": {
    "code": "INSUFFICIENT_PERMISSION",
    "message": "Your role cannot run exports.",
    "details": { "required": "exports:run" }
  }
}
```

| Code | HTTP | When |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No/expired session. Frontend redirects to `/login`. |
| `INSUFFICIENT_PERMISSION` | 403 | Role lacks the permission. |
| `CSRF_INVALID` | 403 | Missing/bad CSRF token on a mutation. |
| `NOT_FOUND` | 404 | Unknown id. |
| `VALIDATION_FAILED` | 422 | Include `details` keyed by field name. |
| `CONFLICT` | 409 | e.g. deleting a card that has unlocks. |
| `RATE_LIMITED` | 429 | Include `Retry-After` header. |
| `INTERNAL` | 500 | Generic. |

### Pagination, sorting, filtering

**All filtering, sorting and pagination is server-side.** The panel never receives a full table. Standard query params on every list endpoint:

| Param | Example | Notes |
|---|---|---|
| `page` | `2` | 1-indexed. Default 1. |
| `pageSize` | `25` | Default 25, max 100. |
| `sort` | `createdAt` | Field name. |
| `dir` | `desc` | `asc` \| `desc`. |
| `q` | `ana` | Free-text search. Scope documented per endpoint. |
| `from` / `to` | `2026-07-01` / `2026-07-31` | **Inclusive of both endpoints.** |
| `range` | `30d` | Preset shorthand, see below. |
| `tz` | `America/Mexico_City` | IANA zone the range is bucketed in. |
| `compare` | `1` | When set, include `previous` values for deltas. |

Range presets the panel sends: `today`, `yesterday`, `7d`, `30d`, `90d`, `mtd`, `last_month`, `qtd`, `ytd`, `custom`. With `custom`, `from`/`to` are sent instead.

When `compare=1`, KPI responses must include the previous-period figure so the frontend can render the "▲ 12.4% vs previous period" pill:

```json
{ "value": 1284, "previous": 1142, "delta": 12.4, "deltaUnit": "percent" }
```

`deltaUnit` is `"percent"` for counts and money, `"pp"` (percentage points) when the metric is itself a rate.

### Money

**Money is transmitted as integer minor units plus an explicit currency code. Never send a float, never send a pre-formatted string.**

```json
{ "goalAmount": 500000, "currency": "MXN" }
```

`500000` = $5,000.00 MXN. The frontend has a single `formatMoney(minorUnits, currency)` helper and division by 100 happens only there.

If multi-currency is ever enabled, aggregate endpoints must either (a) group by currency, or (b) return a converted total **with** the FX rate and its as-of timestamp. Summing across currencies without both is a reconciliation bug. See open question 1 in the design spec — currently the panel assumes MXN only.

### Dates

All timestamps ISO 8601 with `Z` (UTC). The panel converts to the admin's timezone for display. Date-only filters (`from`/`to`) are interpreted in the `tz` param.

### Mutations

- All mutations are `POST`/`PATCH`/`PUT`/`DELETE` and require a CSRF token (header `X-CSRF-Token`, value from the `/auth/me` response).
- All mutations accept an optional `Idempotency-Key` header. Retries with the same key must not double-apply. **Required** on financial actions (payout retry, clover adjustment).
- Every mutation listed in this document **must write an audit entry** (§14) with before/after values. Where the panel collects a mandatory reason, it is sent as `reason` and must be stored.

---

## 2. Authentication & session

**Admin accounts are created by the backend — there is no self-service signup, and the panel has no "create account" screen.** Provisioning happens either through a seed/CLI command or by an existing Super Admin (§15). First-time credentials are delivered out of band.

### `POST /auth/login`

```json
{ "email": "ana@regal.app", "password": "••••••••", "rememberMe": false }
```

**200 — success**
```json
{
  "data": {
    "admin": {
      "id": "adm_1",
      "name": "Ana Ramírez",
      "email": "ana@regal.app",
      "role": "super_admin",
      "permissions": ["events:read", "events:write", "..."],
      "avatarUrl": null,
      "twoFactorEnabled": true,
      "lastLoginAt": "2026-08-06T08:12:00.000Z",
      "mustChangePassword": false
    },
    "csrfToken": "…"
  }
}
```

**200 — 2FA required** (the panel swaps the form for a 6-digit code input)
```json
{ "data": { "status": "2fa_required", "challengeId": "chl_…", "expiresIn": 300 } }
```

**Non-negotiables:**
- The session token goes in an **httpOnly, Secure, SameSite=Strict cookie**. Never in the response body, never in `localStorage`.
- `rememberMe: true` → 30-day cookie. `false` → session cookie.
- Idle timeout **30 minutes**. The panel shows a 2-minute warning modal with "Stay signed in", which calls `POST /auth/heartbeat`.
- **Rate limit: 5 failed attempts per email+IP, then lock for 15 minutes.** Return `429` with `Retry-After` so the panel can show a live countdown.
- On bad credentials return a single generic error — never reveal whether the email exists:
  `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Incorrect email or password." } }`
- Suspended account: `{ "code": "ACCOUNT_DISABLED", "message": "This account has been disabled. Contact your administrator." }`
- **Every attempt, success or failure, writes an audit entry with IP and user-agent.**

### `POST /auth/2fa/verify`

```json
{ "challengeId": "chl_…", "code": "123456" }
```
Same success payload as login. `POST /auth/2fa/resend` has a 30-second cooldown.

### `GET /auth/me`

Returns the current admin (same shape as `data.admin` above) plus a fresh `csrfToken`. Called on every app boot; `401` sends the user to `/login`.

### `POST /auth/logout`

Clears the cookie server-side. Always `204`.

### `POST /auth/heartbeat`

Extends the idle window. `204`.

### `POST /auth/forgot-password` → `POST /auth/reset-password`

```json
{ "email": "ana@regal.app" }
```
Always `204` regardless of whether the email exists. Reset token single-use, 1-hour expiry.

```json
{ "token": "…", "password": "••••••••" }
```

### `POST /auth/change-password`

Required when `mustChangePassword` is true (first login with backend-issued credentials).

```json
{ "currentPassword": "…", "newPassword": "…" }
```

---

## 3. Roles & permissions

Five roles. Enforcement is **server-side on every route** — the panel hides what a role cannot do, but hidden buttons are not security.

| Role | Intent |
|---|---|
| `super_admin` | Everything, including admin management and settings. |
| `finance` | Financial data, contributions, withdrawals, exports. No PII unmasking beyond reconciliation needs. |
| `operations` | Events, alerts, users, cards, clovers. Money as aggregates only; no payout actions. |
| `support` | Read-only across events and users, PII unmasking with audit. No financial actions, no exports. |
| `analyst` | Read-only aggregates and charts. No individual PII, no actions. |

Permission strings the frontend checks (`src/lib/permissions.ts`):

```
events:read      events:write     contributions:read   financials:read
payouts:write    users:read       pii:read             pii:export
cards:read       cards:write      clovers:read         clovers:adjust
alerts:manage    exports:run      audit:read           admins:manage
settings:write
```

### `GET /admins/permissions`

Returns the role × permission matrix so the Admins screen renders from server truth rather than a hardcoded copy:

```json
{
  "data": {
    "permissions": ["events:read", "..."],
    "roles": {
      "super_admin": { "label": "Super Admin", "description": "…", "permissions": ["…"] },
      "finance": { "label": "Finance", "description": "…", "permissions": ["…"] }
    }
  }
}
```

---

## 4. Dashboard

Screen: `/`. All figures respect the global date range and `compare` flag.

### `GET /dashboard/kpis`

Eight cards. Each is clickable and drills into a filtered list, so please also return the filter that reproduces the number.

```json
{
  "data": {
    "activeEvents":        { "value": 16,      "previous": 14,      "delta": 14.3, "deltaUnit": "percent" },
    "eventsCreated":       { "value": 48,      "previous": 41,      "delta": 17.1, "deltaUnit": "percent" },
    "eventSuccessRate":    { "value": 72.4,    "previous": 70.0,    "delta": 2.4,  "deltaUnit": "pp" },
    "avgEventDurationDays":{ "value": 8.3,     "previous": 9.1,     "delta": -8.8, "deltaUnit": "percent" },
    "totalConfirmed":      { "value": 3420000, "previous": 2980000, "delta": 14.8, "deltaUnit": "percent", "currency": "MXN" },
    "participationRate":   { "value": 54.1,    "previous": 51.7,    "delta": 2.4,  "deltaUnit": "pp" },
    "cardDownloads":       { "unique": 1204, "total": 2310, "previous": 1090, "delta": 10.5, "deltaUnit": "percent" },
    "cloverRedemptionRate":{ "value": 31.7,    "previous": 29.9,    "delta": 1.8,  "deltaUnit": "pp" }
  },
  "meta": { "dataAsOf": "2026-08-06T09:49:00.000Z" }
}
```

**Each KPI needs a written definition.** The panel shows an ⓘ tooltip with the exact formula so admins never guess. Either hardcode them with us, or return a `definition` string per KPI. Definitions we need agreed:

- **Event Success Rate** — events reaching 100% of goal ÷ events published in range. Confirm: do `cancelled` events count in the denominator?
- **Participation Rate** — distinct users with ≥1 **confirmed** contribution ÷ distinct users invited. Failed attempts are not participation.
- **Clover Redemption Rate** — users who redeemed ≥1 premium card ÷ users with a non-zero balance at any point in range.
- **Average Event Duration** — mean of (closure − publication) for events closed in range.

### `GET /dashboard/timeseries?granularity=day|week`

```json
{
  "data": [
    {
      "date": "2026-07-08",
      "eventsCreated": 12, "eventsCompleted": 8,
      "contributionVolume": 184000, "contributionCount": 26,
      "previousVolume": 151000,
      "reminderSent": true
    }
  ]
}
```

`reminderSent` drives the markers overlaid on the volume chart so post-reminder spikes are visible. `previousVolume` powers the dashed comparison line.

### `GET /dashboard/funnel`

```json
{ "data": [ { "stage": "invited", "value": 8420 }, { "stage": "opened", "value": 6104 }, { "stage": "contributed", "value": 4557 } ] }
```

### `GET /dashboard/status-distribution`

```json
{ "data": [ { "status": "active", "count": 16, "percent": 33.3 }, { "status": "completed", "count": 13, "percent": 27.1 } ] }
```

### `GET /dashboard/lifecycle-timing`

Seven rows. **Median is the headline, not mean** — one 90-day outlier must not distort it. Mean goes in the tooltip.

```json
{
  "data": [
    {
      "metric": "time_to_first_contribution",
      "label": "Time to First Contribution",
      "definition": "First confirmed contribution ts − publication ts",
      "median": 5.6, "p90": 38.2, "mean": 11.4,
      "unit": "hours",
      "trend": [7, 6, 6, 5, 6, 5, 6]
    }
  ]
}
```

Metrics required: `planned_duration`, `published_duration`, `time_to_first_contribution`, `time_to_50pct_goal`, `time_to_goal`, `actual_duration`, `time_to_delivery`.

### `GET /dashboard/attention-lists`

```json
{
  "data": {
    "atRisk":            [ { "id": "evt_…", "name": "…", "progressPercent": 22.4, "endDate": "…", "goalAmount": 500000, "currency": "MXN" } ],
    "largestActive":     [ { "id": "evt_…", "name": "…", "goalAmount": 900000, "raisedAmount": 410000, "currency": "MXN" } ],
    "recentlyCompleted": [ { "id": "evt_…", "name": "…", "closedAt": "…", "raisedAmount": 620000, "currency": "MXN" } ]
  }
}
```

Five rows each.

---

## 5. Events

### `GET /events`

Query params — these are the exact keys the panel sends:

| Param | Values |
|---|---|
| `status` | `draft` `active` `published` `paused` `goal_reached` `completed` `delivered` `cancelled` |
| `occasion` | `birthday` `wedding` `farewell` `graduation` `baby` `thanks` `holiday` `general` |
| `source` | `personal` \| `group` |
| `currency` | `MXN` |
| `card` | `yes` \| `no` (has a gift card attached) |
| `progress` | `0-25` `25-50` `50-75` `75-99` `100` (percent of goal; `100` means ≥100) |
| `groupId` | group/school id |
| `organizerId` | user id |
| `dateField` | `createdAt` \| `endDate` — which field `from`/`to` apply to |
| `q` | matches event name, organizer name, beneficiary name, event id, share slug |

Row shape:

```json
{
  "id": "evt_2a1",
  "name": "Ana's Birthday",
  "occasion": "birthday",
  "status": "active",
  "goalAmount": 500000,
  "raisedAmount": 342000,
  "currency": "MXN",
  "progressPercent": 68.4,
  "contributorsCount": 24,
  "totalMembers": 40,
  "organizer":   { "id": "usr_1", "name": "Ana Ramírez", "avatarUrl": null },
  "beneficiaryName": "Luis Torres",
  "beneficiaryType": "someone_else",
  "source": "personal",
  "groupName": null,
  "createdAt": "2026-06-02T10:00:00.000Z",
  "endDate":   "2026-08-09T10:00:00.000Z",
  "shareSlug": "birthday-3k1",
  "card": { "slug": "card-4", "name": "Confetti Burst", "thumbUrl": "https://…/thumb.webp" }
}
```

`card` is `null` when none attached.

### `GET /events/{eventId}`

The list row plus:

```json
{
  "personalMessage": "¡Felicidades!",
  "location": "Polanco, CDMX",
  "locationUrl": "https://maps.google.com/?q=…",
  "feePayer": "contributor",
  "publishedAt": "…", "halfGoalReachedAt": "…", "goalReachedAt": "…",
  "closedAt": "…", "deliveredAt": "…",
  "cardRevealed": true,
  "withdrawal": {
    "status": "processing",
    "availableBalance": 319770,
    "requestedAmount": 319770,
    "stripeAccountStatus": "verified",
    "requestedAt": "…", "completedAt": null,
    "failureReason": null,
    "stripePayoutId": "po_…"
  }
}
```

`withdrawal.status`: `none` `requested` `validated` `processing` `completed` `failed`.
`stripeAccountStatus`: `not_started` `pending` `verified` `restricted`.
`failureReason` must be the **verbatim Stripe message** — support needs the exact text.

### `GET /events/{eventId}/financials`

The Overview tab needs the full breakdown; one aggregate total is not enough.

```json
{
  "data": {
    "currency": "MXN",
    "goalAmount": 500000,
    "byStatus": {
      "succeeded": { "amount": 342000, "count": 28 },
      "pending":   { "amount": 25000,  "count": 2 },
      "failed":    { "amount": 18000,  "count": 3 },
      "cancelled": { "amount": 0,      "count": 0 }
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

> `cancelled` does not exist in `ContributionStatus` today (see §18). Return `0`/`null` until it does — the UI already renders `—` for it.

### `GET /events/{eventId}/timeline`

Ordered ascending. `elapsedFromPublicationHours` is where the §4 lifecycle metrics come from.

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

`category`: `event` `invitation` `contribution` `reminder` `card` `withdrawal` `admin`. `payload` is free-form JSON, shown in an expandable block.

### `GET /events/{eventId}/participants`

Filter: `?participation=contributed|not_contributed|opened_not_contributed`

```json
{
  "data": [
    {
      "id": "par_1",
      "user": { "id": "usr_9", "name": "Diego Flores", "avatarUrl": null },
      "invitedAt": "…", "openedAt": "…",
      "contributed": true,
      "amount": 15000,
      "decisionTimeHours": 26.4,
      "paymentStatus": "succeeded",
      "remindersReceived": 2
    }
  ]
}
```

`decisionTimeHours` = contribution ts − invitation ts.

### `GET /events/{eventId}/contributions`

Same shape and params as `GET /contributions`, pre-filtered.

### `GET /events/{eventId}/card`

```json
{
  "data": {
    "slug": "card-4", "name": "Confetti Burst", "tier": "premium",
    "cloverCostPaid": 250,
    "revealed": true, "revealedAt": "…",
    "uniqueDownloads": 8, "totalDownloads": 14, "uniqueDownloaders": 8,
    "timeToFirstViewHours": 2.1, "timeToFirstDownloadHours": 3.4,
    "errors": [ { "type": "download", "message": "…", "occurredAt": "…" } ]
  }
}
```

### `GET /events/{eventId}/activity`

Audit entries scoped to this event; same shape as §14.

### Admin actions

All require `events:write`, a mandatory `reason`, and write an audit entry.

| Endpoint | Body | Effect |
|---|---|---|
| `POST /events/{id}/status-override` | `{ "status": "completed", "reason": "…" }` | Force a status. Panel requires typing the event name to confirm. |
| `POST /events/{id}/force-close` | `{ "reason": "…" }` | Close collection now; sets `closedAt`. |
| `POST /events/{id}/resend-reminders` | `{ "reason": "…", "audience": "non_contributors" }` | Returns `{ "queued": 14 }`. |
| `POST /events/{id}/flag` | `{ "reason": "…" }` | Flags for review; panel pauses the event. |

---

## 6. Contributions

### `GET /contributions`

| Param | Values |
|---|---|
| `status` | `pending` `succeeded` `failed` `cancelled` |
| `eventId` | event id |
| `contributorId` | user id |
| `guest` | `guest` \| `registered` |
| `feePayer` | `contributor` \| `beneficiary` |
| `method` | payment method prefix, e.g. `Visa`, `OXXO`, `SPEI` |
| `amount` | `0-50` `50-100` `100-250` `250-500` `500+` — **major units** (MXN), not centavos |
| `currency` | `MXN` |
| `q` | contribution id, Stripe PaymentIntent id, event name, contributor name, guest name/email |

```json
{
  "id": "con_4b2",
  "eventId": "evt_2a1",
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
  "paymentMethod": "Visa •••4242",
  "stripePaymentIntentId": "pi_3P…",
  "cardSlug": "card-4",
  "revealed": true,
  "message": "¡Felicidades!",
  "createdAt": "…"
}
```

`failureReason` should carry the Stripe decline code and its human message, e.g. `"card_declined — insufficient_funds"`.

### `GET /contributions/kpis`

```json
{
  "data": {
    "totalConfirmed": { "value": 3420000, "currency": "MXN", "previous": 2980000, "delta": 14.8, "deltaUnit": "percent" },
    "totalPending":   { "value": 25000,  "currency": "MXN" },
    "totalFailed":    { "value": 18000,  "currency": "MXN" },
    "totalCancelled": { "value": 0,      "currency": "MXN" },
    "averageContribution": { "value": 12214, "currency": "MXN" },
    "medianContribution":  { "value": 10000, "currency": "MXN" },
    "failureRate":  { "value": 7.7, "previous": 6.1, "delta": 1.6, "deltaUnit": "pp" },
    "totalFees":    { "value": 222300, "currency": "MXN" }
  }
}
```

### `GET /contributions/charts`

```json
{
  "data": {
    "volumeOverTime": [ { "date": "2026-07-08", "succeeded": 184000, "pending": 5000, "failed": 8000, "cancelled": 0 } ],
    "sizeDistribution": [ { "bucket": "0-50", "count": 41 }, { "bucket": "50-100", "count": 88 } ],
    "failureReasons": [ { "reason": "insufficient_funds", "count": 34 }, { "reason": "do_not_honor", "count": 21 } ]
  }
}
```

### `GET /contributions/{id}`

Full record plus the **raw Stripe webhook payload** — support triage depends on it.

```json
{ "data": { "...": "…", "webhookPayload": { } } }
```

---

## 7. Users

### `GET /users`

| Param | Values |
|---|---|
| `verified` | `yes` \| `no` |
| `state` | `active` \| `deleted` |
| `provider` | `local` \| `google` \| `apple` |
| `activity` | `contributed` \| `organized` |
| `clovers` | `has` \| `none` |
| `groupId` | group id |
| `q` | first name, last name, email, user id |

```json
{
  "id": "usr_7",
  "firstName": "Sofía",
  "lastName": "Herrera",
  "email": "s•••@gmail.com",
  "emailMasked": true,
  "phoneNumber": "••• ••• 4821",
  "avatarUrl": null,
  "isActive": true,
  "isVerified": true,
  "isDeleted": false,
  "authProviders": ["local", "google"],
  "createdAt": "…",
  "lastLoginAt": "…",
  "eventsOrganized": 2,
  "eventsContributedTo": 6,
  "invitationsReceived": 11,
  "invitationConversionPercent": 54.5,
  "totalContributed": 184000,
  "currency": "MXN",
  "cloverBalance": 320
}
```

**PII masking is a server responsibility.** Mask `email` and `phoneNumber` by default and set `emailMasked: true`. Only return them in full when the caller holds `pii:read` **and** sent `?unmask=true` — and that request writes an audit entry. Do not rely on the frontend to mask; a masked-in-UI-only response still leaks in devtools.

### `GET /users/kpis`

`totalUsers`, `newUsers`, `activeContributors`, `recurrentContributors` (2+ events), `avgLifetimeContribution`, `usersWithCloverBalance` — each in the standard value/previous/delta shape.

### `GET /users/{userId}`

List shape plus the Overview metrics:

```json
{
  "invitationsReceived": 11,
  "eventsContributedTo": 6,
  "invitationConversionPercent": 54.5,
  "totalContributed": 184000,
  "averageContribution": 30666,
  "medianDecisionTimeHours": 26.4,
  "contributionFrequency": 4,
  "recurrence": { "isRecurrent": true, "eventCount": 6 },
  "paymentStatusProfile": { "succeeded": 6, "pending": 0, "failed": 1, "cancelled": 0 },
  "cloverActivity": { "earned": 1240, "redeemed": 900, "adjusted": 0, "balance": 320 }
}
```

### Sub-resources

| Endpoint | Returns |
|---|---|
| `GET /users/{id}/events` | Events organized and contributed to |
| `GET /users/{id}/contributions` | Contribution rows (§6 shape) |
| `GET /users/{id}/clovers` | Signed ledger (§10 shape) |
| `GET /users/{id}/cards` | Unlocked designs + reveal/download status |
| `GET /users/{id}/activity` | Audit entries for this user |

### Actions

| Endpoint | Body | Permission |
|---|---|---|
| `POST /users/{id}/suspend` | `{ "reason": "…" }` | `users:read` + write scope |
| `POST /users/{id}/reactivate` | `{ "reason": "…" }` | as above |
| `POST /users/{id}/clovers/adjust` | `{ "amount": 250, "reason": "…" }` | `clovers:adjust` |
| `POST /users/{id}/password-reset` | `{}` | sends a reset email |
| `POST /users/{id}/pii/unmask` | `{ "reason": "…" }` | `pii:read`, **audited** |
| `POST /users/{id}/export` | `{ "reason": "…" }` | `pii:export`, returns an export job |

`amount` on the clover adjustment is **signed** — negative debits. Reject `0`. Response returns the new balance and the created ledger row:

```json
{ "data": { "cloverBalance": 570, "transaction": { "id": "clv_…", "amount": 250, "balanceAfter": 570, "…": "…" } } }
```

---

## 8. Gift card analytics

Screen: `/cards/analytics`.

### `GET /cards/kpis`

`cardsCreated`, `standardCount`, `premiumCount`, `premiumRedeemedWithClovers`, `revealRate`, `uniqueDownloads`, `totalDownloads`, `uniqueDownloaders`, `medianTimeToFirstViewHours`, `medianTimeToFirstDownloadHours`, `cardErrors`.

### `GET /cards/timeseries`

```json
{ "data": [ { "date": "2026-07-08", "standard": 9, "premium": 5 } ] }
```

### `GET /cards/templates`

The table that tells the client which designs are worth commissioning more of. Sortable on every column, so accept `sort`/`dir`.

```json
{
  "data": [
    {
      "id": "gc_1", "slug": "card-1", "name": "Confetti Burst",
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
  ]
}
```

### `GET /cards/funnel`

Stages: `selected` → `available` → `revealed` → `viewed` → `downloaded` → `shared`.

### `GET /cards/errors`

```json
{
  "data": {
    "series": [ { "date": "2026-07-08", "generation": 2, "loading": 5, "reveal": 1, "download": 3 } ],
    "records": [ { "id": "err_…", "type": "download", "cardSlug": "card-4", "userId": "usr_…", "message": "…", "context": { }, "occurredAt": "…" } ]
  }
}
```

---

## 9. Gift card catalog

Screen: `/cards/catalog`. **This is the client's explicitly requested new capability** — admins upload designs and set the clover price to unlock them. Requires `cards:write` for all mutations.

The existing `GiftCard` model has `slug`, `emojiKey`, `bg`, `cloverCost`, `sortOrder`, `isActive`. The catalog manager needs these **added**: `name`, `categories[]`, `imageUrl` + resized variants, `availableFrom`, `availableUntil`, `version`.

### `GET /cards/catalog`

Params: `category`, `tier` (`free`|`premium`), `state` (`active`|`inactive`), `q`, and `sort` — one of `sort_order` (default), `newest`, `most_used`, `cost` (highest clover cost first).

```json
{
  "id": "gc_1",
  "slug": "confetti-burst",
  "name": "Confetti Burst",
  "categories": ["birthday", "general"],
  "bg": "#7C3AED",
  "emojiKey": "🎉",
  "images": {
    "thumb":   "https://cdn…/confetti-burst-400.webp",
    "preview": "https://cdn…/confetti-burst-800.webp",
    "full":    "https://cdn…/confetti-burst-1600.webp"
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
```

`canHardDelete` is `true` only when the design has zero unlocks **and** zero usage. The panel disables Delete and offers Deactivate otherwise, and needs the server's answer rather than inferring it.

### `POST /cards/catalog/upload-url`

Direct-to-S3 presigned PUT keeps 5 MB artwork off the app server.

```json
{ "filename": "confetti.png", "contentType": "image/png", "byteSize": 2411002 }
```
```json
{ "data": { "uploadUrl": "https://s3…", "assetId": "ast_…", "expiresIn": 900 } }
```

**Validate on the server too, not just the client:** PNG/JPG/WEBP/SVG only, max 5 MB, min 1200 × 1600 px, and verify by **MIME sniff** as well as extension. Resize server-side into thumb (400w), preview (800w) and full (1600w).

### `POST /cards/catalog`

```json
{
  "assetId": "ast_…",
  "name": "Confetti Burst",
  "slug": "confetti-burst",
  "categories": ["birthday"],
  "bg": "#7C3AED",
  "tier": "premium",
  "cloverCost": 250,
  "sortOrder": 13,
  "isActive": true,
  "availableFrom": null,
  "availableUntil": null
}
```

Rules: `slug` unique and **immutable after creation** (it is the stable seed id). `tier: "standard"` forces `cloverCost: 0`. `tier: "premium"` requires `cloverCost >= 1`.

### `PATCH /cards/catalog/{id}`

Same body, all fields optional. **Never mutate a published design's artwork in place** — supplying a new `assetId` creates a new `version`; users who unlocked v1 keep what they paid for.

### `GET /cards/catalog/{id}/versions`

```json
{ "data": [ { "version": 2, "images": { }, "createdAt": "…", "createdBy": "Ana Ramírez" } ] }
```

### `POST /cards/catalog/{id}/price`

```json
{ "cloverCost": 300, "reason": "…" }
```

**A price change never retroactively charges or refunds anyone.** The panel states this in the confirm dialog; the backend must honour it.

### `GET /cards/catalog/eligible-count?cloverCost=250`

Powers the live hint "≈ N users currently have enough clovers to unlock this".

```json
{ "data": { "eligibleUsers": 1840 } }
```

### Remaining catalog endpoints

| Endpoint | Body | Notes |
|---|---|---|
| `POST /cards/catalog/{id}/activate` | `{ "reason": "…" }` | |
| `POST /cards/catalog/{id}/deactivate` | `{ "reason": "…" }` | Stays owned by users who unlocked it; hidden from new selection. |
| `POST /cards/catalog/{id}/duplicate` | `{}` | Returns the copy, inactive, zero counters. |
| `DELETE /cards/catalog/{id}` | `{ "reason": "…" }` | `409 CONFLICT` if unlocks exist. |
| `PUT /cards/catalog/order` | `{ "orderedIds": ["gc_3", "gc_1", …] }` | Sets `sortOrder`; drives ordering in the mobile app. |
| `POST /cards/catalog/bulk` | `{ "cards": [ { … } ] }` | **All-or-nothing per row**, never a silent partial. Return per-row validation errors. |

---

## 10. Clovers

### `GET /clovers/kpis`

`cloversEarned`, `cloversRedeemed`, `outstandingBalance` (system-wide liability), `redemptionRate`, `burnRate` (redeemed ÷ earned × 100), `repeatRedemption`, `premiumCardDownloadRate`.

### `GET /clovers/timeseries`

```json
{ "data": [ { "date": "2026-07-08", "earned": 1240, "redeemed": 820, "outstandingBalance": 184000 } ] }
```

`outstandingBalance` over time is the platform's liability curve — please make it a true running balance, not a per-day delta.

### `GET /clovers/earn-breakdown`

```json
{ "data": [ { "action": "first_contribution", "clovers": 41200 } ] }
```

### `GET /clovers/redemption-by-design`

```json
{ "data": [ { "cardId": "gc_1", "name": "Confetti Burst", "redemptions": 412, "clovers": 103000 } ] }
```

### `GET /clovers/ledger`

Params: `userId`, `type` (`earn`|`redeem`|`adjust`), `action`, `q`.

```json
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
```

`amount` is **signed**. Keep the unique index on `(user, action, reference)` so earns stay idempotent.

### `GET /clovers/anomalies`

Threshold comes from Settings (`clover_multiple`, default 3× the user's 30-day baseline).

```json
{
  "data": [
    {
      "id": "anm_1",
      "user": { "id": "usr_4", "name": "Mateo Cruz" },
      "signal": "earn_velocity",
      "magnitude": "4.5× 30-day baseline",
      "detail": "1,840 clovers earned in 24h vs 410 baseline",
      "detectedAt": "…"
    }
  ]
}
```

Actions: `POST /clovers/anomalies/{id}/freeze` (`{ "reason": "…" }` — stops the user earning), `POST /clovers/anomalies/{id}/dismiss` (`{ "reason": "…" }`).

---

## 11. Withdrawals

### `GET /withdrawals`

Params: `status` (`requested` `validated` `processing` `completed` `failed`), `account` (`not_started` `pending` `verified` `restricted`), `q` (beneficiary name, event name, payout id).

```json
{
  "id": "wdr_7c3",
  "beneficiary": { "id": "usr_9", "name": "Luis Torres", "avatarUrl": null },
  "eventId": "evt_2a1",
  "eventName": "Ana's Birthday",
  "amount": 319770,
  "currency": "MXN",
  "status": "failed",
  "stripeAccountStatus": "restricted",
  "stripePayoutId": "po_1P…",
  "requestedAt": "…",
  "completedAt": null,
  "elapsedHours": 96.4,
  "failureReason": "account_closed — The bank account has been closed."
}
```

**Sort failed payouts to the top by default** — the panel pins them with a danger tint until resolved.

### `GET /withdrawals/kpis`

`availableForWithdrawal` (system-wide), `requested`, `processing`, `completedInPeriod`, `failed`, `medianTimeToPayoutHours`.

### Actions — all require `payouts:write`

| Endpoint | Body |
|---|---|
| `POST /withdrawals/{id}/retry` | `{ "reason": "…" }` — **must accept `Idempotency-Key`** |
| `POST /withdrawals/{id}/mark-resolved` | `{ "reason": "…" }` |
| `POST /withdrawals/{id}/contact` | `{ "reason": "…", "template": "payout_failed" }` |

---

## 12. Alerts

Thresholds are **admin-configurable in Settings, never hardcoded** (§16).

### `GET /alerts/types`

```json
{
  "data": [
    {
      "type": "stagnant_event",
      "label": "Stagnant Event",
      "defaultTrigger": "No confirmed contribution 72h after publication",
      "severity": "warning",
      "openCount": 4
    }
  ]
}
```

Eight types: `stagnant_event`, `at_risk_event`, `inactive_event`, `payment_friction`, `unrevealed_card`, `premium_card_unused`, `withdrawal_pending`, `clover_anomaly`.

### `GET /alerts`

Params: `type`, `state` (`open` `acknowledged` `snoozed` `resolved` `dismissed`), `severity`, `assignedTo`.

```json
{
  "id": "alr_1",
  "type": "stagnant_event",
  "severity": "warning",
  "subject": { "type": "event", "id": "evt_2a1", "label": "Ana's Birthday" },
  "triggeredAt": "…",
  "ageHours": 26.4,
  "assignedTo": { "id": "adm_1", "name": "Ana Ramírez" },
  "status": "open",
  "evidence": [
    { "label": "Published", "value": "4 days ago" },
    { "label": "Confirmed contributions since", "value": "0" },
    { "label": "Threshold", "value": "no contribution 72h after publication" }
  ]
}
```

**`evidence` is required, not optional.** Each row expands to show the actual numbers that fired the rule so the admin doesn't have to go verify it manually.

### Actions — require `alerts:manage`

| Endpoint | Body |
|---|---|
| `POST /alerts/{id}/acknowledge` | `{}` |
| `POST /alerts/{id}/assign` | `{ "adminId": "adm_2" }` |
| `POST /alerts/{id}/snooze` | `{ "duration": "24h" \| "7d" \| "custom", "until": "…" }` |
| `POST /alerts/{id}/resolve` | `{ "reason": "…" }` |
| `POST /alerts/{id}/dismiss` | `{ "reason": "…" }` — false positive; should feed threshold tuning |

---

## 13. Exports

### `POST /exports`

```json
{
  "dataset": "contributions",
  "format": "csv",
  "columns": ["id", "eventName", "amount", "currency", "status"],
  "filters": { "range": "30d", "status": "succeeded" },
  "reason": "monthly reconciliation"
}
```

Datasets: `events`, `contributions`, `users`, `cards`, `card_downloads`, `clover_ledger`, `withdrawals`, `audit_log`.

Returns the job. Requires `exports:run`; datasets containing PII additionally require `pii:export`.

```json
{ "data": { "id": "exp_1", "status": "queued", "progress": 0, "…": "…" } }
```

### `GET /exports`

```json
{
  "id": "exp_1",
  "dataset": "Contributions",
  "format": "csv",
  "filters": "Last 30 days · status=succeeded",
  "rows": 4213,
  "status": "ready",
  "progress": 100,
  "requestedBy": "Sofía Herrera",
  "requestedAt": "…",
  "expiresAt": "…",
  "containsPii": true
}
```

Statuses: `queued` `running` `ready` `expired` `failed`.

### `GET /exports/{id}/download`

Redirects to a **single-use signed URL that expires after 24 hours**. Requesting it again after use returns `410 GONE`.

### `POST /exports/{id}/retry`

Re-queues a failed job.

**CSV formatting requirements — this is where reconciliation bugs come from:**
- Money columns are **decimal strings** (`"1250.00"`), with a **separate explicit currency column**. Never raw minor-unit integers.
- UTF-8 with BOM so Excel renders accented names correctly.
- CRLF line endings.
- Escape leading `=`, `+`, `-`, `@` to prevent formula injection.
- Timestamps in UTC ISO 8601, with the column header naming the timezone.

The frontend already implements exactly this in `src/lib/export.ts` for its client-side downloads — please match it so a server export and a client export of the same view are byte-comparable.

---

## 14. Audit trail

**Append-only and immutable. There must be no edit or delete path in the API at all.** Retain 24 months minimum.

### `GET /audit`

Params: `adminId`, `action`, `resourceType`, `resourceId`, `from`, `to`, `q`.

```json
{
  "id": "aud_8f2",
  "timestamp": "2026-08-06T09:12:00.000Z",
  "admin": { "id": "adm_1", "name": "Ana Ramírez", "avatarUrl": null },
  "action": "card.price_change",
  "resourceType": "Gift card",
  "resource": { "type": "card", "id": "gc_1", "label": "Confetti Burst" },
  "before": { "cloverCost": 250 },
  "after":  { "cloverCost": 300 },
  "reason": "seasonal promotion",
  "ip": "189.203.14.62",
  "userAgent": "Chrome 141 / macOS 15.2"
}
```

### `GET /audit/actions`

Distinct action strings, for the filter dropdown.

Action naming the frontend already emits: `event.status_override`, `event.force_close`, `event.resend_reminders`, `event.flag_for_review`, `user.suspend`, `user.reactivate`, `clover.adjust`, `card.create`, `card.update`, `card.price_change`, `card.activate`, `card.deactivate`, `card.duplicate`, `card.delete`, `card.reorder`, `alert.acknowledge`, `alert.assign`, `alert.snooze`, `alert.resolve`, `alert.dismiss`, `withdrawal.retry`, `withdrawal.mark_resolved`, `admin.revoke`, `admin.restore`, `export.run`, `settings.update`, `pii.unmask`, `auth.login`, `auth.login_failed`, `auth.logout`.

---

## 15. Admin users

Requires `admins:manage`.

| Endpoint | Body | Notes |
|---|---|---|
| `GET /admins` | | List |
| `POST /admins` | `{ "name": "…", "email": "…", "role": "operations" }` | **Backend generates the credential** and emails an activation link. Never accept a password from this screen. |
| `PATCH /admins/{id}` | `{ "role": "finance" }` | |
| `POST /admins/{id}/revoke` | `{ "reason": "…" }` | Disables access; keeps audit history. |
| `POST /admins/{id}/restore` | `{ "reason": "…" }` | |
| `POST /admins/{id}/reset-2fa` | `{ "reason": "…" }` | |

```json
{
  "id": "adm_2",
  "name": "Diego Flores",
  "email": "diego@regal.app",
  "role": "operations",
  "isActive": true,
  "twoFactorEnabled": true,
  "lastLoginAt": "…",
  "createdAt": "…"
}
```

An admin must not be able to revoke or demote themselves — return `409` with a clear message.

---

## 16. Settings

### `GET /settings` / `PUT /settings`

`PUT` accepts a partial object and a `reason`, and writes one audit entry containing every changed key's before → after.

```json
{
  "data": {
    "alertThresholds": {
      "stagnant_hours": 72,
      "at_risk_progress": 40,
      "at_risk_hours": 48,
      "inactive_days": 7,
      "friction_event": 15,
      "friction_platform": 10,
      "unrevealed_hours": 48,
      "premium_unused_days": 7,
      "withdrawal_hours": 72,
      "clover_multiple": 3
    },
    "cloverRules": {
      "earn_event_created": 100,
      "earn_first_contribution": 150,
      "earn_invite_accepted": 25,
      "earn_referral": 200,
      "earn_profile": 50,
      "cap_daily": 500,
      "expiry_days": 0
    },
    "financial": {
      "platform_fee": 3.0,
      "default_fee_payer": "contributor",
      "supported_currencies": ["MXN"],
      "min_withdrawal": 100
    },
    "notifications": {
      "digest": "daily",
      "routing": { "payment_friction": ["adm_1", "adm_3"], "clover_anomaly": ["adm_1"] }
    },
    "branding": {
      "logoUrl": "…",
      "support_email": "soporte@regal.app",
      "terms_url": "…",
      "privacy_url": "…",
      "maintenance_mode": false
    }
  },
  "meta": { "defaults": { "stagnant_hours": 72, "…": "…" } }
}
```

`meta.defaults` powers the "Default: 72 · Reset to default" affordance next to every field, so the panel doesn't hold a second copy of your defaults.

`cap_daily: 0` disables the cap. `expiry_days: 0` means clovers never expire. `min_withdrawal` is in **major units** here (it's an admin-facing config value, not a transaction amount) — flag if you'd rather it be minor units for consistency and we'll change the input.

---

## 17. Global search

### `GET /search?q=ana&limit=12`

Powers ⌘K. Searches events (name, id, share slug), users (name, email, id), contributions (id, Stripe PaymentIntent id), cards (name, slug). Results must respect the caller's permissions — a Support admin must not find a payout they can't open.

```json
{
  "data": [
    { "type": "event", "id": "evt_2a1", "title": "Ana's Birthday", "subtitle": "Ana Ramírez · birthday-3k1", "href": "/events/evt_2a1" },
    { "type": "user",  "id": "usr_1",  "title": "Ana Ramírez",   "subtitle": "a•••@regal.app", "href": "/users/usr_1" }
  ]
}
```

Target < 200 ms; the input fires on every keystroke after 2 characters.

---

## 18. Schema gaps that block screens

These do **not** exist in `regal-backend` today. Each one blocks the listed screen — the panel currently fakes them. Ordered by how much is blocked.

| # | Gap | Blocks |
|---|---|---|
| 1 | Event statuses `draft`, `published`, `paused`, `goal_reached`, `delivered` | Success rate, status distribution, most filters |
| 2 | Event timestamps `publishedAt`, `closedAt`, `deliveredAt`, `goalReachedAt`, `halfGoalReachedAt` | Dashboard §D lifecycle timing, Event Timeline tab — **7 of 8 timing metrics are underivable without these** |
| 3 | Contribution status `cancelled` (and/or `refunded`) | Event financial panel, Contributions KPI row. Currently always renders `—` |
| 4 | Invitation records: `sentAt`, `deliveredAt`, `openedAt`, `acceptedAt` | Participation rate, invitation conversion, decision time, the whole Participants tab and the dashboard funnel |
| 5 | Reminder records: `scheduledAt`, `sentAt`, `openedAt`, `convertedContributionId` | Reminder markers on charts, reminder-conversion analysis |
| 6 | Card event log: `revealed`, `viewed`, `downloaded`, `shared`, `error` with timestamp + user | **All of Screen 08**, the Card tab, unrevealed-card and premium-unused alerts |
| 7 | Withdrawal/payout records with the full status machine | **All of Screen 11**, withdrawal panel on Event Detail |
| 8 | Admin user + role + permission tables | Screen 15, and all authorization |
| 9 | Immutable audit log table | Screen 14, and every mutation in this document |
| 10 | Gift card fields: `name`, `categories[]`, `imageUrl` + variants, `availableFrom`, `availableUntil`, `version` | Screen 09 catalog manager |
| 11 | Analytics event stream (§19) | Funnels, alert evaluation, anomaly detection |

**Recommended sequencing:** #1 and #2 first — they unblock the most screens for the least work, and they're additive columns rather than new tables.

---

## 19. Analytics events to emit

Every event carries `userId`, `eventId` (where applicable), `timestamp` (UTC), `source` (`ios` | `android` | `web` | `server`) and a typed `properties` object.

| Category | Events |
|---|---|
| Event | `created`, `published`, `paused`, `closed`, `cancelled`, `goal_reached`, `delivered` |
| Invitation | `created`, `sent`, `delivered`, `opened`, `accepted` |
| Contribution | `started`, `confirmed`, `pending`, `failed`, `cancelled` |
| Reminder | `scheduled`, `sent`, `opened`, `contribution_converted` |
| Gift card | `selected`, `personalized`, `premium_redeemed`, `available`, `revealed`, `viewed`, `downloaded`, `shared`, `error` |
| Clovers | `credited`, `adjusted`, `redeemed`, `reversed`, `balance_viewed` |
| Withdrawal | `requested`, `validated`, `processing`, `completed`, `failed` |
| User | `registered`, `logged_in`, `joined_event`, `created_group`, `used_group_suggestion` |

---

## 20. Non-functional requirements

### Performance

- Dashboard KPI payload **< 500 ms**. The panel targets LCP < 2.0 s.
- Table interactions (sort / filter / page) **< 500 ms**.
- **KPI aggregates come from pre-computed rollups, not live table scans.** A nightly + incremental rollup is expected; set `meta.dataAsOf` accordingly.
- List endpoints cap `pageSize` at 100. Never return an unbounded set.

### Security

- httpOnly / Secure / SameSite=Strict session cookies; CSRF token on every mutation.
- Server-side authorization on **every** route — the panel hides unavailable actions, but that is UX, not enforcement.
- Rate-limit login (5 / 15 min per email+IP) and export creation (10 / hour per admin).
- PII masked by default; unmasking requires `pii:read` and is audited.
- No admin route in `robots.txt`; all admin responses `Cache-Control: no-store`.

### Reliability

- Partial failure is expected and handled: if one dashboard widget's endpoint 500s the page still renders the rest. Prefer several focused endpoints over one giant `/dashboard` call, so a single slow aggregate can't blank the page.
- Return `Retry-After` on 429/503 so the panel's retry affordance is accurate.

---

## 21. Suggested delivery order

Aligned to the frontend milestones — each phase makes whole screens go live.

| Phase | Endpoints | Unblocks |
|---|---|---|
| **P1** | §2 auth, §3 permissions, §15 admins | Login, session, role gating. Nothing else can be tested without this. |
| **P2** | §5 events list + detail, §6 contributions | Screens 03, 04, 05 — the operational core |
| **P3** | §4 dashboard (needs gaps #1, #2) | Screen 02 |
| **P4** | §7 users, §10 clovers | Screens 06, 07, 10 |
| **P5** | §9 catalog + object storage (client's newest explicit ask), §8 card analytics | Screens 08, 09 |
| **P6** | §11 withdrawals, §13 exports, §12 alerts, §14 audit, §16 settings | Screens 11–14, 16 |

§14 audit should land **with P1**, not P6 — every mutation from P2 onward is specified to write to it, and retrofitting audit coverage after the fact reliably leaves holes.

---

## Open questions for the client / product

These change the API shape, so they're worth resolving before building:

1. **Currency** — MXN only, or must every aggregate be multi-currency? Multi-currency changes every money KPI and requires an FX rate plus a rate-as-of date.
2. **"Cancelled" contributions** — user-abandoned checkouts, or refunds? Different records, different accounting, possibly both.
3. **School / group filter** — is there a distinct school entity, or is it the existing `Group`?
4. **Card artwork** — who supplies designs, and do we need a licensing/attribution field per design?
5. **Clover price changes** — confirmed that users who unlocked at 250 are unaffected when the price drops? The panel assumes yes.
6. **Data retention** — how long for audit logs, export files, analytics events?
7. **Admin 2FA** — required at launch or phase 2? The screen is built either way behind a feature flag.
8. **Alert delivery** — in-panel only, or email/Slack too? Affects whether §16 notification routing needs a delivery-status endpoint.
