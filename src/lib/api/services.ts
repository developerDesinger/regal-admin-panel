/**
 * One function per documented endpoint. Screens never call axios directly —
 * they go through the hooks in `src/hooks/data`, which call these.
 *
 * Reference: the backend's ADMIN_PANEL_API document.
 */

import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  cleanParams,
  setCsrfToken,
  type Envelope,
  type PageMeta,
} from './client';
import type {
  AggregateMeta,
  AdminRow,
  AdminSession,
  AlertRow,
  AlertTypeRow,
  AttentionLists,
  AuditFacets,
  AuditRow,
  CardErrorsResponse,
  CardKpis,
  CardTemplateRow,
  CardCategoryRow,
  CardVersion,
  CatalogRow,
  CloverAnomaly,
  CloverKpis,
  CloverLedgerRow,
  ContributionCharts,
  ContributionDetailApi,
  ContributionKpis,
  ContributionRow,
  DashboardKpis,
  EventCardApi,
  EventDetailApi,
  EventFinancials,
  EventRow,
  FunnelStage,
  LifecycleTimingRow,
  LoginResponse,
  ParticipantRow,
  RolesResponse,
  SearchHit,
  SettingsApi,
  SettingsMeta,
  StatusDistributionRow,
  TimelineRow,
  TimeseriesPoint,
  UploadTarget,
  UserCardRow,
  UserDetailApi,
  UserKpis,
  UserRow,
  WithdrawalKpis,
  WithdrawalRow,
  ExportJobRow,
} from './types';

export type Params = Record<string, unknown>;
export type Paged<T> = Envelope<T[], PageMeta>;

/* -------------------------------------------------------------- auth -- */

