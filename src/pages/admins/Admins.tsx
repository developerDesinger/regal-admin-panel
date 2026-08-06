import * as React from 'react';
import { Check, Minus, ShieldCheck, UserPlus } from 'lucide-react';
import { PageHeader, SectionHeading } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusBadge, Chip } from '@/components/common/StatusBadge';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { actions, useStore } from '@/lib/store';
import {
  PERMISSIONS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type Permission,
} from '@/lib/permissions';
import { formatDate, formatRelative } from '@/lib/format';
import type { AdminRole, AdminUser } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Screen 15 — Admin Users & Roles (§15). */

const ROLES: AdminRole[] = ['super_admin', 'finance', 'operations', 'support', 'analyst'];

const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: 'Events', permissions: ['events:read', 'events:write'] },
  { label: 'Money', permissions: ['contributions:read', 'financials:read', 'payouts:write'] },
  { label: 'People', permissions: ['users:read', 'pii:read', 'pii:export'] },
  { label: 'Cards & clovers', permissions: ['cards:read', 'cards:write', 'clovers:read', 'clovers:adjust'] },
  { label: 'Operations', permissions: ['alerts:manage', 'exports:run', 'audit:read'] },
  { label: 'Administration', permissions: ['admins:manage', 'settings:write'] },
];

