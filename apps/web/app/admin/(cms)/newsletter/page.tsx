'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Trash2, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { LABELS, PERMISSIONS, SUBSCRIBER_STATUSES } from '@asva/shared';
import { RequirePermission, useAuth } from '@/components/admin/auth';
import { DataTable, FilterSelect, PageHeader, PaginationBar, SearchInput, StatusBadge, useDebounced } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/overlays';
import { Alert } from '@/components/ui/primitives';
import { api, apiPaged, downloadFile } from '@/lib/api/client';
import { formatDate } from '@/lib/utils';

export default function NewsletterPage() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const query = { status, q: search, page, pageSize: 25 };
  const { data, isLoading } = useQuery({ queryKey: ['/admin/newsletter/subscribers', query], queryFn: () => apiPaged<any>('/admin/newsletter/subscribers', { query }), placeholderData: keepPreviousData });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['/admin/newsletter/subscribers'] });
  const unsubscribe = useMutation({ mutationFn: (id: string) => api(`/admin/newsletter/subscribers/${id}`, { method: 'PATCH', body: { status: 'UNSUBSCRIBED' } }), onSuccess: () => { toast.success('Unsubscribed'); refresh(); } });
  const remove = useMutation({ mutationFn: (id: string) => api(`/admin/newsletter/subscribers/${id}`, { method: 'DELETE' }), onSuccess: () => { toast.success('Deleted'); refresh(); } });
  const counts = (data?.meta.statusCounts ?? {}) as Record<string, number>;
  const manage = can(PERMISSIONS.NEWSLETTER_MANAGE);

  return (
    <RequirePermission permission={PERMISSIONS.NEWSLETTER_READ}>
      <PageHeader
        title="Newsletter subscribers"
        description={`${counts.SUBSCRIBED ?? 0} confirmed · ${counts.PENDING ?? 0} awaiting confirmation · ${counts.UNSUBSCRIBED ?? 0} unsubscribed`}
        actions={
          can(PERMISSIONS.NEWSLETTER_EXPORT) && (
            <Button variant="outline" onClick={() => downloadFile('/admin/newsletter/subscribers/export', { status: 'SUBSCRIBED' }, 'subscribers.csv').then(() => toast.success('Export downloaded (audited)')).catch(() => toast.error('Export failed'))}>
              <Download /> Export confirmed
            </Button>
          )
        }
      />
      <Alert variant="info" className="mb-4">
        Send marketing emails only to <strong>confirmed</strong> subscribers. The export includes a personal unsubscribe link for each subscriber to use in your email tool.
      </Alert>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search email" />
        <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: '', label: 'All statuses' }, ...SUBSCRIBER_STATUSES.map((s) => ({ value: s, label: LABELS.subscriberStatus[s] }))]} />
      </div>
      <DataTable
        rows={data?.data}
        loading={isLoading}
        empty="No subscribers yet."
        columns={[
          { key: 'email', header: 'Email', cell: (r) => <span className="font-medium">{r.email}</span> },
          { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          { key: 'consent', header: 'Consent', hideOnMobile: true, cell: (r) => <span className="text-muted-foreground">{formatDate(r.consentAt)}</span> },
          { key: 'source', header: 'Source', hideOnMobile: true, cell: (r) => r.source ?? '—' },
          {
            key: 'actions',
            header: <span className="sr-only">Actions</span>,
            className: 'w-px text-right',
            cell: (r) =>
              manage && (
                <div className="flex justify-end gap-1">
                  {r.status !== 'UNSUBSCRIBED' && (
                    <Button size="sm" variant="ghost" aria-label={`Unsubscribe ${r.email}`} onClick={() => unsubscribe.mutate(r.id)}>
                      <UserMinus />
                    </Button>
                  )}
                  <ConfirmDialog title="Delete subscriber?" description={`${r.email} and their consent record will be removed.`} confirmLabel="Delete" onConfirm={() => remove.mutateAsync(r.id)} trigger={<Button size="sm" variant="ghost" aria-label={`Delete ${r.email}`}><Trash2 /></Button>} />
                </div>
              ),
          },
        ]}
      />
      <PaginationBar meta={data?.meta} onPage={setPage} />
    </RequirePermission>
  );
}
