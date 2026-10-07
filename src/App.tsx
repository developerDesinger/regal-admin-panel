import { useTranslation } from 'react-i18next';
import { Suspense, lazy } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';

import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import ChangePassword from '@/pages/ChangePassword';
import Legal from '@/pages/Legal';
// An event's public page — where `shareUrl` from the API lands. Code-split:
// nobody signing into the panel needs it, and nobody opening a shared link
// needs the panel. `/download` and `/i/:code` are NOT here: server.js answers
// those before the SPA ever loads, which is also what serves the two app
// association files.
const EventLanding = lazy(() => import('@/pages/public/EventLanding'));

// Every authenticated route is code-split, so the login screen never downloads
// the charting library and the dashboard's first paint stays small
// (§21 Performance targets: LCP < 2.0s).
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const EventsList = lazy(() => import('@/pages/events/EventsList'));
const EventDetail = lazy(() => import('@/pages/events/EventDetail'));
const Contributions = lazy(() => import('@/pages/contributions/Contributions'));
const UsersList = lazy(() => import('@/pages/users/UsersList'));
const UserDetail = lazy(() => import('@/pages/users/UserDetail'));
const CardAnalytics = lazy(() => import('@/pages/cards/CardAnalytics'));
const CardCatalog = lazy(() => import('@/pages/cards/CardCatalog'));
const CardCategories = lazy(() => import('@/pages/cards/CardCategories'));
const CardDetail = lazy(() => import('@/pages/cards/CardDetail'));
const Clovers = lazy(() => import('@/pages/clovers/Clovers'));
const Withdrawals = lazy(() => import('@/pages/withdrawals/Withdrawals'));
const Alerts = lazy(() => import('@/pages/alerts/Alerts'));
const Exports = lazy(() => import('@/pages/exports/Exports'));
const Audit = lazy(() => import('@/pages/audit/Audit'));
const Admins = lazy(() => import('@/pages/admins/Admins'));
const Settings = lazy(() => import('@/pages/settings/Settings'));
const NotFound = lazy(() => import('@/pages/NotFound'));

/**
 * Route map (§3). The spec's Next.js App Router tree is mirrored 1:1 onto
 * React Router: `(auth)/login` and the `(dashboard)` group with its shell
 * layout become the two top-level route branches below.
 */
export default function App() {
  const { t } = useTranslation();
  return (
    <AuthProvider>
      <TooltipProvider delayDuration={200} skipDelayDuration={300}>
        <ToastProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-white"
          >
            {t('common.skipToContent')}
          </a>

          <Routes>
            {/* (auth) — unauthenticated, no shell */}
            <Route path="/login" element={<Login />} />
            <Route path="/login/forgot" element={<ForgotPassword />} />
            <Route path="/login/reset" element={<ResetPassword />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/privacy" element={<Legal doc="privacy" />} />
            <Route path="/terms" element={<Legal doc="terms" />} />
            <Route path="/delete-account" element={<Legal doc="deleteAccount" />} />
            {/* An event's share link. Public: whoever follows one has no
                account, and the admin shell would bounce them to /login. It
                needs its own Suspense — the only other one lives inside that
                shell. */}
            <Route
              element={
                <Suspense fallback={<div className="min-h-screen bg-neutral-50" />}>
                  <Outlet />
                </Suspense>
              }
            >
              <Route path="/c/:slug" element={<EventLanding />} />
            </Route>

            {/* (dashboard) — shell: sidebar + topbar + filter context */}
            <Route element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="events" element={<EventsList />} />
              <Route path="events/:eventId" element={<EventDetail />} />
              <Route path="events/:eventId/:tab" element={<EventDetail />} />
              <Route path="contributions" element={<Contributions />} />
              <Route path="users" element={<UsersList />} />
              <Route path="users/:userId" element={<UserDetail />} />
              <Route path="cards" element={<Navigate to="/cards/analytics" replace />} />
              <Route path="cards/analytics" element={<CardAnalytics />} />
              <Route path="cards/catalog" element={<CardCatalog />} />
              <Route path="cards/catalog/:cardId" element={<CardDetail />} />
              <Route path="cards/categories" element={<CardCategories />} />
              <Route path="clovers" element={<Clovers />} />
              <Route path="withdrawals" element={<Withdrawals />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="exports" element={<Exports />} />
              <Route path="audit" element={<Audit />} />
              <Route path="admins" element={<Admins />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </ToastProvider>
      </TooltipProvider>
    </AuthProvider>
  );
}
