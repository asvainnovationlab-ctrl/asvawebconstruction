'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useFieldArray, useWatch, type Control, type FieldErrors, type UseFormReturn } from 'react-hook-form';
import { slugify } from '@asva/shared';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Label, NativeSelect, Switch, Textarea } from '@/components/ui/form-controls';
import { apiPaged } from '@/lib/api/client';
import { getIcon, ICON_NAMES } from '@/lib/icons';
import { cn, fromDateTimeLocal, toDateTimeLocal } from '@/lib/utils';
import { MediaField, MediaPickerDialog } from './media-picker';
import { RichTextEditor } from './rich-text-editor';

type Option = { value: string; label: string };
type RemoteOptions = { endpoint: string; labelKey: string; query?: Record<string, string | number> };

export type FieldDef =
  | { type: 'text' | 'email' | 'url' | 'number' | 'color'; name: string; label: string; hint?: string; required?: boolean; placeholder?: string; span?: 1 | 2 }
  | { type: 'textarea'; name: string; label: string; hint?: string; required?: boolean; rows?: number; span?: 1 | 2; maxLength?: number }
  | { type: 'datetime' | 'date'; name: string; label: string; hint?: string; required?: boolean; span?: 1 | 2 }
  | { type: 'slug'; name: string; label: string; from: string; prefix?: string; hint?: string; span?: 1 | 2 }
  | { type: 'select'; name: string; label: string; options: Option[] | RemoteOptions; allowEmpty?: string; hint?: string; required?: boolean; span?: 1 | 2 }
  | { type: 'switch'; name: string; label: string; hint?: string; span?: 1 | 2 }
  | { type: 'media'; name: string; label: string; hint?: string; span?: 1 | 2 }
  | { type: 'rich'; name: string; label: string; hint?: string; span?: 1 | 2 }
  | { type: 'stringList'; name: string; label: string; hint?: string; placeholder?: string; span?: 1 | 2 }
  | { type: 'multi'; name: string; label: string; options: RemoteOptions; hint?: string; span?: 1 | 2 }
  | { type: 'icon'; name: string; label: string; hint?: string; span?: 1 | 2 }
  | { type: 'gallery'; name: string; label: string; hint?: string; span?: 1 | 2 }
  | { type: 'array'; name: string; label: string; itemLabel: string; fields: FieldDef[]; hint?: string; span?: 1 | 2 }
  | { type: 'heading'; name: string; label: string; hint?: string; span?: 1 | 2 };

export function getError(errors: FieldErrors | undefined, path: string): string | undefined {
  const node = path.split('.').reduce<any>((acc, key) => acc?.[key], errors);
  return node?.message as string | undefined;
}

const fieldId = (name: string) => `f-${name.replace(/[^a-zA-Z0-9]/g, '-')}`;

function useOptions(source: Option[] | RemoteOptions) {
  const remote = !Array.isArray(source);
  const { data } = useQuery({
    queryKey: ['options', remote ? source.endpoint : 'static', remote ? source.query : null],
    queryFn: () => apiPaged<Record<string, any>>((source as RemoteOptions).endpoint, { query: { pageSize: 100, ...(source as RemoteOptions).query } }),
    enabled: remote,
    staleTime: 60_000,
  });
  if (!remote) return source;
  return (data?.data ?? []).map((row) => ({ value: row.id as string, label: String(row[(source as RemoteOptions).labelKey]) }));
}