export const authService = {
  async login(email: string, password: string, rememberMe = false) {
    const res = await apiPost<LoginResponse>('/auth/login', { email, password, rememberMe });
    // Only a completed sign-in carries a token; a 2FA challenge does not.
    if ('csrfToken' in res.data) setCsrfToken(res.data.csrfToken);
    return res.data;
  },

  async verifyTwoFactor(challengeId: string, code: string) {
    const res = await apiPost<LoginResponse>('/auth/2fa/verify', { challengeId, code });
    if ('csrfToken' in res.data) setCsrfToken(res.data.csrfToken);
    return res.data;
  },

  resendTwoFactor: (challengeId: string) =>
    apiPost<{ challengeId: string; expiresIn: number }>('/auth/2fa/resend', { challengeId }).then(
      (r) => r.data,
    ),

  async me() {
    const res = await apiGet<{ admin: AdminSession; csrfToken: string }>('/auth/me');
    setCsrfToken(res.data.csrfToken);
    return res.data.admin;
  },

  async logout() {
    try {
      await apiPost('/auth/logout', {});
    } finally {
      setCsrfToken(null);
    }
  },

  heartbeat: () => apiPost<void>('/auth/heartbeat', {}),

  forgotPassword: (email: string) => apiPost<void>('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    apiPost<void>('/auth/reset-password', { token, password }),

  async changePassword(currentPassword: string, newPassword: string) {
    const res = await apiPost<{ admin: AdminSession; csrfToken: string }>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    setCsrfToken(res.data.csrfToken);
    return res.data.admin;
  },
};

/* --------------------------------------------------------- dashboard -- */

export const dashboardService = {
  kpis: (p: Params) =>
    apiGet<DashboardKpis, AggregateMeta>('/dashboard/kpis', cleanParams(p)),
  timeseries: (p: Params) =>
    apiGet<TimeseriesPoint[], AggregateMeta>('/dashboard/timeseries', cleanParams(p)),
  funnel: (p: Params) => apiGet<FunnelStage[], AggregateMeta>('/dashboard/funnel', cleanParams(p)),
  statusDistribution: (p: Params) =>
    apiGet<StatusDistributionRow[], AggregateMeta>('/dashboard/status-distribution', cleanParams(p)),
  lifecycleTiming: (p: Params) =>
    apiGet<LifecycleTimingRow[], AggregateMeta>('/dashboard/lifecycle-timing', cleanParams(p)),
  attentionLists: (p: Params) =>
    apiGet<AttentionLists, AggregateMeta>('/dashboard/attention-lists', cleanParams(p)),
};

/* ------------------------------------------------------------ events -- */

export const eventsService = {
  list: (p: Params) => apiGet<EventRow[], PageMeta>('/events', cleanParams(p)),
  detail: (id: string) => apiGet<EventDetailApi>(`/events/${id}`).then((r) => r.data),
  financials: (id: string) => apiGet<EventFinancials>(`/events/${id}/financials`).then((r) => r.data),
  timeline: (id: string) => apiGet<TimelineRow[]>(`/events/${id}/timeline`).then((r) => r.data),
  participants: (id: string, p: Params = {}) =>
    apiGet<ParticipantRow[], PageMeta>(`/events/${id}/participants`, cleanParams(p)),
  contributions: (id: string, p: Params = {}) =>
    apiGet<ContributionRow[], PageMeta>(`/events/${id}/contributions`, cleanParams(p)),
  card: (id: string) => apiGet<EventCardApi | null>(`/events/${id}/card`).then((r) => r.data),
  activity: (id: string, p: Params = {}) =>
    apiGet<AuditRow[], PageMeta>(`/events/${id}/activity`, cleanParams(p)),

  statusOverride: (id: string, status: string, reason: string) =>
    apiPost<{ id: string; status: string }>(`/events/${id}/status-override`, { status, reason }),
  forceClose: (id: string, reason: string) =>
    apiPost<{ id: string; status: string; closedAt: string }>(`/events/${id}/force-close`, { reason }),
  resendReminders: (id: string, reason: string, audience = 'non_contributors') =>
    apiPost<{ queued: number }>(`/events/${id}/resend-reminders`, { reason, audience }),
  flag: (id: string, reason: string) =>
    apiPost<{ id: string; status: string; flaggedAt: string; flagReason: string }>(
      `/events/${id}/flag`,
      { reason },
    ),
};

/* ----------------------------------------------------- contributions -- */

export const contributionsService = {
  list: (p: Params) => apiGet<ContributionRow[], PageMeta>('/contributions', cleanParams(p)),
  detail: (id: string) => apiGet<ContributionDetailApi>(`/contributions/${id}`).then((r) => r.data),
  kpis: (p: Params) => apiGet<ContributionKpis, AggregateMeta>('/contributions/kpis', cleanParams(p)),
  charts: (p: Params) =>
    apiGet<ContributionCharts, AggregateMeta>('/contributions/charts', cleanParams(p)),
};

/* ------------------------------------------------------------- users -- */

export const usersService = {
  list: (p: Params) => apiGet<UserRow[], PageMeta>('/users', cleanParams(p)),
  kpis: (p: Params) => apiGet<UserKpis, AggregateMeta>('/users/kpis', cleanParams(p)),
  detail: (id: string, unmask = false) =>
    apiGet<UserDetailApi>(`/users/${id}`, unmask ? { unmask: true } : undefined).then((r) => r.data),
  events: (id: string, p: Params = {}) =>
    apiGet<(EventRow & { relationship: { organized: boolean; contributed: boolean } })[], PageMeta>(
      `/users/${id}/events`,
      cleanParams(p),
    ),
  contributions: (id: string, p: Params = {}) =>
    apiGet<ContributionRow[], PageMeta>(`/users/${id}/contributions`, cleanParams(p)),
  clovers: (id: string, p: Params = {}) =>
    apiGet<CloverLedgerRow[], PageMeta>(`/users/${id}/clovers`, cleanParams(p)),
  cards: (id: string) => apiGet<UserCardRow[]>(`/users/${id}/cards`).then((r) => r.data),
  activity: (id: string, p: Params = {}) =>
    apiGet<AuditRow[], PageMeta>(`/users/${id}/activity`, cleanParams(p)),

  suspend: (id: string, reason: string) =>
    apiPost<{ id: string; isActive: boolean }>(`/users/${id}/suspend`, { reason }),
  reactivate: (id: string, reason: string) =>
    apiPost<{ id: string; isActive: boolean }>(`/users/${id}/reactivate`, { reason }),
  /** `amount` is signed; negative debits. 0 or non-integer → 422. */
  adjustClovers: (id: string, amount: number, reason: string) =>
    apiPost<{ cloverBalance: number; transaction: CloverLedgerRow }>(`/users/${id}/clovers/adjust`, {
      amount,
      reason,
    }),
  passwordReset: (id: string) =>
    apiPost<{ requested: boolean; delivered: boolean }>(`/users/${id}/password-reset`, {}),
  unmaskPii: (id: string, reason: string) =>
    apiPost<{ id: string; email: string; phoneNumber: string }>(`/users/${id}/pii/unmask`, { reason }),
  exportUser: (id: string, reason: string) =>
    apiPost<ExportJobRow>(`/users/${id}/export`, { reason }),
};

/* --------------------------------------------------- card analytics -- */

export const cardAnalyticsService = {
  kpis: (p: Params) => apiGet<CardKpis, AggregateMeta>('/cards/kpis', cleanParams(p)),
  timeseries: (p: Params) =>
    apiGet<{ date: string; standard: number; premium: number }[], AggregateMeta>(
      '/cards/timeseries',
      cleanParams(p),
    ),
  templates: (p: Params) =>
    apiGet<CardTemplateRow[], PageMeta>('/cards/templates', cleanParams(p)),
  funnel: (p: Params) => apiGet<FunnelStage[], AggregateMeta>('/cards/funnel', cleanParams(p)),
  errors: (p: Params) => apiGet<CardErrorsResponse, AggregateMeta>('/cards/errors', cleanParams(p)),
};

/* ----------------------------------------------------- card catalog -- */

export interface CatalogPayload {
  assetId?: string;
  name?: string;
  slug?: string;
  categories?: string[];
  bg?: string;
  emojiKey?: string;
  tier?: 'standard' | 'premium';
  cloverCost?: number;
  sortOrder?: number;
  isActive?: boolean;
  availableFrom?: string | null;
  availableUntil?: string | null;
}

export const catalogService = {
  list: (p: Params) => apiGet<CatalogRow[], PageMeta>('/cards/catalog', cleanParams(p)),
  detail: (id: string) => apiGet<CatalogRow>(`/cards/catalog/${id}`).then((r) => r.data),
  versions: (id: string) => apiGet<CardVersion[]>(`/cards/catalog/${id}/versions`).then((r) => r.data),
  eligibleCount: (cloverCost: number) =>
    apiGet<{ eligibleUsers: number; cloverCost: number }>('/cards/catalog/eligible-count', {
      cloverCost,
    }).then((r) => r.data),

  uploadUrl: (filename: string, contentType: string, byteSize: number) =>
    apiPost<UploadTarget>('/cards/catalog/upload-url', { filename, contentType, byteSize }).then(
      (r) => r.data,
    ),

  /**
   * Upload artwork as a base64 `data:` URI on one authenticated JSON request.
   *
   * This is the path the API is built around (see `createLocalAssetFromBase64`
   * on the server). The two-step `uploadUrl` + multipart POST it replaced could
   * not work from here: every admin POST route validates its body as a JSON
   * object, and a multipart request leaves that body unparsed — the server
   * answered "body must be object" before the handler ran, which is what an
   * admin saw as "Failed to publish design".
   */
  uploadBase64: (filename: string, contentType: string, data: string) =>
    apiPost<{ assetId: string; uploaded: boolean; byteSize: number }>(
      '/cards/catalog/upload-base64',
      { filename, contentType, data },
      // ~1.37× the file once base64-encoded, so a 5 MB image is ~6.7 MB on the
      // wire. The route allows 8 MB; axios needs telling not to cap it lower.
      { maxBodyLength: Infinity, maxContentLength: Infinity },
    ).then((r) => r.data),

  create: (payload: CatalogPayload) =>
    apiPost<CatalogRow>('/cards/catalog', payload).then((r) => r.data),
  update: (id: string, payload: CatalogPayload) =>
    apiPatch<CatalogRow>(`/cards/catalog/${id}`, payload).then((r) => r.data),

  setPrice: (id: string, cloverCost: number, reason: string) =>
    apiPost<{ id: string; cloverCost: number; previousCloverCost: number; retroactive: boolean }>(
      `/cards/catalog/${id}/price`,
      { cloverCost, reason },
    ).then((r) => r.data),
  activate: (id: string, reason: string) =>
    apiPost<{ id: string; isActive: boolean }>(`/cards/catalog/${id}/activate`, { reason }),
  deactivate: (id: string, reason: string) =>
    apiPost<{ id: string; isActive: boolean; retainedByExistingOwners: boolean }>(
      `/cards/catalog/${id}/deactivate`,
      { reason },
    ),
  duplicate: (id: string) =>
    apiPost<CatalogRow>(`/cards/catalog/${id}/duplicate`, {}).then((r) => r.data),
  reorder: (orderedIds: string[]) =>
    apiPut<{ reordered: number }>('/cards/catalog/order', { orderedIds }),
  remove: (id: string, reason: string) =>
    apiDelete<{ id: string; deleted: boolean }>(`/cards/catalog/${id}`, { reason }),
  bulkCreate: (cards: CatalogPayload[]) =>
    apiPost<CatalogRow[]>('/cards/catalog/bulk', { cards }).then((r) => r.data),
};

/* ------------------------------------------------ card categories -- */

/**
 * The occasion vocabulary the apps group cards and events by.
 *
 * Artwork rides along on the same request as a base64 `data:` URI rather than
 * going through the catalog's presigned-upload dance — a category glyph is
 * small, and there is then no orphaned asset to clean up if the admin closes
 * the dialog.
 */
export interface CategoryPayload {
  key?: string;
  name?: string;
  nameEs?: string | null;
  description?: string | null;
  color?: string;
  emoji?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  /** Base64 `data:` URI of the source image. */
  image?: string;
  imageContentType?: string;
  /** Explicitly clear the stored artwork. Omit to leave it untouched. */
  removeImage?: boolean;
  reason?: string;
}

export const categoriesService = {
  list: (p: Params = {}) =>
    apiGet<CardCategoryRow[], PageMeta>('/cards/categories', cleanParams(p)),
  detail: (id: string) =>
    apiGet<CardCategoryRow>(`/cards/categories/${id}`).then((r) => r.data),

  create: (payload: CategoryPayload) =>
    apiPost<CardCategoryRow>('/cards/categories', payload).then((r) => r.data),
  update: (id: string, payload: CategoryPayload) =>
    apiPatch<CardCategoryRow>(`/cards/categories/${id}`, payload).then((r) => r.data),

  activate: (id: string, reason?: string) =>
    apiPost<CardCategoryRow>(`/cards/categories/${id}/activate`, { reason }),
  deactivate: (id: string, reason?: string) =>
    apiPost<CardCategoryRow & { retainedByExistingDesigns: boolean }>(
      `/cards/categories/${id}/deactivate`,
      { reason },
    ),
  reorder: (orderedIds: string[]) =>
    apiPut<{ reordered: number }>('/cards/categories/order', { orderedIds }),
  remove: (id: string, reason: string) =>
    apiDelete<{ id: string; deleted: boolean }>(`/cards/categories/${id}`, { reason }),
};

/** Reads a picked file as the `data:<mime>;base64,…` URI the API expects. */
function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}

