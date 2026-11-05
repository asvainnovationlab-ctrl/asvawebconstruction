'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Download, FileText, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { toast } from 'sonner';
import { formatFileSize, LABELS, PERMISSIONS, type ApplicationStatus } from '@asva/shared';
import { RequirePermission, useAuth } from '@/components/admin/auth';
import { StatusBadge } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Checkbox, Label, NativeSelect, Textarea } from '@/components/ui/form-controls';
import { ConfirmDialog } from '@/components/ui/overlays';
import { Alert, Card, Skeleton } from '@/components/ui/primitives';
import { api, ApiError, downloadFile } from '@/lib/api/client';
import { formatDateTime } from '@/lib/utils';

/** Review form; remounted (via key) whenever the saved application changes. */
function ReviewCard({ app, canEdit, onSaved }: { app: any; canEdit: boolean; onSaved: (updated: any) => void }) {
  const [status, setStatus] = useState<string>(app.status);
  const [notify, setNotify] = useState(false);
  const [notes, setNotes] = useState<string>(app.internalNotes ?? '');
  const notifiable = app.notifiableStatuses.includes(status) && status !== app.status;
  const update = useMutation({
    mutationFn: (body: any) => api<any>(`/admin/applications/${app.id}`, { method: 'PATCH', body }),
    onSuccess: (d, vars) => {
      toast.success(vars.status && vars.notifyApplicant ? 'Status updated — the applicant will be emailed (if email is configured).' : 'Application updated');
      onSaved(d);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
  });
  return (
    <Card className="space-y-4 p-5">
      <h2 className="font-semibold">Review</h2>
      <div className="space-y-1.5">
        <Label htmlFor="app-status">Status</Label>
        <NativeSelect id="app-status" value={status} disabled={!canEdit} onChange={(e) => setStatus(e.target.value)}>
          <option value={app.status}>{LABELS.applicationStatus[app.status as ApplicationStatus]} (current)</option>
          {app.allowedTransitions.map((s: ApplicationStatus) => (
            <option key={s} value={s}>
              {LABELS.applicationStatus[s]}
            </option>
          ))}
        </NativeSelect>
      </div>
      {notifiable && (
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} className="mt-0.5" />
          <span>Email the applicant about this status change</span>
        </label>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="app-notes">Internal notes</Label>
        <Textarea id="app-notes" rows={5} value={notes} disabled={!canEdit} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {canEdit && (
        <Button
          className="w-full"
          loading={update.isPending}
          disabled={status === app.status && notes === (app.internalNotes ?? '')}
          onClick={() => update.mutate({ ...(status !== app.status ? { status, notifyApplicant: notify } : {}), internalNotes: notes })}
        >
          Save changes
        </Button>
      )}
    </Card>
  );
}

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAuth();
  const key = ['/admin/applications', id];
  const { data: app, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api<any>(`/admin/applications/${id}`) });
  const remove = useMutation({
    mutationFn: () => api(`/admin/applications/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Application deleted');
      router.replace('/admin/applications');
    },
  });

  if (isLoading) return <Skeleton className="h-96" />;
  if (error || !app) return <Alert variant="error">{error instanceof ApiError ? error.message : 'Not found'}</Alert>;

  return (
    <RequirePermission permission={PERMISSIONS.APPLICATIONS_READ}>
      <Link href="/admin/applications" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All applications
      </Link>
      <div className="mb-6 mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{app.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {app.job?.title ?? 'General application'} · applied {formatDateTime(app.createdAt)}
          </p>
        </div>
        <StatusBadge status={app.status} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card className="p-5 text-sm">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Email</dt><dd><a className="text-primary hover:underline" href={`mailto:${app.email}`}>{app.email}</a></dd></div>
              <div><dt className="text-muted-foreground">Phone</dt><dd>{app.phone}</dd></div>
              {app.linkedinUrl && <div><dt className="text-muted-foreground">LinkedIn</dt><dd><a className="text-primary hover:underline" href={app.linkedinUrl} target="_blank" rel="noopener noreferrer">{app.linkedinUrl}</a></dd></div>}
              {app.portfolioUrl && <div><dt className="text-muted-foreground">Portfolio</dt><dd><a className="text-primary hover:underline" href={app.portfolioUrl} target="_blank" rel="noopener noreferrer">{app.portfolioUrl}</a></dd></div>}
              <div><dt className="text-muted-foreground">Consent recorded</dt><dd>{formatDateTime(app.consentAt)}</dd></div>
            </dl>
          </Card>
          {app.resume && (
            <Card className="flex items-center justify-between gap-3 p-5">
              <span className="flex min-w-0 items-center gap-3 text-sm">
                <FileText className="size-8 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{app.resume.originalName}</span>
                  <span className="text-xs text-muted-foreground">{formatFileSize(app.resume.size)}</span>
                </span>
              </span>
              {can(PERMISSIONS.APPLICATIONS_RESUME) ? (
                <Button variant="outline" onClick={() => downloadFile(`/admin/applications/${id}/resume`, undefined, app.resume.originalName).catch(() => toast.error('Download failed'))}>
                  <Download /> Download CV
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">No permission to download</span>
              )}
            </Card>
          )}
          <Card className="p-5">
            <h2 className="font-semibold">Cover letter</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{app.coverLetter || <span className="text-muted-foreground">No cover letter provided.</span>}</p>
          </Card>
        </div>
        <div className="space-y-6">
          <ReviewCard
            key={app.updatedAt}
            app={app}
            canEdit={can(PERMISSIONS.APPLICATIONS_UPDATE)}
            onSaved={(d) => {
              qc.setQueryData(key, d);
              void qc.invalidateQueries({ queryKey: ['/admin/applications'], exact: false });
            }}
          />
          {can(PERMISSIONS.APPLICATIONS_DELETE) && (
            <Card className="border-red-200 p-5">
              <h2 className="font-semibold text-destructive">Delete application</h2>
              <p className="mt-1 text-xs text-muted-foreground">Removes the application and the stored resume permanently.</p>
              <ConfirmDialog title="Delete this application?" description="The candidate’s data and CV will be permanently deleted." confirmLabel="Delete" onConfirm={() => remove.mutateAsync()} trigger={<Button variant="outline" className="mt-3 w-full text-destructive"><Trash2 /> Delete</Button>} />
            </Card>
          )}
        </div>
      </div>
    </RequirePermission>
  );
}
