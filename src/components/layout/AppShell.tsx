import * as React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { GlobalSearch } from './GlobalSearch';
import { IdleTimeout } from './IdleTimeout';
import { Skeleton } from '@/components/ui/misc';
import { useAuth } from '@/hooks/use-auth';
import { readLocal, writeLocal } from '@/hooks/useUrlState';

/**
 * Dashboard shell (§3) — sidebar + topbar + page content.
 * Desktop-first, usable at 1024px. Below 1024px the sidebar collapses to a
 * drawer; the page body never scrolls sideways (§2.5).
 */
export function AppShell() {
  const { admin, isRestoring } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = React.useState(() => readLocal('regal:sidebar-collapsed', false));
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  React.useEffect(() => {
    writeLocal('regal:sidebar-collapsed', collapsed);
  }, [collapsed]);

  // ⌘K / Ctrl-K opens global search from anywhere (§21).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Boot-time /auth/me is in flight — redirecting here would bounce a signed-in
  // admin to /login on every refresh.
  if (isRestoring) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-neutral-50"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Restoring your session…</span>
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-brand-500" />
      </div>
    );
  }

  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <aside className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((v) => !v)} />
      </aside>

      {/* Below 1024px the sidebar becomes a drawer */}
      <DialogPrimitive.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-neutral-900/40 lg:hidden" />
          <DialogPrimitive.Content
            className="fixed left-0 top-0 z-50 h-full w-[240px] lg:hidden"
            aria-label="Navigation"
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <Sidebar
              collapsed={false}
              onToggleCollapsed={() => setMobileNavOpen(false)}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenSearch={() => setSearchOpen(true)} onOpenMobileNav={() => setMobileNavOpen(true)} />
        {/* overflow-x-clip enforces §2.5: wide tables scroll inside their own
            container, the page body never scrolls sideways. `clip` rather than
            `hidden` so it creates no scroll container and sticky headers still
            work; Radix portals its overlays to <body>, so nothing is cut off. */}
        <main id="main" className="page-container flex-1 overflow-x-clip py-6">
          <React.Suspense fallback={<RouteFallback />}>
            <Outlet />
          </React.Suspense>
        </main>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <IdleTimeout />
    </div>
  );
}

/** Skeleton while a code-split route loads — never a spinner (§21). */
function RouteFallback() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading page…</span>
      <Skeleton className="h-8 w-[280px]" />
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px]" />
        ))}
      </div>
      <Skeleton className="mt-4 h-[320px]" />
    </div>
  );
}
