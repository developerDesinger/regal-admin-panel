import axios from 'axios';

/**
 * HTTP client for the admin API.
 *
 * The panel currently renders from the fixtures in `lib/mock/data.ts`, so
 * nothing imports this yet — it is the wiring point for when the backend
 * endpoints in §22 land.
 *
 * Auth model (§01 Non-negotiables / §21 Security):
 *  · The session lives in an httpOnly, Secure, SameSite=Strict cookie set by
 *    the server. There is deliberately no bearer token read from localStorage —
 *    a token reachable from JS is a token an XSS can exfiltrate.
 *  · `withCredentials` sends that cookie on every call.
 *  · Mutations carry a CSRF token, which the server issues in a readable
 *    (non-httpOnly) companion cookie.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

api.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = readCookie('csrf_token');
    if (csrf) config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 → the session cookie expired or was revoked. The server clears it;
    // the client only has to send the admin back to the login screen.
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login?reason=session';
    }
    return Promise.reject(error);
  },
);

export default api;
