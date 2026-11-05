'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@asva/shared';
import { RequirePermission, useAuth } from '@/components/admin/auth';
import { PageHeader } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Alert, Card } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/api/client';

interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  userCount: number;
  permissions: string[];
}
interface Permission {
  id: string;
  key: string;
  group: string;
  description: string;
}

/** Permission matrix. Saved per role; enforced by the API on every request. */
export default function RolesPage() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const editable = can(PERMISSIONS.ROLES_MANAGE);
  const { data: roles } = useQuery({ queryKey: ['/admin/roles'], queryFn: () => api<Role[]>('/admin/roles') });
  const { data: permissions } = useQuery({ queryKey: ['/admin/permissions'], queryFn: () => api<Permission[]>('/admin/permissions') });
  // Local edits layered over the saved permissions; cleared per role after saving.
  const [edits, setEdits] = useState<Record<string, Set<string>>>({});
  const draft = useMemo(() => Object.fromEntries((roles ?? []).map((r) => [r.id, edits[r.id] ?? new Set(r.permissions)])), [roles, edits]);
  const save = useMutation({
    mutationFn: (role: Role) => api(`/admin/roles/${role.id}`, { method: 'PATCH', body: { permissions: [...(draft[role.id] ?? [])] } }),
    onSuccess: (_data, role) => {
      toast.success('Role updated');
      setEdits(({ [role.id]: _saved, ...rest }) => rest);
      void qc.invalidateQueries({ queryKey: ['/admin/roles'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
  });

  if (!roles || !permissions) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const groups = [...new Set(permissions.map((p) => p.group))];
  const dirty = (r: Role) => {
    const d = draft[r.id];
    return d ? d.size !== r.permissions.length || r.permissions.some((p) => !d.has(p)) : false;
  };

  return (
    <RequirePermission permission={PERMISSIONS.USERS_MANAGE}>
      <PageHeader title="Roles & permissions" description="Each role grants a set of permissions. Users can hold several roles." />
      {!editable && <Alert variant="info" className="mb-4">You can view roles but need the “roles.manage” permission to change them.</Alert>}
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Permissions granted to each role</caption>
          <thead className="border-b bg-muted/50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-semibold">Permission</th>
              {roles.map((r) => (
                <th key={r.id} scope="col" className="px-4 py-3 text-center font-semibold">
                  {r.name}
                  <span className="block text-xs font-normal text-muted-foreground">{r.userCount} user(s)</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group}>
                <tr className="bg-muted/30">
                  <th colSpan={roles.length + 1} scope="colgroup" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group}
                  </th>
                </tr>
                {permissions
                  .filter((p) => p.group === group)
                  .map((p) => (
                    <tr key={p.key} className="border-t">
                      <th scope="row" className="px-4 py-2.5 text-left font-normal">
                        <span className="block">{p.description}</span>
                        <code className="text-xs text-muted-foreground">{p.key}</code>
                      </th>
                      {roles.map((r) => (
                        <td key={r.id} className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            aria-label={`${r.name}: ${p.description}`}
                            className="size-4 accent-[var(--brand)]"
                            disabled={!editable}
                            checked={draft[r.id]?.has(p.key) ?? false}
                            onChange={(e) =>
                              setEdits((current) => {
                                const next = new Set(draft[r.id]);
                                if (e.target.checked) next.add(p.key);
                                else next.delete(p.key);
                                return { ...current, [r.id]: next };
                              })
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
          {editable && (
            <tfoot className="border-t bg-muted/30">
              <tr>
                <td className="px-4 py-3 text-xs text-muted-foreground">Administrators always keep user, role and settings management.</td>
                {roles.map((r) => (
                  <td key={r.id} className="px-4 py-3 text-center">
                    <Button size="sm" disabled={!dirty(r)} loading={save.isPending && save.variables?.id === r.id} onClick={() => save.mutate(r)}>
                      Save
                    </Button>
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
    </RequirePermission>
  );
}
