'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, Paperclip, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { toast } from 'sonner';
import { formatFileSize, LABELS, PERMISSIONS, type LeadStatus } from '@asva/shared';
import { RequirePermission, useAuth } from '@/components/admin/auth';
import { StatusBadge } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Label, NativeSelect, Textarea } from '@/components/ui/form-controls';
import { ConfirmDialog } from '@/components/ui/overlays';
import { Alert, Card, Skeleton } from '@/components/ui/primitives';
import { api, ApiError, downloadFile } from '@/lib/api/client';
import { formatDateTime, relativeTime } from '@/lib/utils';

const ACTIVITY_TEXT: Record<string, (a: any) => string> = {
  CREATED: () => 'Inquiry submitted',
  STATUS_CHANGED: (a) => `Status changed from ${LABELS.leadStatus[a.fromValue as LeadStatus] ?? a.fromValue} to ${LABELS.leadStatus[a.toValue as LeadStatus] ?? a.toValue}`,
  ASSIGNED: (a) => (a.toValue ? 'Lead assigned' : 'Lead unassigned'),
  NOTE_ADDED: () => 'Internal note added',
  EXPORTED: () => 'Included in an export',
};

export default function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [note, setNote] = useState('');
  const key = ['/admin/inquiries', id];
  const { data: inquiry, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api<any>(`/admin/inquiries/${id}`) });
  const { data: users } = useQuery({ queryKey: ['assignable'], queryFn: () => api<{ id: string; name: string }[]>('/admin/users/assignable') });
  const canEdit = can(PERMISSIONS.INQUIRIES_UPDATE);

  const update = useMutation({
    mutationFn: (body: { status?: string; assignedToId?: string | null }) => api<any>(`/admin/inquiries/${id}`, { method: 'PATCH', body }),
    onSuccess: (d) => {
      qc.setQueryData(key, d);
      void qc.invalidateQueries({ queryKey: ['/admin/inquiries'] });
      toast.success('Lead updated');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
  });
  const addNote = useMutation({
    mutationFn: () => api<any>(`/admin/inquiries/${id}/notes`, { method: 'POST', body: { body: note } }),
    onSuccess: (d) => {
      qc.setQueryData(key, d);
      setNote('');
      toast.success('Note added');
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/admin/inquiries/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Inquiry deleted');
      void qc.invalidateQueries({ queryKey: ['/admin/inquiries'] });
      router.replace('/admin/inquiries');
    },
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error || !inquiry) return <Alert variant="error">{error instanceof ApiError ? error.message : 'Inquiry not found.'}</Alert>;

  const rows: [string, React.ReactNode][] = [
    ['Email', <a key="e" href={`mailto:${inquiry.email}`} className="text-primary hover:underline">{inquiry.email}</a>],
    ['Phone', <a key="p" href={`tel:${inquiry.phone.replace(/[^+\d]/g, '')}`} className="text-primary hover:underline">{inquiry.phone}</a>],
    ['Company', inquiry.companyName ?? '—'],
    ['Project type', inquiry.projectType],
    ['Budget', inquiry.budgetRange],
    ['Timeline', inquiry.timeline],
    ['Preferred contact', LABELS.preferredContact[inquiry.preferredContact as keyof typeof LABELS.preferredContact]],
    ['Existing product', inquiry.hasExistingProduct ? (inquiry.existingUrl ? <a key="u" href={inquiry.existingUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{inquiry.existingUrl}</a> : 'Yes') : 'No'],
    ['Consent recorded', formatDateTime(inquiry.consentAt)],
  ];

  return (
    <RequirePermission permission={PERMISSIONS.INQUIRIES_READ}>
      <Link href="/admin/inquiries" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All inquiries
      </Link>
      <div className="mb-6 mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{inquiry.fullName}</h1>
          <p className="text-sm text-muted-foreground">Submitted {formatDateTime(inquiry.createdAt)}</p>
        </div>
        <StatusBadge status={inquiry.status} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="font-semibold">Project description</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{inquiry.description}</p>
            {inquiry.attachment && (
              <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <Paperclip className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{inquiry.attachment.originalName}</span>
                  <span className="text-muted-foreground">{formatFileSize(inquiry.attachment.size)}</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => downloadFile(`/admin/inquiries/${id}/attachment`, undefined, inquiry.attachment.originalName).catch(() => toast.error('Download failed'))}>
                  <Download /> Download
                </Button>
              </div>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Details</h2>
            <dl className="mt-3 divide-y text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-3 py-2.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="col-span-2 break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Internal notes</h2>
            <p className="text-xs text-muted-foreground">Visible to staff only. Never shown to the client.</p>
            {canEdit && (
              <form
                className="mt-4 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (note.trim()) addNote.mutate();
                }}
              >
                <Label htmlFor="note" className="sr-only">
                  New note
                </Label>
                <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note about calls, meetings, next steps…" />
                <Button type="submit" size="sm" loading={addNote.isPending} disabled={!note.trim()}>
                  Add note
                </Button>
              </form>
            )}
            <ul className="mt-4 space-y-3">
              {inquiry.notes.map((n: any) => (
                <li key={n.id} className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {n.author?.name ?? 'Former user'} · {formatDateTime(n.createdAt)}
                  </p>
                </li>
              ))}
              {inquiry.notes.length === 0 && <li className="text-sm text-muted-foreground">No notes yet.</li>}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <h2 className="font-semibold">Manage lead</h2>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <NativeSelect id="status" value={inquiry.status} disabled={!canEdit || update.isPending} onChange={(e) => update.mutate({ status: e.target.value })}>
                <option value={inquiry.status}>{LABELS.leadStatus[inquiry.status as LeadStatus]} (current)</option>
                {inquiry.allowedTransitions.map((s: LeadStatus) => (
                  <option key={s} value={s}>
                    {LABELS.leadStatus[s]}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">Only valid next steps in the pipeline are offered.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assignee">Assigned to</Label>
              <NativeSelect id="assignee" value={inquiry.assignedTo?.id ?? ''} disabled={!canEdit || update.isPending} onChange={(e) => update.mutate({ assignedToId: e.target.value || null })}>
                <option value="">Unassigned</option>
                {(users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Activity</h2>
            <ol className="mt-3 space-y-3 border-l pl-4">
              {inquiry.activities.map((a: any) => (
                <li key={a.id} className="relative text-sm">
                  <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-primary" aria-hidden />
                  <p>{ACTIVITY_TEXT[a.type]?.(a) ?? a.type}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.actor?.name ?? 'Website'} · {relativeTime(a.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
          {can(PERMISSIONS.INQUIRIES_DELETE) && (
            <Card className="border-red-200 p-5">
              <h2 className="font-semibold text-destructive">Delete permanently</h2>
              <p className="mt-1 text-xs text-muted-foreground">Prefer archiving. Deletion removes the lead, notes, history and attachment and cannot be undone.</p>
              <ConfirmDialog
                title="Delete this inquiry?"
                description="All notes, activity and the attachment will be permanently removed."
                confirmLabel="Delete"
                onConfirm={() => remove.mutateAsync()}
                trigger={
                  <Button variant="outline" className="mt-3 w-full text-destructive">
                    <Trash2 /> Delete inquiry
                  </Button>
                }
              />
            </Card>
          )}
        </div>
      </div>
    </RequirePermission>
  );
}
