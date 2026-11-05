'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, ExternalLink, History, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import type { ZodType } from 'zod';
import type { PermissionKey } from '@asva/shared';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogContent, DialogHeader } from '@/components/ui/overlays';
import { Alert, Card, Skeleton } from '@/components/ui/primitives';
import { api, apiPaged, ApiError } from '@/lib/api/client';
import { formatDateTime } from '@/lib/utils';
import { RequirePermission } from './auth';
import { FieldGrid, type FieldDef } from './fields';
import { DataTable, FilterSelect, PageHeader, PaginationBar, SearchInput, useDebounced, useUnsavedChanges, type Column } from './ui';

function applyErrors(form: UseFormReturn<any>, error: unknown): string {
  if (error instanceof ApiError) {
    for (const d of error.details) if (d.path) form.setError(d.path as never, { type: 'server', message: d.message });
    return error.message;
  }
  return 'Could not save. Check your connection and try again.';
}

// ======================================================================= List

export interface ResourceListProps<T extends { id: string }> {
  title: string;
  description?: string;
  permission: PermissionKey;
  endpoint: string;
  columns: Column<T>[];
  createHref?: string;
  createLabel?: string;
  rowHref?: (row: T) => string;
  filters?: { name: string; label: string; options: { value: string; label: string }[] }[];
  canDelete?: (row: T) => boolean;
  deleteLabel?: (row: T) => string;
  pageSize?: number;
  extraActions?: React.ReactNode;
}

