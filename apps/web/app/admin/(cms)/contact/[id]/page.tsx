'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, ArrowLeft, Mail, MailOpen, Reply, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useRef, useState } from 'react';

/** Notes editor; remounted (via key) when the saved submission changes. */
function NotesCard({ initial, canUpdate, saving, onSave }: { initial: string; canUpdate: boolean; saving: boolean; onSave: (notes: string) => void }) {
  const [notes, setNotes] = useState(initial);
  return (
    <Card className="space-y-2 p-5">
      <Label htmlFor="notes">Internal notes</Label>
      <Textarea id="notes" rows={5} value={notes} disabled={!canUpdate} onChange={(e) => setNotes(e.target.value)} />
      {canUpdate && (
        <Button size="sm" disabled={notes === initial} loading={saving} onClick={() => onSave(notes)}>
          Save notes
        </Button>
      )}
    </Card>
  );
}
import { toast } from 'sonner';
import { PERMISSIONS } from '@asva/shared';
import { RequirePermission, useAuth } from '@/components/admin/auth';
import { Button } from '@/components/ui/button';
import { Label, Textarea } from '@/components/ui/form-controls';
import { ConfirmDialog } from '@/components/ui/overlays';
import { Alert, Card, Skeleton } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/api/client';
import { formatDateTime } from '@/lib/utils';

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAuth();
  const key = ['/admin/contact-submissions', id];
  const { data: item, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api<any>(`/admin/contact-submissions/${id}`) });
  const markedRead = useRef(false);
  const update = useMutation({
    mutationFn: (body: any) => api<any>(`/admin/contact-submissions/${id}`, { method: 'PATCH', body }),
    onSuccess: (d) => {
      qc.setQueryData(key, d);
      void qc.invalidateQueries({ queryKey: ['/admin/contact-submissions'], exact: false });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/admin/contact-submissions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Deleted');
      router.replace('/admin/contact');
    },
  });

  useEffect(() => {
    if (!item) return;
    // Opening an unread message marks it as read (for users allowed to update).
    if (!item.isRead && !markedRead.current && can(PERMISSIONS.CONTACT_UPDATE)) {
      markedRead.current = true;
      update.mutate({ isRead: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (isLoading) return <Skeleton className="h-96" />;
  if (error || !item) return <Alert variant="error">{error instanceof ApiError ? error.message : 'Not found'}</Alert>;
  const canUpdate = can(PERMISSIONS.CONTACT_UPDATE);

  return (
    <RequirePermission permission={PERMISSIONS.CONTACT_READ}>
      <Link href="/admin/contact" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Inbox
      </Link>
      <div className="mb-6 mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{item.subject ?? 'Contact message'}</h1>
          <p className="text-sm text-muted-foreground">Received {formatDateTime(item.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={`mailto:${item.email}?subject=${encodeURIComponent(`Re: ${item.subject ?? 'Your message'}`)}`}>
              <Reply /> Reply by email
            </a>
          </Button>
          {canUpdate && (
            <>
              <Button variant="outline" onClick={() => update.mutate({ isRead: !item.isRead })}>
                {item.isRead ? <Mail /> : <MailOpen />} Mark {item.isRead ? 'unread' : 'read'}
              </Button>
              <Button variant="outline" onClick={() => update.mutate({ isArchived: !item.isArchived }, { onSuccess: () => toast.success(item.isArchived ? 'Restored' : 'Archived') })}>
                {item.isArchived ? <ArchiveRestore /> : <Archive />} {item.isArchived ? 'Restore' : 'Archive'}
              </Button>
            </>
          )}
          {can(PERMISSIONS.CONTACT_DELETE) && (
            <ConfirmDialog title="Delete this message?" description="It will be permanently removed." confirmLabel="Delete" onConfirm={() => remove.mutateAsync()} trigger={<Button variant="outline" className="text-destructive"><Trash2 /> Delete</Button>} />
          )}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="p-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.message}</p>
        </Card>
        <div className="space-y-6">
          <Card className="p-5 text-sm">
            <dl className="space-y-3">
              <div><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{item.name}</dd></div>
              <div><dt className="text-muted-foreground">Email</dt><dd><a href={`mailto:${item.email}`} className="text-primary hover:underline">{item.email}</a></dd></div>
              {item.phone && <div><dt className="text-muted-foreground">Phone</dt><dd>{item.phone}</dd></div>}
              {item.company && <div><dt className="text-muted-foreground">Company</dt><dd>{item.company}</dd></div>}
              <div><dt className="text-muted-foreground">Consent</dt><dd>{formatDateTime(item.consentAt)}</dd></div>
            </dl>
          </Card>
          <NotesCard
            key={item.updatedAt}
            initial={item.internalNotes ?? ''}
            canUpdate={canUpdate}
            saving={update.isPending}
            onSave={(notes) => update.mutate({ internalNotes: notes }, { onSuccess: () => toast.success('Notes saved') })}
          />
        </div>
      </div>
    </RequirePermission>
  );
}
