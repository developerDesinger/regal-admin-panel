# What the admin panel still needs from the backend

**Measured against the live deployment, not the spec.**

- Environment: `https://regal-backend-ypkwe.ondigitalocean.app`
- Date: 7 August 2026
- Method: every endpoint the panel calls was probed with an authenticated session, and the responses inspected.

**Headline: no route the panel calls is missing.** All 52 GET endpoints return 200, every documented mutation exists, and the payload shapes match. The panel is fully wired and running on real data.

What follows is the gap between "the API answers" and "the screen shows something useful". It splits into three kinds of problem, and only the first kind needs new routes.

---

## Summary

| # | Gap | Kind | Blocks | Priority |
|---|---|---|---|---|
| 1 | Event lifecycle timestamps never written | Data | Success-rate KPI, 4 of 7 timing metrics | **P0** |
| 2 | Invitation records never written | Data | Participants tab, participation funnel, decision time | **P0** |
| 3 | Card event log never written | Data | All of Screen 08, Event → Card tab | **P1** |
| 4 | Reminder records never written | Data | Reminder markers on the volume chart | **P2** |
| 5 | `DELETE /users/:id` | Route | Deleting a user (only suspend exists) | **P2** |
| 6 | `GET /groups` | Route | Events group/school filter | **P2** |
| 7 | `GET /cards/categories` | Route | Catalog category list (currently hardcoded) | **P3** |

Items 1–4 are the important ones. They are not missing endpoints — the endpoints exist and return correctly-shaped responses full of zeros, so the screens render but say nothing.

---

## Part 1 — Data that is never written

### 1. Event lifecycle timestamps  ·  P0

Every timestamp is `null` on a live event:

```bash
GET /api/v1/admin/events/6a74a5f2b1a6a257e1b0fc4b
```
```
publishedAt          null
halfGoalReachedAt    null
goalReachedAt        null
closedAt             null
deliveredAt          null
```

All 9 events in the database are `status: active`, and no event has ever moved through the rest of the lifecycle.

**Consequence.** `/dashboard/lifecycle-timing` returns 7 rows, but 4 have a sample size of zero:

```
planned_duration(n=9)  published_duration(n=9)  time_to_first_contribution(n=3)
time_to_50pct_goal(n=0)  time_to_goal(n=0)  actual_duration(n=0)  time_to_delivery(n=0)
```

Event Success Rate has nothing to divide by either, since it is "events reaching goal ÷ events published in range".

**What is needed.** Write these five fields as the event moves, and use the statuses that already exist in the enum (`draft`, `published`, `paused`, `goal_reached`, `completed`, `delivered`, `cancelled`) rather than leaving everything `active`:

| Field | Set when |
|---|---|
| `publishedAt` | the organizer publishes and the share link goes live |
| `halfGoalReachedAt` | confirmed total first crosses 50% of `goalAmount` |
| `goalReachedAt` | confirmed total first crosses 100% |
| `closedAt` | collection ends, by deadline or force-close |
| `deliveredAt` | the beneficiary confirms delivery |

These are additive columns rather than new tables, which is why this is first: it is the cheapest change on this list and it unblocks the most.

**Verify with:** `GET /dashboard/lifecycle-timing?range=90d&tz=America/Mexico_City` — every row should report a non-zero `sampleSize`.

---

### 2. Invitation records  ·  P0

```bash
GET /api/v1/admin/events/:eventId/participants   →  { data: [], meta: { totalRows: 0 } }
GET /api/v1/admin/dashboard/funnel               →  invited=0  opened=0  contributed=0
```

The endpoints work. There is simply nothing to return.

**Consequence.** The Participants tab is permanently empty; the dashboard funnel renders three zero bars; Participation Rate and Invitation Conversion are 0; median Decision Time cannot be computed.

**What is needed.** An invitation record per (event, invitee) carrying:

| Field | Purpose |
|---|---|
| `sentAt` | funnel stage 1 |
| `deliveredAt` | delivery diagnostics |
| `openedAt` | funnel stage 2 — the "opened" bar |
| `acceptedAt` | funnel stage 3 |

Decision time is `contribution.createdAt − invitation.sentAt`. The panel already handles a `null` here — someone who arrived via a share link has no invitation, and that is expected rather than an error.

**Verify with:** `GET /events/:id/participants` returning rows, and `/dashboard/funnel` showing a descending three-stage funnel.

---

### 3. Card event log  ·  P1

```bash
GET /api/v1/admin/cards/kpis?range=90d
  cardsCreated=0  revealRate=0  uniqueDownloads=0  totalDownloads=0  cardErrors=0
  premiumRedeemedWithClovers=2      ← the only field with real data

GET /api/v1/admin/cards/funnel?range=90d
  selected=0  available=0  revealed=0  viewed=0  downloaded=0  shared=0

GET /api/v1/admin/cards/errors?range=90d
  series: 90 points, all zero · records: 0
```