/** Uploads card artwork and returns the asset id to attach to the design. */
export async function uploadArtwork(file: File): Promise<string> {
  const dataUri = await readAsDataUri(file);
  const asset = await catalogService.uploadBase64(file.name, file.type, dataUri);
  return asset.assetId;
}

/* ----------------------------------------------------------- clovers -- */

export const cloversService = {
  kpis: (p: Params) => apiGet<CloverKpis, AggregateMeta>('/clovers/kpis', cleanParams(p)),
  timeseries: (p: Params) =>
    apiGet<{ date: string; earned: number; redeemed: number; outstandingBalance: number }[], AggregateMeta>(
      '/clovers/timeseries',
      cleanParams(p),
    ),
  ledger: (p: Params) => apiGet<CloverLedgerRow[], PageMeta>('/clovers/ledger', cleanParams(p)),
  earnBreakdown: (p: Params) =>
    apiGet<{ action: string; clovers: number; transactions: number }[], AggregateMeta>(
      '/clovers/earn-breakdown',
      cleanParams(p),
    ),
  redemptionByDesign: (p: Params) =>
    apiGet<{ cardId: string; slug: string; name: string; redemptions: number; clovers: number }[], AggregateMeta>(
      '/clovers/redemption-by-design',
      cleanParams(p),
    ),
  anomalies: (p: Params = {}) =>
    apiGet<CloverAnomaly[], AggregateMeta>('/clovers/anomalies', cleanParams(p)),
  /** Freeze suspends the account — there is no separate "can't earn" flag. */
  freezeAnomaly: (id: string, reason: string) =>
    apiPost<{ id: string; frozen: boolean; userId: string }>(`/clovers/anomalies/${id}/freeze`, {
      reason,
    }),
  dismissAnomaly: (id: string, reason: string) =>
    apiPost<{ id: string; dismissed: boolean; userId: string }>(`/clovers/anomalies/${id}/dismiss`, {
      reason,
    }),
};

