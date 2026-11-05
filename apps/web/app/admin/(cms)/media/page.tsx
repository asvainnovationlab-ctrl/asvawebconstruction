'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { formatFileSize, PERMISSIONS } from '@asva/shared';
import { RequirePermission } from '@/components/admin/auth';
import { MediaGrid, type MediaItem } from '@/components/admin/media-picker';
import { FilterSelect, PageHeader } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form-controls';
import { ConfirmDialog, Dialog, DialogContent, DialogHeader } from '@/components/ui/overlays';
import { Alert } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/api/client';
import { formatDateTime } from '@/lib/utils';

/** Editable metadata; remounted (via key) after each save or replacement. */
function DetailsForm({ data, isImage, saving, onSave }: { data: MediaItem; isImage: boolean; saving: boolean; onSave: (body: { altText: string; caption: string; originalName: string }) => void }) {
  const [alt, setAlt] = useState(data.altText ?? '');
  const [caption, setCaption] = useState(data.caption ?? '');
  const [name, setName] = useState(data.originalName);
  return (
    <>
      <Field id="m-name" label="File name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      {isImage && <Field id="m-alt" label="Alt text" hint="Describe the image for screen readers and search engines."><Input value={alt} onChange={(e) => setAlt(e.target.value)} /></Field>}
      <Field id="m-caption" label="Caption"><Textarea rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} /></Field>
      <Button onClick={() => onSave({ altText: alt, caption, originalName: name })} loading={saving}>Save details</Button>
    </>
  );
}

function MediaDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['media-item', id], queryFn: () => api<MediaItem & { usage: { type: string; id: string; label: string }[]; uploadedBy: { name: string } | null }>(`/admin/media/${id}`) });
  const replaceInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['media'] });
    void qc.invalidateQueries({ queryKey: ['media-item', id] });
  };
  const save = useMutation({ mutationFn: (body: { altText: string; caption: string; originalName: string }) => api(`/admin/media/${id}`, { method: 'PATCH', body }), onSuccess: () => { toast.success('Saved'); refresh(); } });
  const replace = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append('file', file);
      return api(`/admin/media/${id}/replace`, { method: 'POST', body });
    },
    onSuccess: () => { toast.success('File replaced everywhere it is used'); refresh(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Replace failed'),
  });
  const remove = useMutation({
    mutationFn: () => api(`/admin/media/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Deleted'); refresh(); onClose(); },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'Delete failed'),
  });
  if (!data) return <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>;
  const isImage = data.mimeType.startsWith('image/');
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-3">
        <div className="grid aspect-video place-items-center overflow-hidden rounded-lg border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {isImage && data.url ? <img src={data.url} alt={data.altText ?? ''} className="max-h-full object-contain" /> : <FileText className="size-12 text-muted-foreground" />}
        </div>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <dt className="text-muted-foreground">Type</dt><dd>{data.mimeType}</dd>
          <dt className="text-muted-foreground">Size</dt><dd>{formatFileSize(data.size)}</dd>
          {data.width && (<><dt className="text-muted-foreground">Dimensions</dt><dd>{data.width}×{data.height}</dd></>)}
          <dt className="text-muted-foreground">Uploaded</dt><dd>{formatDateTime(data.createdAt)}{data.uploadedBy ? ` by ${data.uploadedBy.name}` : ''}</dd>
        </dl>
        {data.url && (
          <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(new URL(data.url!, window.location.origin).toString()).then(() => toast.success('URL copied'))}>
            <Copy /> Copy URL
          </Button>
        )}
      </div>
      <div className="space-y-4">
        <DetailsForm key={data.updatedAt} data={data} isImage={isImage} saving={save.isPending} onSave={(body) => save.mutate(body)} />
        <div className="flex flex-wrap gap-2">
          <input ref={replaceInput} type="file" hidden accept={isImage ? 'image/jpeg,image/png,image/webp,image/avif,image/gif' : undefined} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) replace.mutate(f); }} />
          <Button variant="outline" onClick={() => replaceInput.current?.click()} loading={replace.isPending}><RefreshCw /> Replace file</Button>
        </div>
        <div>
          <p className="text-sm font-medium">Used in</p>
          {data.usage.length ? (
            <ul className="mt-1 space-y-1 text-sm">{data.usage.map((u) => <li key={`${u.type}-${u.id}`} className="text-muted-foreground">{u.type}: {u.label}</li>)}</ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Not used anywhere.</p>
          )}
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <ConfirmDialog
          title="Delete this file?"
          description={data.usage.length ? 'This file is in use and cannot be deleted until it is removed from those items.' : 'The file will be permanently removed from storage.'}
          confirmLabel="Delete"
          onConfirm={() => remove.mutateAsync().catch(() => undefined)}
          trigger={<Button variant="outline" className="text-destructive" disabled={data.usage.length > 0}><Trash2 /> Delete</Button>}
        />
      </div>
    </div>
  );
}

export default function MediaLibraryPage() {
  const [type, setType] = useState<'all' | 'image'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <RequirePermission permission={PERMISSIONS.MEDIA_MANAGE}>
      <PageHeader title="Media library" description="Images (JPG, PNG, WebP, AVIF, GIF) and documents (PDF, Word, Excel, PowerPoint). Files are checked by content, and image metadata such as GPS location is removed." actions={<FilterSelect label="Type" value={type} onChange={(v) => setType(v as 'all' | 'image')} options={[{ value: 'all', label: 'All files' }, { value: 'image', label: 'Images' }]} />} />
      <div className="rounded-xl border bg-background p-4">
        <MediaGrid type={type} onPick={(m) => setSelected(m.id)} />
      </div>
      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent wide>
          <DialogHeader title="File details" />
          {selected && <MediaDetails id={selected} onClose={() => setSelected(null)} />}
        </DialogContent>
      </Dialog>
    </RequirePermission>
  );
}
