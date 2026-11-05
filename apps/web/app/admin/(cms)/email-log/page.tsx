'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { EMAIL_STATUSES, LABELS, PERMISSIONS } from '@asva/shared';
import { RequirePermission } from '@/components/admin/auth';
import { DataTable, FilterSelect, PageHeader, PaginationBar, SearchInput, StatusBadge, useDebounced } from '@/components/admin/ui';
import { Alert } from '@/components/ui/primitives';
import { apiPaged } from '@/lib/api/client';
import { formatDateTime } from '@/lib/utils';

export default function EmailLogPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const query = { q: search, status, page, pageSize: 50 };
  const { data, isLoading } = useQuery({ queryKey: ['/admin/email-messages', query], queryFn: () => apiPaged<any>('/admin/email-messages', { query }), placeholderData: keepPreviousData });
  const skipped = data?.data.some((m) => m.status === 'SKIPPED');
  return (
    <RequirePermission permission={PERMISSIONS.EMAIL_READ}>
      <PageHeader title="Email log" description="Every notification the system attempted to send. Failed messages are retried up to five times." />
      {skipped && <Alert variant="warning" className="mb-4">Some emails were skipped because SMTP is not configured on the API server. Set SMTP_HOST and EMAIL_FROM to enable delivery.</Alert>}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search recipient or subject" />
        <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: '', label: 'All statuses' }, ...EMAIL_STATUSES.map((s) => ({ value: s, label: LABELS.emailStatus[s] }))]} />
      </div>
      <DataTable
        rows={data?.data}
        loading={isLoading}
        columns={[
          { key: 'when', header: 'Queued', cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt)}</span> },
          { key: 'to', header: 'Recipient', cell: (r) => r.toAddress },
          { key: 'subject', header: 'Subject', hideOnMobile: true, cell: (r) => (<div><p className="max-w-sm truncate">{r.subject}</p><p className="text-xs text-muted-foreground">{r.category}</p></div>) },
          { key: 'status', header: 'Status', cell: (r) => (<div><StatusBadge status={r.status} />{r.lastError && r.status !== 'SKIPPED' && <p className="mt-1 max-w-xs truncate text-xs text-destructive" title={r.lastError}>{r.lastError}</p>}</div>) },
          { key: 'attempts', header: 'Attempts', hideOnMobile: true, cell: (r) => r.attempts },
        ]}
      />
      <PaginationBar meta={data?.meta} onPage={setPage} />
    </RequirePermission>
  );
}