/* ------------------------------------------------------- withdrawals -- */

export const withdrawalsService = {
  list: (p: Params) => apiGet<WithdrawalRow[], PageMeta>('/withdrawals', cleanParams(p)),
  kpis: (p: Params) => apiGet<WithdrawalKpis, AggregateMeta>('/withdrawals/kpis', cleanParams(p)),

  /** 422 without an Idempotency-Key — reuse the same key if the call is retried. */
  retry: (id: string, reason: string, idempotencyKey: string) =>
    apiPost<{ id: string; status: string; stripePayoutId: string }>(
      `/withdrawals/${id}/retry`,
      { reason },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    ),
  markResolved: (id: string, reason: string) =>
    apiPost<{ id: string; status: string }>(`/withdrawals/${id}/mark-resolved`, { reason }),
  contact: (id: string, reason: string, template: 'payout_failed' | 'payout_delayed') =>
    apiPost<{ id: string; contacted: boolean; delivered: boolean }>(`/withdrawals/${id}/contact`, {
      reason,
      template,
    }),
};

/* ------------------------------------------------------------ alerts -- */

export const alertsService = {
  types: () => apiGet<AlertTypeRow[], AggregateMeta>('/alerts/types').then((r) => r.data),
  list: (p: Params) => apiGet<AlertRow[], PageMeta>('/alerts', cleanParams(p)),
  acknowledge: (id: string) => apiPost<{ id: string; status: string }>(`/alerts/${id}/acknowledge`, {}),
  assign: (id: string, adminId: string) =>
    apiPost<{ id: string; status: string; assignedTo: { id: string; name: string } }>(
      `/alerts/${id}/assign`,
      { adminId },
    ),
  snooze: (id: string, duration: '1h' | '24h' | '7d' | 'custom', until?: string) =>
    apiPost<{ id: string; status: string; snoozedUntil: string }>(`/alerts/${id}/snooze`, {
      duration,
      until,
    }),
  resolve: (id: string, reason: string) =>
    apiPost<{ id: string; status: string }>(`/alerts/${id}/resolve`, { reason }),
  dismiss: (id: string, reason: string) =>
    apiPost<{ id: string; status: string }>(`/alerts/${id}/dismiss`, { reason }),
};

