/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Same-origin path in dev (proxied), absolute API origin in production. */
  readonly VITE_API_BASE_URL?: string;
  /** Backend origin the dev server proxies /api to. Dev only. */
  readonly VITE_API_TUNNEL?: string;
  /** Topbar environment chip (§3). */
  readonly VITE_ENV?: 'PROD' | 'STAGING';
  /** `mock` renders fixtures, `api` calls the backend. */
  readonly VITE_DATA_SOURCE?: 'mock' | 'api';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
