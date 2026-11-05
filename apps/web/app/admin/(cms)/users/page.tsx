'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, Lock, Pencil, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { createUserSchema, DEFAULT_ROLES, PERMISSIONS, ROLE_KEYS, type CreateUserInput, type RoleKey } from '@asva/shared';
import { RequirePermission, useAuth } from '@/components/admin/auth';
import { DataTable, PageHeader, PaginationBar, SearchInput, useDebounced } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Field, Input, Switch } from '@/components/ui/form-controls';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/overlays';
import { Alert, Badge } from '@/components/ui/primitives';
import { api, apiPaged, ApiError } from '@/lib/api/client';
import { formatDateTime } from '@/lib/utils';

function RoleCheckboxes({ value, onChange }: { value: RoleKey[]; onChange: (v: RoleKey[]) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Roles</legend>
      {ROLE_KEYS.map((key) => (
        <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
          <input type="checkbox" className="mt-0.5 size-4 accent-[var(--brand)]" checked={value.includes(key)} onChange={(e) => onChange(e.target.checked ? [...value, key] : value.filter((r) => r !== key))} />
          <span>
            <span className="block text-sm font-medium">{DEFAULT_ROLES[key].name}</span>
            <span className="text-xs text-muted-foreground">{DEFAULT_ROLES[key].description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function LinkResult({ result }: { result: { link?: string; inviteUrl?: string; emailDelivered: boolean } }) {
  const link = result.inviteUrl ?? result.link!;
  return (
    <div className="space-y-3">
      <Alert variant={result.emailDelivered ? 'success' : 'warning'}>
        {result.emailDelivered ? 'An email with this link has been queued.' : 'Email is not configured, so no email was sent. Share this single-use link with the user securely.'}
      </Alert>
      <div className="flex gap-2">
        <Input readOnly value={link} aria-label="Access link" onFocus={(e) => e.target.select()} />
        <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success('Link copied'))} aria-label="Copy link">
          <Copy />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">The link expires automatically and can be used once.</p>
    </div>
  );
}

export default function UsersPage() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const { data, isLoading } = useQuery({ queryKey: ['/admin/users', search, page], queryFn: () => apiPaged<any>('/admin/users', { query: { q: search, page } }), placeholderData: keepPreviousData });
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [linkResult, setLinkResult] = useState<any | null>(null);
  const [editRoles, setEditRoles] = useState<RoleKey[]>([]);
  const [editActive, setEditActive] = useState(true);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['/admin/users'] });

  const form = useForm<CreateUserInput>({ resolver: zodResolver(createUserSchema), defaultValues: { email: '', name: '', roles: [] } });
  const invite = useMutation({
    mutationFn: (v: CreateUserInput) => api<any>('/admin/users', { method: 'POST', body: v }),
    onSuccess: (r) => { refresh(); setLinkResult(r); form.reset(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not invite user'),
  });
  const update = useMutation({
    mutationFn: () => api<any>(`/admin/users/${editing.id}`, { method: 'PATCH', body: { name: editName, isActive: editActive, roles: editRoles } }),
    onSuccess: () => { refresh(); toast.success('User updated'); setEditing(null); },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Update failed'),
  });
  const accessLink = useMutation({ mutationFn: (id: string) => api<any>(`/admin/users/${id}/access-link`, { method: 'POST' }), onSuccess: (r) => setLinkResult(r) });
  const unlock = useMutation({ mutationFn: (id: string) => api(`/admin/users/${id}/unlock`, { method: 'POST' }), onSuccess: () => { refresh(); toast.success('Account unlocked'); } });

  return (
    <RequirePermission permission={PERMISSIONS.USERS_MANAGE}>
      <PageHeader title="Users" description="Invite staff and assign roles. Users set their own password through a single-use link." actions={<Button onClick={() => { setError(null); setLinkResult(null); setInviteOpen(true); }}><UserPlus /> Invite user</Button>} />
      <div className="mb-4"><SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} /></div>
      <DataTable
        rows={data?.data}
        loading={isLoading}
        columns={[
          { key: 'name', header: 'User', cell: (r) => (<div><p className="font-medium">{r.name}{r.id === me.id && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</p><p className="text-xs text-muted-foreground">{r.email}</p></div>) },
          { key: 'roles', header: 'Roles', cell: (r) => <div className="flex flex-wrap gap-1">{r.roles.map((role: any) => <Badge key={role.key} variant="secondary">{role.name}</Badge>)}</div> },
          { key: 'status', header: 'Status', cell: (r) => (<div className="flex flex-wrap gap-1">{!r.isActive ? <Badge variant="danger">Deactivated</Badge> : !r.hasPassword ? <Badge variant="warning">Invited</Badge> : <Badge variant="success">Active</Badge>}{r.lockedUntil && new Date(r.lockedUntil) > new Date() && <Badge variant="danger">Locked</Badge>}</div>) },
          { key: 'login', header: 'Last sign-in', hideOnMobile: true, cell: (r) => <span className="text-muted-foreground">{formatDateTime(r.lastLoginAt)}</span> },
          {
            key: 'actions', header: <span className="sr-only">Actions</span>, className: 'w-px whitespace-nowrap text-right',
            cell: (r) => (
              <div className="flex justify-end gap-1">
                {r.lockedUntil && new Date(r.lockedUntil) > new Date() && <Button size="sm" variant="ghost" aria-label="Unlock" onClick={() => unlock.mutate(r.id)}><Lock /></Button>}
                <Button size="sm" variant="ghost" aria-label={r.hasPassword ? 'Send password reset link' : 'Resend invitation'} title={r.hasPassword ? 'Send password reset link' : 'Resend invitation'} onClick={() => { setLinkResult(null); accessLink.mutate(r.id); }}><KeyRound /></Button>
                <Button size="sm" variant="ghost" aria-label="Edit" onClick={() => { setError(null); setEditing(r); setEditName(r.name); setEditActive(r.isActive); setEditRoles(r.roles.map((x: any) => x.key)); }}><Pencil /></Button>
              </div>
            ),
          },
        ]}
      />
      <PaginationBar meta={data?.meta} onPage={setPage} />

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader title="Invite a user" description="They will receive a link to set their own password." />
          {linkResult ? (
            <LinkResult result={linkResult} />
          ) : (
            <form className="space-y-4" noValidate onSubmit={form.handleSubmit((v) => { setError(null); invite.mutate(v); })}>
              <Field id="u-name" label="Full name" error={form.formState.errors.name?.message}><Input {...form.register('name')} /></Field>
              <Field id="u-email" label="Email" error={form.formState.errors.email?.message}><Input type="email" {...form.register('email')} /></Field>
              <RoleCheckboxes value={form.watch('roles') as RoleKey[]} onChange={(v) => form.setValue('roles', v, { shouldValidate: true })} />
              {form.formState.errors.roles && <p className="text-xs text-destructive" role="alert">{form.formState.errors.roles.message}</p>}
              {error && <Alert variant="error">{error}</Alert>}
              <Button type="submit" loading={invite.isPending} className="w-full">Send invitation</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader title="Edit user" description={editing?.email} />
          <div className="space-y-4">
            <Field id="e-name" label="Full name"><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></Field>
            <RoleCheckboxes value={editRoles} onChange={setEditRoles} />
            <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span>
                <span className="block font-medium">Active</span>
                <span className="text-xs text-muted-foreground">Deactivating signs the user out everywhere immediately.</span>
              </span>
              <Switch checked={editActive} onCheckedChange={setEditActive} disabled={editing?.id === me.id} />
            </label>
            {error && <Alert variant="error">{error}</Alert>}
            <Button className="w-full" loading={update.isPending} onClick={() => update.mutate()} disabled={editRoles.length === 0}>Save changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={linkResult !== null && !inviteOpen} onOpenChange={(o) => !o && setLinkResult(null)}>
        <DialogContent>
          <DialogHeader title={linkResult?.type === 'password-reset' ? 'Password reset link' : 'Invitation link'} />
          {linkResult && <LinkResult result={linkResult} />}
        </DialogContent>
      </Dialog>
    </RequirePermission>
  );
}