function SelectField({ def, control, error }: { def: Extract<FieldDef, { type: 'select' }>; control: Control<any>; error?: string }) {
  const options = useOptions(def.options);
  return (
    <Controller
      control={control}
      name={def.name}
      render={({ field }) => (
        <Field id={fieldId(def.name)} label={def.label} hint={def.hint} error={error} required={def.required}>
          <NativeSelect value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : e.target.value)} onBlur={field.onBlur}>
            {def.allowEmpty !== undefined && <option value="">{def.allowEmpty}</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
    />
  );
}

function MultiField({ def, control }: { def: Extract<FieldDef, { type: 'multi' }>; control: Control<any> }) {
  const options = useOptions(def.options);
  return (
    <Controller
      control={control}
      name={def.name}
      render={({ field }) => {
        const selected = new Set<string>(field.value ?? []);
        return (
          <fieldset>
            <legend className="text-sm font-medium">{def.label}</legend>
            {def.hint && <p className="mt-0.5 text-xs text-muted-foreground">{def.hint}</p>}
            <div className="mt-2 flex max-h-56 flex-wrap gap-2 overflow-y-auto rounded-lg border p-3">
              {options.length === 0 && <p className="text-xs text-muted-foreground">No options yet.</p>}
              {options.map((o) => (
                <label key={o.value} className={cn('flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm', selected.has(o.value) ? 'border-primary bg-primary/5' : 'hover:bg-muted')}>
                  <input
                    type="checkbox"
                    className="size-3.5 accent-[var(--brand)]"
                    checked={selected.has(o.value)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(o.value);
                      else next.delete(o.value);
                      field.onChange([...next]);
                    }}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
        );
      }}
    />
  );
}

function SlugField({ def, form }: { def: Extract<FieldDef, { type: 'slug' }>; form: UseFormReturn<any> }) {
  const source = useWatch({ control: form.control, name: def.from });
  const touched = useRef(Boolean(form.getValues(def.name)));
  useEffect(() => {
    if (!touched.current && typeof source === 'string') form.setValue(def.name, slugify(source), { shouldDirty: true });
  }, [source, def.name, form]);
  const error = getError(form.formState.errors, def.name);
  return (
    <Controller
      control={form.control}
      name={def.name}
      render={({ field }) => (
        <Field id={fieldId(def.name)} label={def.label} hint={def.hint ?? (def.prefix ? `URL: ${def.prefix}${field.value || '…'}` : undefined)} error={error} required>
          <Input
            value={field.value ?? ''}
            onChange={(e) => {
              touched.current = true;
              field.onChange(slugify(e.target.value) || e.target.value.toLowerCase());
            }}
            onBlur={field.onBlur}
            spellCheck={false}
          />
        </Field>
      )}
    />
  );
}

function StringListField({ def, control }: { def: Extract<FieldDef, { type: 'stringList' }>; control: Control<any> }) {
  const [draft, setDraft] = useState('');
  return (
    <Controller
      control={control}
      name={def.name}
      render={({ field }) => {
        const items: string[] = field.value ?? [];
        const add = () => {
          const v = draft.trim();
          if (v && !items.includes(v)) field.onChange([...items, v]);
          setDraft('');
        };
        return (
          <div className="space-y-2">
            <Label htmlFor={fieldId(def.name)}>{def.label}</Label>
            {def.hint && <p className="text-xs text-muted-foreground">{def.hint}</p>}
            <ul className="space-y-1.5">
              {items.map((item, i) => (
                <li key={`${item}-${i}`} className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm">
                  <span className="flex-1">{item}</span>
                  <button type="button" onClick={() => field.onChange(items.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${item}`}>
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input
                id={fieldId(def.name)}
                value={draft}
                placeholder={def.placeholder ?? 'Add an item and press Enter'}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={add}>
                Add
              </Button>
            </div>
          </div>
        );
      }}
    />
  );
}

function IconField({ def, control }: { def: Extract<FieldDef, { type: 'icon' }>; control: Control<any> }) {
  return (
    <Controller
      control={control}
      name={def.name}
      render={({ field }) => (
        <fieldset>
          <legend className="text-sm font-medium">{def.label}</legend>
          <div className="mt-2 grid max-h-44 grid-cols-8 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-11">
            {ICON_NAMES.map((name) => {
              const Icon = getIcon(name);
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  aria-label={name}
                  aria-pressed={field.value === name}
                  onClick={() => field.onChange(name)}
                  className={cn('grid aspect-square place-items-center rounded-md hover:bg-muted', field.value === name && 'bg-primary/10 text-primary ring-1 ring-primary')}
                >
                  <Icon className="size-4" />
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
    />
  );
}

function GalleryField({ def, control }: { def: Extract<FieldDef, { type: 'gallery' }>; control: Control<any> }) {
  const { fields, append, remove, move } = useFieldArray({ control, name: def.name });
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{def.label}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {fields.map((f, i) => (
          <li key={f.id} className="flex gap-3 rounded-lg border p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={(f as any).url ?? ''} alt="" className="size-16 rounded object-cover" />
            <div className="flex-1 space-y-1">
              <Controller control={control} name={`${def.name}.${i}.caption`} render={({ field }) => <Input value={field.value ?? ''} onChange={field.onChange} placeholder="Caption" aria-label="Caption" />} />
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move up">
                  <ArrowUp />
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={i === fields.length - 1} onClick={() => move(i, i + 1)} aria-label="Move down">
                  <ArrowDown />
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} aria-label="Remove image">
                  <Trash2 />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus /> Add image
      </Button>
      <MediaPickerDialog open={open} onOpenChange={setOpen} onPick={(m) => append({ mediaId: m.id, caption: m.caption ?? '', url: m.url })} />
    </div>
  );
}

function ArrayField({ def, form }: { def: Extract<FieldDef, { type: 'array' }>; form: UseFormReturn<any> }) {
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: def.name });
  const blank = Object.fromEntries(def.fields.map((f) => [f.name, f.type === 'switch' ? false : f.type === 'icon' ? 'Sparkles' : '']));
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{def.label}</p>
        {def.hint && <p className="text-xs text-muted-foreground">{def.hint}</p>}
      </div>
      <ol className="space-y-3">
        {fields.map((item, i) => (
          <li key={item.id} className="rounded-lg border bg-muted/20 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {def.itemLabel} {i + 1}
              </span>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${def.itemLabel} ${i + 1} up`}>
                  <ArrowUp />
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={i === fields.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move ${def.itemLabel} ${i + 1} down`}>
                  <ArrowDown />
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)} aria-label={`Remove ${def.itemLabel} ${i + 1}`}>
                  <Trash2 />
                </Button>
              </div>
            </div>
            <FieldGrid fields={def.fields.map((f) => ({ ...f, name: `${def.name}.${i}.${f.name}` }) as FieldDef)} form={form} />
          </li>
        ))}
      </ol>
      <Button type="button" variant="outline" size="sm" onClick={() => append(blank)}>
        <Plus /> Add {def.itemLabel.toLowerCase()}
      </Button>
    </div>
  );
}

export function FormField({ def, form }: { def: FieldDef; form: UseFormReturn<any> }) {
  const { control } = form;
  const error = getError(form.formState.errors, def.name);
  const id = fieldId(def.name);
  switch (def.type) {
    case 'heading':
      return (
        <div className="border-b pb-2 pt-2">
          <h3 className="text-sm font-semibold">{def.label}</h3>
          {def.hint && <p className="text-xs text-muted-foreground">{def.hint}</p>}
        </div>
      );
    case 'text':
    case 'email':
    case 'url':
    case 'number':
    case 'color':
      return (
        <Controller
          control={control}
          name={def.name}
          render={({ field }) => (
            <Field id={id} label={def.label} hint={def.hint} error={error} required={def.required}>
              <Input
                type={def.type === 'text' ? 'text' : def.type}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(def.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
                onBlur={field.onBlur}
                placeholder={def.placeholder}
                className={def.type === 'color' ? 'h-10 w-24 p-1' : undefined}
              />
            </Field>
          )}
        />
      );
    case 'textarea':
      return (
        <Controller
          control={control}
          name={def.name}
          render={({ field }) => (
            <Field id={id} label={def.label} hint={def.hint ?? (def.maxLength ? `${(field.value ?? '').length}/${def.maxLength} characters` : undefined)} error={error} required={def.required}>
              <Textarea rows={def.rows ?? 3} value={field.value ?? ''} onChange={field.onChange} onBlur={field.onBlur} />
            </Field>
          )}
        />
      );
    case 'datetime':
      return (
        <Controller
          control={control}
          name={def.name}
          render={({ field }) => (
            <Field id={id} label={def.label} hint={def.hint ?? 'Times are in your local time zone'} error={error} required={def.required}>
              <Input type="datetime-local" value={toDateTimeLocal(field.value)} onChange={(e) => field.onChange(fromDateTimeLocal(e.target.value))} onBlur={field.onBlur} />
            </Field>
          )}
        />
      );
    case 'date':
      return (
        <Controller
          control={control}
          name={def.name}
          render={({ field }) => (
            <Field id={id} label={def.label} hint={def.hint} error={error} required={def.required}>
              <Input type="date" value={field.value ? String(field.value).slice(0, 10) : ''} onChange={(e) => field.onChange(e.target.value || null)} onBlur={field.onBlur} />
            </Field>
          )}
        />
      );
    case 'slug':
      return <SlugField def={def} form={form} />;
    case 'select':
      return <SelectField def={def} control={control} error={error} />;
    case 'switch':
      return (
        <Controller
          control={control}
          name={def.name}
          render={({ field }) => (
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <Label htmlFor={id}>{def.label}</Label>
                {def.hint && <p className="mt-1 text-xs text-muted-foreground">{def.hint}</p>}
              </div>
              <Switch id={id} checked={Boolean(field.value)} onCheckedChange={field.onChange} />
            </div>
          )}
        />
      );
    case 'media':
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{def.label}</Label>
          {def.hint && <p className="text-xs text-muted-foreground">{def.hint}</p>}
          <Controller control={control} name={def.name} render={({ field }) => <MediaField id={id} value={field.value} onChange={field.onChange} />} />
        </div>
      );
    case 'rich':
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{def.label}</Label>
          {def.hint && <p className="text-xs text-muted-foreground">{def.hint}</p>}
          <Controller control={control} name={def.name} render={({ field }) => <RichTextEditor id={id} value={field.value ?? ''} onChange={field.onChange} invalid={Boolean(error)} />} />
          {error && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
      );
    case 'stringList':
      return <StringListField def={def} control={control} />;
    case 'multi':
      return <MultiField def={def} control={control} />;
    case 'icon':
      return <IconField def={def} control={control} />;
    case 'gallery':
      return <GalleryField def={def} control={control} />;
    case 'array':
      return <ArrayField def={def} form={form} />;
  }
}

export function FieldGrid({ fields, form, columns = 2 }: { fields: FieldDef[]; form: UseFormReturn<any>; columns?: 1 | 2 }) {
  return (
    <div className={cn('grid gap-5', columns === 2 && 'sm:grid-cols-2')}>
      {fields.map((def) => {
        const full = columns === 1 || def.span === 2 || ['rich', 'array', 'gallery', 'multi', 'icon', 'stringList', 'heading', 'textarea', 'media'].includes(def.type);
        return (
          <div key={def.name} className={cn(full && 'sm:col-span-2')}>
            <FormField def={def} form={form} />
          </div>
        );
      })}
    </div>
  );
}

export { Checkbox };
