'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@asva/shared';
import { RequirePermission, useAuth } from '@/components/admin/auth';
import { DataTable, FilterSelect, PageHeader, PaginationBar, SearchInput, useDebounced } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/overlays';
import { Badge } from '@/components/ui/primitives';
import { api, apiPaged } from '@/lib/api/client';
import { relativeTime } from '@/lib/utils';

export default function ContactSubmissionsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [status, setStatus] = useState('active');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const search = useDebounced(q);
  const query = { status, q: search, page, pageSize: 25 };
  const { data, isLoading } = useQuery({ queryKey: ['/admin/contact-submissions', query], queryFn: () => apiPaged<any>('/admin/contact-submissions', { query }), placeholderData: keepPreviousData });
  const bulk = useMutation({
    mutationFn: (action: string) => api<{ affected: number }>('/admin/contact-submissions/bulk', { method: 'POST', body: { ids: [...selected], action } }),
    onSuccess: (r) => {
      toast.success(`${r.affected} submission(s) updated`);
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: ['/admin/contact-submissions'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  const canUpdate = can(PERMISSIONS.CONTACT_UPDATE);

  return (
    <RequirePermission permission={PERMISSIONS.CONTACT_READ}>
      <PageHeader title="Contact submissions" description={`Messages from the contact form${data?.meta.unread !== undefined ? ` · ${data.meta.unread} unread` : ''}.`} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} />
        <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); setSelected(new Set()); }} options={[{ value: 'active', label: 'Inbox' }, { value: 'unread', label: 'Unread' }, { value: 'read', label: 'Read' }, { value: 'archived', label: 'Archived' }]} />
        {canUpdate && selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto" role="group" aria-label="Bulk actions">
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
            <Button size="sm" variant="outline" onClick={() => bulk.mutate('read')}>Mark read</Button>
            <Button size="sm" variant="outline" onClick={() => bulk.mutate('unread')}>Mark unread</Button>
            {status === 'archived' ? (
              <Button size="sm" variant="outline" onClick={() => bulk.mutate('unarchive')}>Restore</Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => bulk.mutate('archive')}>Archive</Button>
            )}
            {can(PERMISSIONS.CONTACT_DELETE) && (
              <ConfirmDialog title={`Delete ${selected.size} submission(s)?`} description="This permanently removes the selected messages." confirmLabel="Delete" onConfirm={() => bulk.mutateAsync('delete')} trigger={<Button size="sm" variant="destructive">Delete</Button>} />
            )}
          </div>
        )}
      </div>
      <DataTable
        rows={data?.data}
        loading={isLoading}
        selectable={canUpdate}
        selected={selected}
        onSelectedChange={setSelected}
        onRowClick={(r) => router.push(`/admin/contact/${r.id}`)}
        rowHref={(r) => `/admin/contact/${r.id}`}
        empty="No messages here."
        columns={[
          { key: 'from', header: 'From', cell: (r) => (<div className="flex items-center gap-2">{!r.isRead && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}<div><p className={r.isRead ? '' : 'font-semibold'}>{r.name}</p><p className="text-xs text-muted-foreground">{r.email}</p></div></div>) },
          { key: 'msg', header: 'Message', cell: (r) => (<div className="max-w-md"><p className="truncate font-medium">{r.subject ?? '(no subject)'}</p><p className="truncate text-xs text-muted-foreground">{r.message}</p></div>) },
          { key: 'flags', header: '', hideOnMobile: true, cell: (r) => r.isArchived && <Badge variant="secondary">Archived</Badge> },
          { key: 'date', header: 'Received', cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{relativeTime(r.createdAt)}</span> },
        ]}
      />
      <PaginationBar meta={data?.meta} onPage={setPage} />
    </RequirePermission>
  );
}
