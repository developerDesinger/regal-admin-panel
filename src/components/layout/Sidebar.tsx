import { useTranslation } from 'react-i18next';
import * as React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BadgeCheck,
  Bell,
  CalendarDays,
  ChevronLeft,
  Clover,
  CreditCard,
  Download,
  FileClock,
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/use-auth';
import type { Permission } from '@/lib/permissions';
import { useAlerts } from '@/hooks/data';
import { cn } from '@/lib/utils';

/**
 * Sidebar (§3) — 240px fixed, neutral-0, right border neutral-200. Collapsible
 * to a 64px icon rail with the state persisted in localStorage. Active item:
 * brand-50 background, brand-500 text, 3px left indicator bar.
 *
 * Nav items are hidden entirely when the admin's role lacks permission — never
 * a disabled item they can't unlock.
 */

interface NavItem {
  /** Key under `nav.*` — resolved at render so the language switch relabels it. */
  labelKey: string;
  to: string;
  icon: LucideIcon;
  permission: Permission;
  end?: boolean;
  children?: { labelKey: string; to: string }[];
  badge?: number;
}

const NAV_GROUPS: { items: NavItem[] }[] = [
  {
    items: [
      { labelKey: 'nav.dashboard', to: '/', icon: LayoutDashboard, permission: 'events:read', end: true },
      { labelKey: 'nav.events', to: '/events', icon: CalendarDays, permission: 'events:read' },
      {
        labelKey: 'nav.contributions',
        to: '/contributions',
        icon: Receipt,
        permission: 'contributions:read',
      },
      { labelKey: 'nav.users', to: '/users', icon: Users, permission: 'users:read' },
      {
        labelKey: 'nav.giftCards',
        to: '/cards',
        icon: CreditCard,
        permission: 'cards:read',
        children: [
          { labelKey: 'nav.analytics', to: '/cards/analytics' },
          { labelKey: 'nav.catalog', to: '/cards/catalog' },
          { labelKey: 'nav.categories', to: '/cards/categories' },
        ],
      },
      { labelKey: 'nav.clovers', to: '/clovers', icon: Clover, permission: 'clovers:read' },
      { labelKey: 'nav.withdrawals', to: '/withdrawals', icon: Wallet, permission: 'financials:read' },
      { labelKey: 'nav.alerts', to: '/alerts', icon: Bell, permission: 'alerts:manage' },
      { labelKey: 'nav.exports', to: '/exports', icon: Download, permission: 'exports:run' },
    ],
  },
  {
    items: [
      { labelKey: 'nav.auditTrail', to: '/audit', icon: FileClock, permission: 'audit:read' },
      { labelKey: 'nav.admins', to: '/admins', icon: BadgeCheck, permission: 'admins:manage' },
      { labelKey: 'nav.settings', to: '/settings', icon: Settings, permission: 'settings:write' },
    ],
  },
];

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const location = useLocation();
  const { meta } = useAlerts({ state: 'open' });
  const openAlerts = meta?.totalRows ?? 0;

  return (
    <nav
      aria-label={t('nav.mainNavigation')}
      className={cn(
        'flex h-full flex-col border-r border-neutral-200 bg-neutral-0 transition-[width] duration-panel ease-standard',
        collapsed ? 'w-16' : 'w-[240px]',
      )}
    >
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-neutral-200',
          collapsed ? 'justify-center px-2' : 'gap-3 px-4',
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-500">
          <ShieldCheck className="h-5 w-5 text-white" aria-hidden />
        </span>
        {!collapsed && (
          <span className="truncate text-[15px] font-semibold text-neutral-900">
            {t('auth.brand')}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4">
        {NAV_GROUPS.map((group, gi) => {
          const visible = group.items.filter((item) => can(item.permission));
          if (visible.length === 0) return null;
          return (
            <React.Fragment key={gi}>
              {gi > 0 && <hr className="mx-4 my-3 border-neutral-200" />}
              <ul className="space-y-0.5 px-2">
                {visible.map((item) => (
                  <SidebarItem
                    key={item.to}
                    item={item}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                    badge={item.labelKey === 'nav.alerts' ? openAlerts : undefined}
                    forceExpanded={location.pathname.startsWith(item.to) && item.to !== '/'}
                  />
                ))}
              </ul>
            </React.Fragment>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-neutral-200 p-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700',
            collapsed && 'justify-center px-0',
          )}
        >
          <ChevronLeft
            className={cn('h-4 w-4 shrink-0 transition-transform duration-panel', collapsed && 'rotate-180')}
            aria-hidden
          />
          {!collapsed && t('nav.collapse')}
        </button>
      </div>
    </nav>
  );
}

function SidebarItem({
  item,
  collapsed,
  onNavigate,
  badge,
  forceExpanded,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
  badge?: number;
  forceExpanded: boolean;
}) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const hasChildren = Boolean(item.children?.length);
  // A parent with children navigates to its first child.
  const target = hasChildren ? item.children![0].to : item.to;

  const link = (
    <NavLink
      to={target}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 rounded-md py-2 text-[14px] font-medium leading-5 transition-colors duration-micro',
          collapsed ? 'justify-center px-0' : 'px-3',
          isActive || forceExpanded
            ? 'bg-brand-50 text-brand-500'
            : 'text-neutral-700 hover:bg-neutral-100',
        )
      }
    >
      {({ isActive }) => (
        <>
          {(isActive || forceExpanded) && (
            <span
              className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500"
              aria-hidden
            />
          )}
          <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
          {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
          {!collapsed && badge !== undefined && badge > 0 && (
            <span className="tnum ml-auto rounded-full bg-danger-500 px-1.5 py-px text-[11px] font-semibold text-white">
              {badge}
            </span>
          )}
          {collapsed && badge !== undefined && badge > 0 && (
            <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-danger-500" aria-hidden />
          )}
        </>
      )}
    </NavLink>
  );

  return (
    <li>
      {collapsed ? (
        <Tooltip content={t(item.labelKey)} side="right">
          {link}
        </Tooltip>
      ) : (
        link
      )}

      {hasChildren && !collapsed && forceExpanded && (
        <ul className="mt-0.5 space-y-0.5 pl-9">
          {item.children!.map((child) => (
            <li key={child.to}>
              <NavLink
                to={child.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'block rounded-md px-3 py-1.5 text-[13px] leading-5 transition-colors duration-micro',
                    isActive
                      ? 'font-medium text-brand-500'
                      : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700',
                  )
                }
              >
                {t(child.labelKey)}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