export default function Admins() {
  const { toast } = useToast();
  const { admin: currentUser } = useAuth();
  const { adminUsers } = useStore();
  const [revoking, setRevoking] = React.useState<AdminUser | null>(null);
  const [inviting, setInviting] = React.useState(false);

  const columns: Column<AdminUser>[] = [
    {
      id: 'admin',
      header: 'Admin',
      sortable: true,
      sortValue: (a) => a.name,
      cell: (a) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={a.name} color={a.avatarColor} size="md" />
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-900">
              {a.name}
              {a.id === currentUser?.id && <Chip className="ml-2">you</Chip>}
            </p>
            <p className="truncate text-caption text-neutral-500">{a.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      sortable: true,
      sortValue: (a) => a.role,
      cell: (a) => (
        <Tooltip content={ROLE_DESCRIPTIONS[a.role]}>
          <span className="cursor-help">
            <Chip tone={a.role === 'super_admin' ? 'brand' : 'neutral'}>{ROLE_LABELS[a.role]}</Chip>
          </span>
        </Tooltip>
      ),
    },
    {
      id: 'permissions',
      header: 'Permissions',
      numeric: true,
      cell: (a) => <span className="tnum">{ROLE_PERMISSIONS[a.role].length}</span>,
    },
    {
      id: '2fa',
      header: '2FA',
      cell: (a) => (
        <StatusBadge
          status={a.twoFactorEnabled ? 'active' : 'inactive'}
          label={a.twoFactorEnabled ? 'Enabled' : 'Off'}
        />
      ),
    },
    {
      id: 'lastLogin',
      header: 'Last login',
      sortable: true,
      sortValue: (a) => a.lastLoginAt ?? '',
      cell: (a) =>
        a.lastLoginAt ? (
          <span className="text-neutral-500">{formatRelative(a.lastLoginAt)}</span>
        ) : (
          <span className="text-neutral-400">Never</span>
        ),
    },
    {
      id: 'created',
      header: 'Added',
      sortable: true,
      sortValue: (a) => a.createdAt,
      cell: (a) => <span className="tnum whitespace-nowrap">{formatDate(a.createdAt)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (a) => (
        <StatusBadge status={a.isActive ? 'active' : 'inactive'} label={a.isActive ? 'Active' : 'Disabled'} />
      ),
    },
    {
      id: 'actions',
      header: '',
      width: '120px',
      cell: (a) =>
        a.id !== currentUser?.id ? (
          <div data-no-row-click>
            <Button variant="ghost" size="sm" onClick={() => setRevoking(a)}>
              {a.isActive ? 'Revoke access' : 'Restore'}
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Admin Users & Roles"
        subtitle="Who can see and do what inside this panel."
        actions={
          <Button variant="primary" onClick={() => setInviting(true)}>
            <UserPlus className="h-4 w-4" />
            Invite admin
          </Button>
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-md border border-warning-500/20 bg-warning-50 p-3">
        <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-warning-500" aria-hidden />
        <p className="text-caption text-warning-500">
          <strong>Enforcement is server-side.</strong> This UI hides what a role can’t do, but the API
          rejects unauthorized calls regardless — hidden buttons are not security.
        </p>
      </div>

      <DataTable
        columns={columns}
        rows={adminUsers}
        rowKey={(a) => a.id}
        storageKey="admins"
        empty={{
          headline: 'No admin users',
          description: 'Invite your first administrator to give them access to this panel.',
        }}
      />

      {/* Permission matrix — roles × permissions (§15) */}
      <SectionHeading
        className="mt-8"
        description="Exactly what each role can do. Checked means the permission is granted."
      >
        Permission matrix
      </SectionHeading>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-neutral-50">
              <tr className="border-b border-neutral-200">
                <th
                  scope="col"
                  className="sticky left-0 z-10 min-w-[200px] bg-neutral-50 px-4 py-3 text-left text-table-header uppercase text-neutral-500"
                >
                  Permission
                </th>
                {ROLES.map((r) => (
                  <th
                    key={r}
                    scope="col"
                    className="min-w-[120px] px-4 py-3 text-center text-table-header uppercase text-neutral-500"
                  >
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group) => (
                <React.Fragment key={group.label}>
                  <tr className="border-b border-neutral-200 bg-neutral-50">
                    <th
                      scope="rowgroup"
                      colSpan={ROLES.length + 1}
                      className="sticky left-0 px-4 py-2 text-left text-table-header uppercase text-neutral-500"
                    >
                      {group.label}
                    </th>
                  </tr>
                  {group.permissions.map((p) => (
                    <tr key={p} className="border-b border-neutral-200 last:border-0">
                      <td className="sticky left-0 bg-neutral-0 px-4 py-3">
                        <code className="font-mono text-[13px] text-neutral-900">{p}</code>
                      </td>
                      {ROLES.map((r) => {
                        const granted = ROLE_PERMISSIONS[r].includes(p);
                        return (
                          <td key={r} className="px-4 py-3 text-center">
                            <span className="sr-only">
                              {ROLE_LABELS[r]} {granted ? 'has' : 'does not have'} {p}
                            </span>
                            <span
                              className={cn(
                                'mx-auto flex h-5 w-5 items-center justify-center rounded-sm',
                                granted ? 'bg-success-50 text-success-500' : 'bg-neutral-100 text-neutral-400',
                              )}
                              aria-hidden
                            >
                              {granted ? (
                                <Check className="h-3 w-3" strokeWidth={3} />
                              ) : (
                                <Minus className="h-3 w-3" strokeWidth={3} />
                              )}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Role reference */}
      <SectionHeading className="mt-8">Role reference</SectionHeading>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ROLES.map((r) => (
          <Card key={r} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-card-title text-neutral-900">{ROLE_LABELS[r]}</h3>
              <span className="tnum text-caption text-neutral-500">
                {ROLE_PERMISSIONS[r].length}/{PERMISSIONS.length}
              </span>
            </div>
            <p className="mt-2 text-body text-neutral-500">{ROLE_DESCRIPTIONS[r]}</p>
            <p className="mt-3 text-caption text-neutral-400">
              {adminUsers.filter((a) => a.role === r).length} admin
              {adminUsers.filter((a) => a.role === r).length === 1 ? '' : 's'} with this role
            </p>
          </Card>
        ))}
      </div>

      {revoking && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setRevoking(null)}
          title={revoking.isActive ? 'Revoke admin access' : 'Restore admin access'}
          tone={revoking.isActive ? 'danger' : 'primary'}
          requireReason
          requireTypedConfirmation={revoking.isActive ? revoking.name : undefined}
          consequence={
            revoking.isActive ? (
              <>
                <strong>{revoking.name}</strong> will be signed out of all sessions immediately and
                will lose access to this panel. Their audit history is retained.
              </>
            ) : (
              <>
                <strong>{revoking.name}</strong> regains {ROLE_LABELS[revoking.role]} access to this
                panel at their next sign-in.
              </>
            )
          }
          confirmLabel={revoking.isActive ? 'Revoke access' : 'Restore access'}
          onConfirm={(reason) => {
            actions.setAdminActive(currentUser, revoking.id, !revoking.isActive, reason);
            toast({
              title: revoking.isActive ? 'Access revoked' : 'Access restored',
              description: revoking.name,
              tone: 'success',
            });
          }}
        />
      )}

      <ConfirmDialog
        open={inviting}
        onOpenChange={setInviting}
        title="Invite a new admin"
        tone="primary"
        requireReason
        consequence={
          <>
            An invitation email with a single-use signup link will be sent. The new admin must set a
            password and, if 2FA is required, enroll an authenticator before their first sign-in.
          </>
        }
        confirmLabel="Send invitation"
        onConfirm={(reason) => toast({ title: 'Invitation sent', description: reason, tone: 'success' })}
      />
    </>
  );
}
