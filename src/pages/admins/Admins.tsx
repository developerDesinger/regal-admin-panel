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
import { useAdmins, useRoleMatrix } from '@/hooks/data';
import { adminsService } from '@/lib/api/services';
import { ApiError } from '@/lib/api/client';
import { Input } from '@/components/ui/input';
import { Label, FieldHelp } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { formatDate, formatRelative } from '@/lib/format';
import type { AdminRole } from '@/lib/types';
import type { AdminRow } from '@/lib/api/types';
import { avatarColorFor } from '@/lib/api/adapters';
import { cn } from '@/lib/utils';

/** Screen 15 — Admin Users & Roles (§15). */

/** Grouping is presentation; membership comes from the server's permission list. */
const GROUP_ORDER: { label: string; match: (p: string) => boolean }[] = [
  { label: 'Events', match: (p) => p.startsWith('events:') },
  { label: 'Money', match: (p) => /^(contributions|financials|payouts):/.test(p) },
  { label: 'People', match: (p) => /^(users|pii):/.test(p) },
  { label: 'Cards & clovers', match: (p) => /^(cards|clovers):/.test(p) },
  { label: 'Operations', match: (p) => /^(alerts|exports|audit):/.test(p) },
  { label: 'Administration', match: (p) => /^(admins|settings):/.test(p) },
];

export default function Admins() {
  const { toast } = useToast();
  const { admin: currentUser } = useAuth();
  const { admins: adminUsers, refetch } = useAdmins();
  // The same object the server enforces with — never a local copy (§15).
  const matrix = useRoleMatrix();
  const permissions = React.useMemo(() => matrix?.permissions ?? [], [matrix]);
  const roles = React.useMemo(
    () => (matrix ? (Object.keys(matrix.roles) as AdminRole[]) : []),
    [matrix],
  );
  const roleLabel = (r: AdminRole) => matrix?.roles[r]?.label ?? r;
  const rolePermissions = (r: AdminRole) => matrix?.roles[r]?.permissions ?? [];

  /** Anything the server sends that no group claims still gets shown. */
  const groups = React.useMemo(() => {
    const claimed = new Set<string>();
    const out = GROUP_ORDER.map((g) => {
      const members = permissions.filter((p) => g.match(p));
      members.forEach((p) => claimed.add(p));
      return { label: g.label, permissions: members };
    }).filter((g) => g.permissions.length > 0);
    const rest = permissions.filter((p) => !claimed.has(p));
    return rest.length ? [...out, { label: 'Other', permissions: rest }] : out;
  }, [permissions]);
  const [revoking, setRevoking] = React.useState<AdminRow | null>(null);
  const [inviting, setInviting] = React.useState(false);
  const [inviteName, setInviteName] = React.useState('');
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<AdminRole>('support');

  const columns: Column<AdminRow>[] = [
    {
      id: 'admin',
      header: 'Admin',
      sortable: true,
      sortValue: (a) => a.name,
      cell: (a) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={a.name} color={avatarColorFor(a.id)} size="md" />
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
        <Tooltip content={matrix?.roles[a.role]?.description ?? ''}>
          <span className="cursor-help">
            <Chip tone={a.role === 'super_admin' ? 'brand' : 'neutral'}>{roleLabel(a.role)}</Chip>
          </span>
        </Tooltip>
      ),
    },
    {
      id: 'permissions',
      header: 'Permissions',
      numeric: true,
      cell: (a) => <span className="tnum">{rolePermissions(a.role).length}</span>,
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
        <div className="scroll-x">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-neutral-50">
              <tr className="border-b border-neutral-200">
                <th
                  scope="col"
                  className="min-w-[200px] px-4 py-3 text-left text-table-header uppercase text-neutral-500"
                >
                  Permission
                </th>
                {roles.map((r) => (
                  <th
                    key={r}
                    scope="col"
                    className="min-w-[120px] px-4 py-3 text-center text-table-header uppercase text-neutral-500"
                  >
                    {roleLabel(r)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <React.Fragment key={group.label}>
                  <tr className="border-b border-neutral-200 bg-neutral-50">
                    <th
                      scope="rowgroup"
                      colSpan={roles.length + 1}
                      className="px-4 py-2 text-left text-table-header uppercase text-neutral-500"
                    >
                      {group.label}
                    </th>
                  </tr>
                  {group.permissions.map((p) => (
                    <tr key={p} className="border-b border-neutral-200 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3">
                        <code className="font-mono text-[13px] text-neutral-900">{p}</code>
                      </td>
                      {roles.map((r) => {
                        const granted = rolePermissions(r).includes(p);
                        return (
                          <td key={r} className="px-4 py-3 text-center">
                            <span className="sr-only">
                              {roleLabel(r)} {granted ? 'has' : 'does not have'} {p}
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
        {roles.map((r) => (
          <Card key={r} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-card-title text-neutral-900">{roleLabel(r)}</h3>
              <span className="tnum text-caption text-neutral-500">
                {rolePermissions(r).length}/{permissions.length}
              </span>
            </div>
            <p className="mt-2 text-body text-neutral-500">{matrix?.roles[r]?.description}</p>
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
                <strong>{revoking.name}</strong> regains {roleLabel(revoking.role)} access to this
                panel at their next sign-in.
              </>
            )
          }
          confirmLabel={revoking.isActive ? 'Revoke access' : 'Restore access'}
          onConfirm={(reason) => {
            void (revoking.isActive
              ? adminsService.revoke(revoking.id, reason)
              : adminsService.restore(revoking.id, reason)
            ).then(refetch);
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
        consequence={
          <>
            The backend generates the credential and emails a single-use activation link — no
            password is ever sent from this screen. The new admin must set their own before their
            first sign-in.
          </>
        }
        confirmLabel="Send invitation"
        onConfirm={() => {
          if (!inviteName.trim() || !inviteEmail.trim()) {
            toast({ title: 'Name and email are required', tone: 'warning' });
            return;
          }
          adminsService
            .create({ name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole })
            .then((created) => {
              toast({
                title: 'Invitation sent',
                description: `${created.name} · ${roleLabel(created.role)}`,
                tone: 'success',
              });
              setInviteName('');
              setInviteEmail('');
              refetch();
            })
            .catch((err: ApiError) => {
              const fields = Object.entries(err.fieldErrors ?? {});
              toast({
                title: 'Could not send invitation',
                description: fields.length
                  ? fields.map(([k, v]) => `${k}: ${v}`).join(' · ')
                  : err.message,
                tone: 'danger',
              });
            });
        }}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="invite-name" required>
              Full name
            </Label>
            <Input
              id="invite-name"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Ana Ramírez"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="invite-email" required>
              Email
            </Label>
            <Input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="ana@regal.app"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="invite-role" required>
              Role
            </Label>
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AdminRole)}>
              <SelectTrigger id="invite-role" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldHelp>{matrix?.roles[inviteRole]?.description}</FieldHelp>
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}
