import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/ui/misc';
import { useAuth } from '@/hooks/use-auth';
import { ROLE_LABELS } from '@/lib/permissions';
import { useAlerts } from '@/hooks/data';
import { readLocal, writeLocal } from '@/hooks/useUrlState';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Topbar (§3) — 64px, sticky, neutral-0, bottom border. Logo, global search
 * (⌘K), alert bell with unread count, environment chip, avatar menu.
 */

const ENV = (import.meta.env.VITE_ENV as string | undefined) ?? 'STAGING';

export function Topbar({
  onOpenSearch,
  onOpenMobileNav,
}: {
  onOpenSearch: () => void;
  onOpenMobileNav: () => void;
}) {
  const { admin, signOut } = useAuth();
  const navigate = useNavigate();
  const { rows: openAlerts, meta: alertMeta } = useAlerts({ state: 'open' });
  const unread = alertMeta?.totalRows ?? openAlerts.length;
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() =>
    readLocal<'light' | 'dark'>('regal:theme', 'light'),
  );

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    writeLocal('regal:theme', theme);
  }, [theme]);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-neutral-200 bg-neutral-0 px-4 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Global search — ⌘K */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-left text-[14px] text-neutral-400 transition-colors hover:border-neutral-300 md:max-w-[420px]"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">Search events, users, IDs…</span>
        <kbd className="ml-auto hidden shrink-0 rounded-sm border border-neutral-200 bg-neutral-0 px-1.5 py-0.5 font-mono text-[11px] sm:block">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        {ENV !== 'PROD' && (
          <span
            className={cn(
              'hidden rounded-sm px-2 py-1 text-[11px] font-semibold uppercase tracking-wide sm:block',
              ENV === 'PROD' ? 'bg-danger-50 text-danger-500' : 'bg-warning-50 text-warning-500',
            )}
          >
            {ENV}
          </span>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
          aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        >
          {theme === 'light' ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label={`Alerts, ${unread} unread`}>
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 && (
                <span className="tnum absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-semibold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[340px] p-0">
            <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
              <span className="text-card-title text-neutral-700">Alerts</span>
              <span className="tnum text-caption text-neutral-500">{unread} open</span>
            </div>
            <ul className="max-h-[320px] overflow-y-auto p-1">
              {openAlerts.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <Link
                      to={a.subject.href}
                      className="flex items-start gap-2 rounded-sm px-3 py-2 transition-colors hover:bg-neutral-100"
                    >
                      <span
                        className={cn(
                          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                          a.severity === 'danger'
                            ? 'bg-danger-500'
                            : a.severity === 'warning'
                              ? 'bg-warning-500'
                              : 'bg-info-500',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-neutral-900">
                          {a.type.split('_').join(' ')}
                        </span>
                        <span className="block truncate text-caption text-neutral-500">
                          {a.subject.label}
                        </span>
                      </span>
                      <span className="shrink-0 text-caption text-neutral-400">
                        {formatRelative(a.triggeredAt)}
                      </span>
                    </Link>
                  </li>
              ))}
            </ul>
            <div className="border-t border-neutral-200 p-1">
              <DropdownMenuItem onSelect={() => navigate('/alerts')}>
                View all alerts
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md p-1 transition-colors hover:bg-neutral-100"
              aria-label="Account menu"
            >
              <Avatar name={admin?.name ?? 'Admin'} color={admin?.avatarColor} size="md" />
              <span className="hidden text-left md:block">
                <span className="block text-[13px] font-medium leading-4 text-neutral-900">
                  {admin?.name}
                </span>
                <span className="block text-[11px] leading-4 text-neutral-500">
                  {admin ? ROLE_LABELS[admin.role] : ''}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[260px]">
            <DropdownMenuLabel>{admin?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onSelect={() => {
                signOut();
                navigate('/login');
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