export function ResourceList<T extends { id: string }>(props: ResourceListProps<T>) {
  const { title, description, permission, endpoint, columns, createHref, createLabel, rowHref, filters = [], canDelete, deleteLabel, pageSize = 20, extraActions } = props;
  const router = useRouter();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => Object.fromEntries(filters.map((f) => [f.name, f.options[0]?.value ?? ''])));
  const search = useDebounced(q);
  const query = { page, pageSize, q: search, ...filterValues };
  const { data, isLoading, error } = useQuery({ queryKey: [endpoint, query], queryFn: () => apiPaged<T>(endpoint, { query }), placeholderData: keepPreviousData });
  const remove = useMutation({
    mutationFn: (id: string) => api(`${endpoint}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Deleted');
      void qc.invalidateQueries({ queryKey: [endpoint] });
    },
  });

  const allColumns: Column<T>[] = useMemo(
    () => [
      ...columns,
      {
        key: '_actions',
        header: <span className="sr-only">Actions</span>,
        className: 'w-px text-right',
        cell: (row) => (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {rowHref && (
              <Button asChild size="sm" variant="ghost" aria-label="Edit">
                <Link href={rowHref(row)}>
                  <Pencil />
                </Link>
              </Button>
            )}
            {(canDelete ? canDelete(row) : true) && (
              <ConfirmDialog
                title="Delete permanently?"
                description={`“${deleteLabel?.(row) ?? 'This item'}” will be deleted. This cannot be undone.`}
                confirmLabel="Delete"
                onConfirm={() => remove.mutateAsync(row.id)}
                trigger={
                  <Button size="sm" variant="ghost" aria-label="Delete" className="text-muted-foreground hover:text-destructive">
                    <Trash2 />
                  </Button>
                }
              />
            )}
          </div>
        ),
      },
    ],
    [columns, rowHref, canDelete, deleteLabel, remove],
  );

  return (
    <RequirePermission permission={permission}>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {extraActions}
            {createHref && (
              <Button asChild>
                <Link href={createHref}>
                  <Plus /> {createLabel ?? 'Create'}
                </Link>
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} />
        {filters.map((f) => (
          <FilterSelect key={f.name} label={f.label} value={filterValues[f.name] ?? ''} options={f.options} onChange={(v) => { setFilterValues((s) => ({ ...s, [f.name]: v })); setPage(1); }} />
        ))}
      </div>
      {error && <Alert variant="error" className="mb-4">{error instanceof ApiError ? error.message : 'Could not load data.'}</Alert>}
      <DataTable columns={allColumns} rows={data?.data} loading={isLoading} onRowClick={rowHref ? (row) => router.push(rowHref(row)) : undefined} rowHref={rowHref} empty={search ? 'No results match your search.' : 'Nothing here yet.'} />
      <PaginationBar meta={data?.meta} onPage={setPage} />
    </RequirePermission>
  );
}

// ======================================================================= Full-page editor

export interface EditorSection {
  title: string;
  description?: string;
  fields: FieldDef[];
  aside?: boolean;
  columns?: 1 | 2;
}

export interface ResourceEditorProps {
  id: string | 'new';
  singular: string;
  permission: PermissionKey;
  endpoint: string;
  listHref: string;
  schema: ZodType;
  defaults: Record<string, any>;
  sections: EditorSection[];
  toForm?: (record: any) => Record<string, any>;
  titleOf?: (record: any) => string;
  previewHref?: (record: any) => string;
  publicHref?: (record: any) => string | null;
  canDelete?: (record: any) => boolean;
  deleteHint?: string;
  revisions?: boolean;
}

export function ResourceEditor(props: ResourceEditorProps) {
  const { id, singular, permission, endpoint, listHref, schema, defaults, sections, toForm, titleOf, previewHref, publicHref, canDelete, deleteHint, revisions } = props;
  const isNew = id === 'new';
  const router = useRouter();
  const qc = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const { data: record, isLoading, error } = useQuery({ queryKey: [endpoint, id], queryFn: () => api<any>(`${endpoint}/${id}`), enabled: !isNew });
  const form = useForm<any>({ resolver: zodResolver(schema as never), defaultValues: defaults, mode: 'onTouched' });

  useEffect(() => {
    if (record) form.reset({ ...defaults, ...(toForm ? toForm(record) : record) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  useUnsavedChanges(form.formState.isDirty && !form.formState.isSubmitSuccessful);

  const save = useMutation({
    mutationFn: (values: any) => (isNew ? api<any>(endpoint, { method: 'POST', body: values }) : api<any>(`${endpoint}/${id}`, { method: 'PATCH', body: values })),
    onSuccess: (saved) => {
      toast.success(`${singular} saved`);
      setFormError(null);
      qc.setQueryData([endpoint, saved.id], saved);
      void qc.invalidateQueries({ queryKey: [endpoint], exact: false });
      form.reset({ ...defaults, ...(toForm ? toForm(saved) : saved) });
      if (isNew) router.replace(`${listHref}/${saved.id}`);
    },
    onError: (e) => {
      const msg = applyErrors(form, e);
      setFormError(msg);
      toast.error(msg);
    },
  });

  const remove = useMutation({
    mutationFn: () => api(`${endpoint}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(`${singular} deleted`);
      form.reset(form.getValues());
      void qc.invalidateQueries({ queryKey: [endpoint] });
      router.replace(listHref);
    },
  });

  const restore = useMutation({
    mutationFn: (revisionId: string) => api<any>(`${endpoint}/${id}/revisions/${revisionId}/restore`, { method: 'POST' }),
    onSuccess: (saved) => {
      toast.success('Revision restored');
      qc.setQueryData([endpoint, id], saved);
    },
  });

  const onSubmit = form.handleSubmit(
    (values) => save.mutate(values),
    () => {
      setFormError('Please correct the highlighted fields.');
      toast.error('Please correct the highlighted fields.');
    },
  );

  if (!isNew && isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  if (error) return <Alert variant="error">{error instanceof ApiError ? error.message : 'Could not load this item.'}</Alert>;

  const main = sections.filter((s) => !s.aside);
  const aside = sections.filter((s) => s.aside);
  const heading = isNew ? `New ${singular.toLowerCase()}` : (titleOf?.(record) ?? record?.title ?? record?.name ?? singular);
  const publicUrl = record && publicHref ? publicHref(record) : null;

  return (
    <RequirePermission permission={permission}>
      <form onSubmit={onSubmit} noValidate>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Link href={listHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" /> Back
            </Link>
            <h1 className="mt-1 truncate font-display text-2xl font-semibold">{heading}</h1>
            {record?.updatedAt && <p className="text-xs text-muted-foreground">Last saved {formatDateTime(record.updatedAt)}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {!isNew && previewHref && (
              <Button asChild variant="outline">
                <a href={previewHref(record)} target="_blank" rel="noopener noreferrer">
                  <Eye /> Preview
                </a>
              </Button>
            )}
            {publicUrl && (
              <Button asChild variant="outline">
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> View live
                </a>
              </Button>
            )}
            <Button type="submit" loading={save.isPending} disabled={!form.formState.isDirty && !isNew}>
              <Save /> Save
            </Button>
          </div>
        </div>
        {formError && (
          <Alert variant="error" className="mb-4">
            {formError}
          </Alert>
        )}
        {form.formState.isDirty && <p className="mb-4 text-xs font-medium text-warning" role="status">You have unsaved changes.</p>}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-6">
            {main.map((s) => (
              <Card key={s.title} className="p-5 sm:p-6">
                <h2 className="text-base font-semibold">{s.title}</h2>
                {s.description && <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>}
                <div className="mt-5">
                  <FieldGrid fields={s.fields} form={form} columns={s.columns ?? 2} />
                </div>
              </Card>
            ))}
          </div>
          <div className="space-y-6">
            {aside.map((s) => (
              <Card key={s.title} className="p-5">
                <h2 className="text-base font-semibold">{s.title}</h2>
                {s.description && <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>}
                <div className="mt-4">
                  <FieldGrid fields={s.fields} form={form} columns={1} />
                </div>
              </Card>
            ))}

            {revisions && !isNew && record?.revisions?.length > 0 && (
              <Card className="p-5">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <History className="size-4" /> Revision history
                </h2>
                <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm">
                  {record.revisions.map((r: any, i: number) => (
                    <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.note ?? (i === 0 ? 'Current version' : 'Edit')}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(r.createdAt)}
                          {r.createdBy?.name ? ` · ${r.createdBy.name}` : ''}
                        </p>
                      </div>
                      {i > 0 && (
                        <ConfirmDialog
                          title="Restore this revision?"
                          description="The title, excerpt and content will be replaced with this version. A new revision is recorded, so you can undo it."
                          confirmLabel="Restore"
                          destructive={false}
                          onConfirm={() => restore.mutateAsync(r.id)}
                          trigger={
                            <Button type="button" size="sm" variant="ghost">
                              Restore
                            </Button>
                          }
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {!isNew && (canDelete ? canDelete(record) : true) && (
              <Card className="border-red-200 p-5">
                <h2 className="text-base font-semibold text-destructive">Danger zone</h2>
                {deleteHint && <p className="mt-1 text-xs text-muted-foreground">{deleteHint}</p>}
                <ConfirmDialog
                  title={`Delete this ${singular.toLowerCase()}?`}
                  description="This permanently removes it. This cannot be undone."
                  confirmLabel="Delete"
                  onConfirm={() => remove.mutateAsync()}
                  trigger={
                    <Button type="button" variant="outline" className="mt-3 w-full text-destructive">
                      <Trash2 /> Delete {singular.toLowerCase()}
                    </Button>
                  }
                />
              </Card>
            )}
          </div>
        </div>
      </form>
    </RequirePermission>
  );
}

// ======================================================================= Dialog-based CRUD for simple entities

export interface DialogCrudProps<T extends { id: string }> {
  title: string;
  description?: string;
  singular: string;
  permission: PermissionKey;
  endpoint: string;
  columns: Column<T>[];
  schema: ZodType;
  defaults: Record<string, any>;
  fields: FieldDef[];
  toForm?: (row: T) => Record<string, any>;
  filters?: { name: string; label: string; options: { value: string; label: string }[] }[];
  labelOf: (row: T) => string;
  reorderable?: boolean;
  pageSize?: number;
  embedded?: boolean;
}

export function DialogCrud<T extends { id: string; displayOrder?: number }>(props: DialogCrudProps<T>) {
  const { title, description, singular, permission, endpoint, columns, schema, defaults, fields, toForm, filters = [], labelOf, reorderable, pageSize = 50, embedded } = props;
  const qc = useQueryClient();
  const [editing, setEditing] = useState<T | 'new' | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => Object.fromEntries(filters.map((f) => [f.name, f.options[0]?.value ?? ''])));
  const search = useDebounced(q);
  const query = { page, pageSize, q: search, ...filterValues };
  const { data, isLoading } = useQuery({ queryKey: [endpoint, query], queryFn: () => apiPaged<T>(endpoint, { query }), placeholderData: keepPreviousData });
  const form = useForm<any>({ resolver: zodResolver(schema as never), defaultValues: defaults });
  const [formError, setFormError] = useState<string | null>(null);

  const open = (row: T | 'new') => {
    setFormError(null);
    form.reset(row === 'new' ? defaults : { ...defaults, ...(toForm ? toForm(row) : row) });
    setEditing(row);
  };

  const save = useMutation({
    mutationFn: (values: any) => (editing === 'new' ? api(endpoint, { method: 'POST', body: values }) : api(`${endpoint}/${(editing as T).id}`, { method: 'PATCH', body: values })),
    onSuccess: () => {
      toast.success(`${singular} saved`);
      setEditing(null);
      void qc.invalidateQueries({ queryKey: [endpoint] });
      void qc.invalidateQueries({ queryKey: ['options'] });
    },
    onError: (e) => setFormError(applyErrors(form, e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`${endpoint}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Deleted');
      void qc.invalidateQueries({ queryKey: [endpoint] });
    },
  });
  const reorder = useMutation({
    mutationFn: (items: { id: string; displayOrder: number }[]) => api(`${endpoint}/reorder`, { method: 'POST', body: { items } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [endpoint] }),
  });

  const move = (index: number, dir: -1 | 1) => {
    const rows = [...(data?.data ?? [])];
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    [rows[index], rows[target]] = [rows[target]!, rows[index]!];
    reorder.mutate(rows.map((r, i) => ({ id: r.id, displayOrder: i })));
  };

  const allColumns: Column<T>[] = [
    ...columns,
    {
      key: '_actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-px text-right whitespace-nowrap',
      cell: (row) => {
        const index = data?.data.findIndex((r) => r.id === row.id) ?? 0;
        return (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {reorderable && !search && (
              <>
                <Button size="sm" variant="ghost" aria-label="Move up" disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)}>
                  ↑
                </Button>
                <Button size="sm" variant="ghost" aria-label="Move down" disabled={index === (data?.data.length ?? 1) - 1 || reorder.isPending} onClick={() => move(index, 1)}>
                  ↓
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" aria-label={`Edit ${labelOf(row)}`} onClick={() => open(row)}>
              <Pencil />
            </Button>
            <ConfirmDialog
              title={`Delete ${singular.toLowerCase()}?`}
              description={`“${labelOf(row)}” will be permanently deleted.`}
              confirmLabel="Delete"
              onConfirm={() => remove.mutateAsync(row.id)}
              trigger={
                <Button size="sm" variant="ghost" aria-label={`Delete ${labelOf(row)}`} className="text-muted-foreground hover:text-destructive">
                  <Trash2 />
                </Button>
              }
            />
          </div>
        );
      },
    },
  ];

  const body = (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} />
        {filters.map((f) => (
          <FilterSelect key={f.name} label={f.label} value={filterValues[f.name] ?? ''} options={f.options} onChange={(v) => { setFilterValues((s) => ({ ...s, [f.name]: v })); setPage(1); }} />
        ))}
        {embedded && (
          <Button className="sm:ml-auto" onClick={() => open('new')}>
            <Plus /> Add {singular.toLowerCase()}
          </Button>
        )}
      </div>
      <DataTable columns={allColumns} rows={data?.data} loading={isLoading} onRowClick={(row) => open(row)} />
      <PaginationBar meta={data?.meta} onPage={setPage} />
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent wide={fields.some((f) => ['rich', 'array', 'icon', 'multi'].includes(f.type))}>
          <DialogHeader title={editing === 'new' ? `Add ${singular.toLowerCase()}` : `Edit ${singular.toLowerCase()}`} />
          <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate className="space-y-5">
            <FieldGrid fields={fields} form={form} />
            {formError && <Alert variant="error">{formError}</Alert>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={save.isPending}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );

  if (embedded) return body;
  return (
    <RequirePermission permission={permission}>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button onClick={() => open('new')}>
            <Plus /> Add {singular.toLowerCase()}
          </Button>
        }
      />
      {body}
    </RequirePermission>
  );
}
