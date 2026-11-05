'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { formatFileSize } from '@asva/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/overlays';
import { api, apiPaged, ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { SearchInput, useDebounced } from './ui';

export interface MediaItem {
  id: string;
  url: string | null;
  originalName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  caption: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useMediaUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, altText }: { file: File; altText?: string }) => {
      const body = new FormData();
      body.append('file', file);
      if (altText) body.append('altText', altText);
      return api<MediaItem>('/admin/media', { method: 'POST', body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['media'] });
      toast.success('File uploaded');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Upload failed'),
  });
}

export function MediaGrid({ type, onPick, selectedId }: { type: 'image' | 'all'; onPick: (m: MediaItem) => void; selectedId?: string | null }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const input = useRef<HTMLInputElement>(null);
  const upload = useMediaUpload();
  const { data, isLoading } = useQuery({
    queryKey: ['media', { type, search, page }],
    queryFn: () => apiPaged<MediaItem>('/admin/media', { query: { type, q: search, page, pageSize: 24 } }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search by name or alt text" />
        <input
          ref={input}
          type="file"
          hidden
          accept={type === 'image' ? 'image/jpeg,image/png,image/webp,image/avif,image/gif' : undefined}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const m = await upload.mutateAsync({ file });
            onPick(m);
          }}
        />
        <Button type="button" variant="outline" onClick={() => input.current?.click()} loading={upload.isPending}>
          <Upload /> Upload {type === 'image' ? 'image' : 'file'}
        </Button>
      </div>
      {isLoading ? (
        <div className="grid h-48 place-items-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : data?.data.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {data.data.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onPick(m)}
                className={cn('group block w-full overflow-hidden rounded-lg border text-left transition hover:ring-2 hover:ring-primary/40', selectedId === m.id && 'ring-2 ring-primary')}
                aria-label={`Select ${m.originalName}`}
              >
                <div className="aspect-square bg-muted">
                  {m.mimeType.startsWith('image/') && m.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={m.altText ?? ''} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="grid h-full place-items-center">
                      <FileText className="size-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <p className="truncate px-2 py-1.5 text-xs">{m.originalName}</p>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">No files yet. Upload one to get started.</p>
      )}
      {data && data.meta.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export function MediaPickerDialog({ open, onOpenChange, onPick, type = 'image' }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (m: MediaItem) => void; type?: 'image' | 'all' }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide>
        <DialogHeader title="Media library" description="Choose an existing file or upload a new one. Remember to add alt text for accessibility." />
        <MediaGrid
          type={type}
          onPick={(m) => {
            onPick(m);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Form control storing a media id, with preview, change and remove actions. */
export function MediaField({ value, onChange, id }: { value: string | null | undefined; onChange: (id: string | null) => void; id?: string }) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ['media-item', value], queryFn: () => api<MediaItem>(`/admin/media/${value}`), enabled: Boolean(value) });
  return (
    <div id={id} className="flex items-center gap-4 rounded-lg border border-dashed p-3">
      <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
        {value && data?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.url} alt={data.altText ?? ''} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1 text-sm">
        {value ? (
          <>
            <p className="truncate font-medium">{data?.originalName ?? 'Loading…'}</p>
            {data && !data.altText && <p className="text-xs text-warning">No alt text — add it in the media library.</p>}
            {data && data.width && <p className="text-xs text-muted-foreground">{data.width}×{data.height} · {formatFileSize(data.size)}</p>}
          </>
        ) : (
          <p className="text-muted-foreground">No image selected</p>
        )}
        <div className="mt-2 flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            {value ? 'Change' : 'Choose image'}
          </Button>
          {value && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
              <X /> Remove
            </Button>
          )}
        </div>
      </div>
      <MediaPickerDialog open={open} onOpenChange={setOpen} onPick={(m) => onChange(m.id)} />
    </div>
  );
}
