'use client';

import { CheckCircle2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { Alert } from '@/components/ui/primitives';
import { ApiError } from '@/lib/api/client';

/** Copies API validation details onto the matching form fields; returns a general message. */
export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly string[]): string {
  if (error instanceof ApiError) {
    let unmatched = false;
    for (const d of error.details) {
      if (fields.includes(d.path)) setError(d.path as Path<T>, { type: 'server', message: d.message });
      else unmatched = true;
    }
    return error.details.length && !unmatched ? 'Please correct the highlighted fields.' : error.message;
  }
  return 'We could not reach the server. Please check your connection and try again.';
}

/** Hidden honeypot input: real visitors never see it; bots tend to fill it. */
export function Honeypot({ register }: { register: object }) {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
      <label>
        Leave this field empty
        <input type="text" tabIndex={-1} autoComplete="off" {...register} />
      </label>
    </div>
  );
}

export function FormSuccess({ title, message, children }: { title: string; message: string; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div ref={ref} tabIndex={-1} role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center outline-none">
      <CheckCircle2 className="mx-auto size-10 text-emerald-600" aria-hidden />
      <h2 className="mt-4 text-xl font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-slate-700">{message}</p>
      {children}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <Alert variant="error">{message}</Alert>;
}

export function useFormStart(): { readonly current: number } {
  const [start] = useState(() => ({ current: Date.now() }));
  return start;
}