/* ----------------------------------------------------------- exports -- */

export const exportsService = {
  list: (p: Params = {}) => apiGet<ExportJobRow[], PageMeta>('/exports', cleanParams(p)),
  create: (payload: {
    dataset: string;
    format: 'csv' | 'json';
    columns?: string[];
    filters?: Record<string, unknown>;
    reason: string;
  }) => apiPost<ExportJobRow>('/exports', payload).then((r) => r.data),
  retry: (id: string) => apiPost<ExportJobRow>(`/exports/${id}/retry`, {}).then((r) => r.data),

  /**
   * Downloads the file. Uses fetch rather than the axios instance because we
   * want raw bytes, and the response is a file, not the JSON envelope.
   * Single-use: a second call is 410.
   */
  async download(id: string, baseUrl: string): Promise<{ blob: Blob; filename: string }> {
    const res = await fetch(`${baseUrl}/exports/${id}/download`, { credentials: 'include' });
    if (!res.ok) {
      const message =
        res.status === 410
          ? 'That download link has already been used. Run the export again.'
          : `Download failed (${res.status}).`;
      throw new Error(message);
    }
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    return { blob: await res.blob(), filename: match?.[1] ?? `export-${id}` };
  },
};

/* ------------------------------------------------------------- audit -- */

export const auditService = {
  list: (p: Params) => apiGet<AuditRow[], PageMeta>('/audit', cleanParams(p)),
  facets: () => apiGet<AuditFacets>('/audit/actions').then((r) => r.data),
};

/* ------------------------------------------------------------ admins -- */

export const adminsService = {
  list: (p: Params = {}) => apiGet<AdminRow[], PageMeta>('/admins', cleanParams(p)),
  permissions: () => apiGet<RolesResponse>('/admins/permissions').then((r) => r.data),
  /** Never send a password — the backend generates it and emails activation. */
  create: (payload: { name: string; email: string; role: string; twoFactorEnabled?: boolean }) =>
    apiPost<AdminRow>('/admins', payload).then((r) => r.data),
  update: (id: string, payload: { name?: string; role?: string; twoFactorEnabled?: boolean; reason?: string }) =>
    apiPatch<AdminRow>(`/admins/${id}`, payload).then((r) => r.data),
  revoke: (id: string, reason: string) =>
    apiPost<AdminRow>(`/admins/${id}/revoke`, { reason }).then((r) => r.data),
  restore: (id: string, reason: string) =>
    apiPost<AdminRow>(`/admins/${id}/restore`, { reason }).then((r) => r.data),
  reset2fa: (id: string, reason: string) =>
    apiPost<AdminRow>(`/admins/${id}/reset-2fa`, { reason }).then((r) => r.data),
};

/* ---------------------------------------------------------- settings -- */

export const settingsService = {
  get: () => apiGet<SettingsApi, SettingsMeta>('/settings'),
  update: (payload: Partial<SettingsApi> & { reason: string }) =>
    apiPut<SettingsApi>('/settings', payload),
};

/* ------------------------------------------------------------ search -- */

export const searchService = {
  query: (q: string, limit = 12) =>
    apiGet<SearchHit[], { query: string; totalMatches: number }>('/search', { q, limit }),
};
