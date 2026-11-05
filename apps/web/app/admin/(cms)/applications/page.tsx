'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { APPLICATION_STATUSES, LABELS, PERMISSIONS } from '@asva/shared';
import { RequirePermission } from '@/components/admin/auth';
import { DataTable, FilterSelect, PageHeader, PaginationBar, SearchInput, StatusBadge, useDebounced } from '@/components/admin/ui';
import { apiPaged } from '@/lib/api/client';
import { formatDateTime } from '@/lib/utils';

function ApplicationsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [jobId, setJobId] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const query = { status, jobId, q: search, page, pageSize: 25 };
  const { data, isLoading } = useQuery({ queryKey: ['/admin/applications', query], queryFn: () => apiPaged<any>('/admin/applications', { query }), placeholderData: keepPreviousData });
  const { data: jobs } = useQuery({ queryKey: ['/admin/jobs', 'options'], queryFn: () => apiPaged<any>('/admin/jobs', { query: { pageSize: 100 } }) });

  return (
    <RequirePermission permission={PERMISSIONS.APPLICATIONS_READ}>
      <PageHeader title="Applications" description="Candidate data is confidential. Resume downloads are recorded in the audit log." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name, email, phone" />
        <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: '', label: 'All statuses' }, ...APPLICATION_STATUSES.map((s) => ({ value: s, label: LABELS.applicationStatus[s] }))]} />
        <FilterSelect label="Vacancy" value={jobId} onChange={(v) => { setJobId(v); setPage(1); }} options={[{ value: '', label: 'All vacancies' }, { value: 'general', label: 'General applications' }, ...(jobs?.data ?? []).map((j: any) => ({ value: j.id, label: j.title }))]} />
      </div>
      <DataTable
        rows={data?.data}
        loading={isLoading}
        onRowClick={(r) => router.push(`/admin/applications/${r.id}`)}
        rowHref={(r) => `/admin/applications/${r.id}`}
        empty="No applications match these filters."
        columns={[
          { key: 'name', header: 'Candidate', cell: (r) => (<div><p className="font-medium">{r.fullName}</p><p className="text-xs text-muted-foreground">{r.email}</p></div>) },
          { key: 'job', header: 'Position', cell: (r) => r.job?.title ?? <span className="text-muted-foreground">General application</span> },
          { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          { key: 'date', header: 'Applied', hideOnMobile: true, cell: (r) => <span className="text-muted-foreground">{formatDateTime(r.createdAt)}</span> },
        ]}
      />
      <PaginationBar meta={data?.meta} onPage={setPage} />
    </RequirePermission>
  );
}

export default function ApplicationsPage() {
  return (
    <Suspense>
      <ApplicationsInner />
    </Suspense>
  );
}