Unlock counts work because `CardUnlock` rows exist. Everything downstream of the unlock does not.

**Consequence.** Screen 08 (Gift Card Analytics) is a page of zeros: the KPI row, the funnel, the template performance table's reveal/download columns, and the error chart. The Card tab on Event Detail shows dashes for reveal time, download counts and errors.

**What is needed.** An event row per card interaction, each with a timestamp and the acting user:

```
selected · personalized · premium_redeemed · available
revealed · viewed · downloaded · shared · error
```

`error` should also carry a `type` (`generation` | `loading` | `reveal` | `download`) and a message — the panel already renders those as a stacked series with a drill-down to individual records.

**Verify with:** `GET /cards/funnel?range=30d` showing a descending funnel.

---

### 4. Reminder records  ·  P2

```bash
GET /api/v1/admin/dashboard/timeseries?range=90d
  90 data points, 0 with reminderSent=true
```

Admin-triggered resends via `POST /events/:id/resend-reminders` do write. Scheduled reminders do not.

**Consequence.** The volume chart cannot mark reminder days, so the "did the nudge convert" question the chart exists to answer is unanswerable.

**What is needed.** A reminder record with `scheduledAt`, `sentAt`, `openedAt` and `convertedContributionId`, and `reminderSent: true` on the matching day in the timeseries.

---

## Part 2 — Routes that do not exist

### 5. `DELETE /users/:id`  ·  P2

```bash
DELETE /api/v1/admin/users/000000000000000000000000
  404  { "error": { "code": "RESOURCE_NOT_FOUND", "message": "Route not found" } }
```

The only destructive user action today is `POST /users/:id/suspend`, which is reversible and preserves contributions and clover balance.

**Decision needed before building anything.** If "delete" should exist, which is it?

- **Soft delete** — set `isDeleted`, keep the rows. The `User` model already has `isDeleted` / `deletedAt`, and `/users?state=deleted` already filters on it, but nothing ever sets them.
- **Hard delete / GDPR erasure** — actually remove personal data. This needs a decision about what happens to their contributions, since deleting those would change historical financial totals.

The panel currently offers Suspend with a person-minus icon rather than a trash can, because a trash icon would promise something the API does not do.

---

### 6. `GET /groups`  ·  P2

```bash
GET /api/v1/admin/groups   →  404
```

`groupId` is an accepted filter param on `/events` and `/users`, and events carry a `groupName`, but there is no way to list groups — so the filter dropdown cannot be populated.

**What is needed.** `GET /groups` returning `{ id, name, memberCount }`, paged and searchable.

Related open question: the spec mentions "school/group when applicable". Is a school a distinct entity, or is it the existing `Group`? The answer changes whether this is one endpoint or two.

---

### 7. `GET /cards/categories`  ·  P3

```bash
GET /api/v1/admin/cards/categories   →  404
```

The catalog upload form hardcodes the occasion list (`birthday`, `wedding`, `farewell`, `graduation`, `baby`, `thanks`, `holiday`, `general`). That is acceptable while the list is a fixed enum — this only matters if categories become editable.

---

## Part 3 — Known caveats, no action needed

Documented by the backend and handled by the panel. Listed so they are not re-reported as bugs.

**Withdrawals are per-user, not per-event.** A beneficiary's wallet is credited from every event and drained by one payout, so `eventId` / `eventName` on a withdrawal are best-effort and may be `null`. The panel shows `—` rather than inventing a link.

**`requested` and `validated` never appear at rest.** The backend passes through both inside a single request, so only `processing`, `completed` and `failed` are observable and the Requested KPI is always 0.

---

## Suggested order

1. **Lifecycle timestamps** — additive columns, unblocks the success-rate KPI and 4 timing metrics
2. **Invitation records** — unblocks the entire participation funnel and the Participants tab
3. **Card event log** — unblocks Screen 08, which is currently all zeros
4. **Reminder records** — unblocks the conversion markers
5. **Delete-user decision** — soft or hard, then the endpoint
6. **`GET /groups`** — unblocks the group filter

Items 1 and 2 together take the dashboard from roughly half-populated to complete.

## Open product questions

These change API shape or behaviour, so they are worth settling before building:

1. **Currency.** Live events return `USD`, but the spec and panel assume MXN. Multi-currency means no aggregate can be summed without an FX rate and a rate-as-of date — today a mixed-currency total would simply be wrong.
2. **`goalAmount: 0`** appears in live data. Is that an open-ended collection, and should progress render differently from 0%?
3. **Reset-link URL.** The panel serves the set-password page at `/login/reset?token=…`. Confirm the invitation and password-reset emails point there.
4. **Delete semantics** — see item 5 above.
