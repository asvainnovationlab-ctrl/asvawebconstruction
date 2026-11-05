'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowDownUp, Download } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { LABELS, LEAD_STATUSES, PERMISSIONS } from '@asva/shared';
import { RequirePermission, useAuth } from '@/components/admin/auth';
import { DataTable, FilterSelect, PageHeader, PaginationBar, SearchInput, StatusBadge, useDebounced } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { api, apiPaged, downloadFile } from '@/lib/api/client';
import { cn, formatDateTime } from '@/lib/utils';

function InquiriesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useAuth();
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [assignee, setAssignee] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const search = useDebounced(q);
  const query = { page, pageSize: 25, q: search, status, assignedToId: assignee, from, to, order };
  const { data, isLoading } = useQuery({ queryKey: ['/admin/inquiries', query], queryFn: () => apiPaged<any>('/admin/inquiries', { query }), placeholderData: keepPreviousData });
  const { data: users } = useQuery({ queryKey: ['assignable'], queryFn: () => api<{ id: string; name: string }[]>('/admin/users/assignable') });
  const counts = (data?.meta.statusCounts ?? {}) as Record<string, number>;

  return (
    <RequirePermission permission={PERMISSIONS.INQUIRIES_READ}>
      <PageHeader
        title="Project inquiries"
        description="Leads from the Start a Project form. Archived leads are hidden unless you filter for them."
        actions={
          can(PERMISSIONS.INQUIRIES_EXPORT) && (
            <Button
              variant="outline"
              loading={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await downloadFile('/admin/inquiries/export', { q: search, status, assignedToId: assignee, from, to }, 'inquiries.csv');
                  toast.success('Export downloaded. The export has been recorded in the audit log.');
                } catch {
                  toast.error('Export failed');
                } finally {
                  setExporting(false);
                }
              }}
            >
              <Download /> Export CSV
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Lead status">
        {[{ value: '', label: 'Active' }, ...LEAD_STATUSES.map((s) => ({ value: s, label: LABELS.leadStatus[s] }))].map((s) => (
          <button
            key={s.value || 'all'}
            type="button"
            role="tab"
            aria-selected={status === s.value}
            onClick={() => { setStatus(s.value); setPage(1); }}
            className={cn('rounded-full border px-3 py-1 text-xs font-medium', status === s.value ? 'border-foreground bg-foreground text-background' : 'bg-background hover:bg-muted')}
          >
            {s.label}
            {s.value && counts[s.value] !== undefined && <span className="ml-1.5 opacity-60">{counts[s.value]}</span>}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-col flex-wrap gap-3 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name, email, company…" />
        <FilterSelect label="Assignee" value={assignee} onChange={(v) => { setAssignee(v); setPage(1); }} options={[{ value: '', label: 'Anyone' }, { value: 'unassigned', label: 'Unassigned' }, ...(users ?? []).map((u) => ({ value: u.id, label: u.name }))]} />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          From <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-9 w-auto" />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          To <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-9 w-auto" />
        </label>
      </div>
      <DataTable
        rows={data?.data}
        loading={isLoading}
        onRowClick={(r) => router.push(`/admin/inquiries/${r.id}`)}
        rowHref={(r) => `/admin/inquiries/${r.id}`}
        empty="No inquiries match these filters."
        columns={[
          { key: 'name', header: 'Contact', cell: (r) => (<div><p className="font-medium">{r.fullName}</p><p className="text-xs text-muted-foreground">{r.email}</p></div>) },
          { key: 'company', header: 'Company', hideOnMobile: true, cell: (r) => r.companyName ?? '—' },
          { key: 'type', header: 'Project', hideOnMobile: true, cell: (r) => (<div><p>{r.projectType}</p><p className="text-xs text-muted-foreground">{r.budgetRange} · {r.timeline}</p></div>) },
          { key: 'status', header: 'Status', cell: (r) => <StatusBadge status={r.status} /> },
          { key: 'assignee', header: 'Assigned', hideOnMobile: true, cell: (r) => r.assignedTo?.name ?? <span className="text-muted-foreground">—</span> },
          {
            key: 'date',
            header: (
              <button type="button" className="inline-flex items-center gap-1 uppercase" onClick={() => setOrder(order === 'desc' ? 'asc' : 'desc')} aria-label={`Sort by date ${order === 'desc' ? 'oldest first' : 'newest first'}`}>
                Submitted <ArrowDownUp className="size-3" />
              </button>
            ),
            cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt)}</span>,
          },
        ]}
      />
      <PaginationBar meta={data?.meta} onPage={setPage} />
    </RequirePermission>
  );
}

export default function InquiriesPage() {
  return (
    <Suspense>
      <InquiriesInner />
    </Suspense>
  );
}
