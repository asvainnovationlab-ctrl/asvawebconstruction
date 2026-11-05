'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Paperclip, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  BUDGET_RANGES,
  formatFileSize,
  LABELS,
  PREFERRED_CONTACT_METHODS,
  PROJECT_TYPES,
  projectInquirySchema,
  projectInquiryStep1Schema,
  projectInquiryStep2Schema,
  projectInquiryStep3Schema,
  TIMELINES,
  type ProjectInquiryInput,
} from '@asva/shared';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, NativeSelect, Switch, Textarea } from '@/components/ui/form-controls';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { applyServerErrors, FormError, FormSuccess, Honeypot, useFormStart } from './form-helpers';
import { useTurnstile } from './turnstile';

const STEPS = [
  { title: 'About you', schema: projectInquiryStep1Schema, fields: ['fullName', 'email', 'phone', 'companyName'] },
  { title: 'Your project', schema: projectInquiryStep2Schema, fields: ['projectType', 'description', 'hasExistingProduct', 'existingUrl'] },
  { title: 'Budget & timeline', schema: projectInquiryStep3Schema, fields: ['budgetRange', 'timeline', 'preferredContact', 'consent'] },
] as const;
const ALL_FIELDS = STEPS.flatMap((s) => s.fields);
const MAX_FILE = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.doc,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.webp';

export function InquiryForm({ initialProjectType }: { initialProjectType?: string }) {
  const startedAt = useFormStart();
  const captcha = useTurnstile();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const form = useForm<ProjectInquiryInput>({
    resolver: zodResolver(projectInquirySchema),
    mode: 'onTouched',
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      companyName: '',
      projectType: (PROJECT_TYPES as readonly string[]).includes(initialProjectType ?? '') ? (initialProjectType as ProjectInquiryInput['projectType']) : undefined,
      description: '',
      hasExistingProduct: false,
      existingUrl: '',
      budgetRange: undefined,
      timeline: undefined,
      preferredContact: 'EMAIL',
      consent: undefined as unknown as true,
      website: '',
    },
  });
  const { register, control, formState, trigger, watch, handleSubmit } = form;
  const errors = formState.errors;
  const hasExisting = watch('hasExistingProduct');

  const goTo = (next: number) => {
    setStep(next);
    requestAnimationFrame(() => headingRef.current?.focus());
  };

  const next = async () => {
    const ok = await trigger(STEPS[step]!.fields as unknown as (keyof ProjectInquiryInput)[]);
    if (ok) goTo(step + 1);
  };

  const onFile = (f: File | undefined) => {
    setFileError(null);
    if (!f) return setFile(null);
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ACCEPT.split(',').includes(`.${ext}`)) return setFileError('Unsupported file type. Use PDF, Word, Excel, PowerPoint or an image.');
    if (f.size > MAX_FILE) return setFileError('The file is larger than 10 MB.');
    setFile(f);
  };

  const onSubmit = handleSubmit(
    async (values) => {
      setError(null);
      const body = new FormData();
      body.append('payload', JSON.stringify({ ...values, formStartedAt: startedAt.current, turnstileToken: captcha.token }));
      if (file) body.append('attachment', file);
      try {
        const result = await api<{ message: string }>('/inquiries', { method: 'POST', body });
        setDone(result.message);
      } catch (e) {
        const message = applyServerErrors(e, form.setError, ALL_FIELDS);
        const firstBad = STEPS.findIndex((s) => s.fields.some((f) => form.getFieldState(f as keyof ProjectInquiryInput).invalid));
        if (firstBad >= 0 && firstBad !== step) goTo(firstBad);
        setError(message);
        captcha.reset();
      }
    },
    (invalid) => {
      const firstBad = STEPS.findIndex((s) => s.fields.some((f) => f in invalid));
      if (firstBad >= 0) goTo(firstBad);
    },
  );

  if (done) return <FormSuccess title="Inquiry received" message={done} />;

  return (
    <form onSubmit={onSubmit} noValidate className="relative" aria-label="Project inquiry form">
      <Honeypot register={register('website')} />
      <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.title} aria-current={i === step ? 'step' : undefined}>
            <div className={cn('h-1 rounded-full transition-colors', i <= step ? 'bg-brand' : 'bg-neutral-200')} />
            <p className={cn('mt-2 text-xs font-medium', i === step ? 'text-ink' : 'text-muted-ink')}>
              <span className="sr-only">Step {i + 1} of 3: </span>
              {s.title}
            </p>
          </li>
        ))}
      </ol>

      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-ink outline-none">
        {STEPS[step]!.title}
      </h2>

      <div className="mt-6 space-y-5">
        {step === 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="inq-name" label="Full name" required error={errors.fullName?.message}>
              <Input autoComplete="name" {...register('fullName')} />
            </Field>
            <Field id="inq-email" label="Business email" required error={errors.email?.message}>
              <Input type="email" autoComplete="email" {...register('email')} />
            </Field>
            <Field id="inq-phone" label="Phone number" required hint="With country code, e.g. +977 98XXXXXXXX" error={errors.phone?.message}>
              <Input type="tel" autoComplete="tel" placeholder="+977" {...register('phone')} />
            </Field>
            <Field id="inq-company" label="Company name" error={errors.companyName?.message}>
              <Input autoComplete="organization" {...register('companyName')} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <>
            <Field id="inq-type" label="Project type" required error={errors.projectType?.message}>
              <NativeSelect {...register('projectType')} defaultValue="">
                <option value="" disabled>
                  Select a project type
                </option>
                {PROJECT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="inq-description" label="Project description" required hint="What problem are you solving? Who are the users? Any must-have features?" error={errors.description?.message}>
              <Textarea rows={6} {...register('description')} />
            </Field>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-4">
              <label htmlFor="inq-existing" className="text-sm font-medium text-ink">
                Do you already have a website or application?
              </label>
              <Controller control={control} name="hasExistingProduct" render={({ field }) => <Switch id="inq-existing" checked={Boolean(field.value)} onCheckedChange={field.onChange} />} />
            </div>
            {hasExisting && (
              <Field id="inq-url" label="Existing website or app URL" error={errors.existingUrl?.message}>
                <Input type="url" placeholder="https://" {...register('existingUrl')} />
              </Field>
            )}
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-ink" id="inq-file-label">
                Attachment <span className="font-normal text-muted-ink">(optional — brief, wireframes, RFP)</span>
              </p>
              {file ? (
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-surface px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <Paperclip className="size-4 shrink-0 text-muted-ink" aria-hidden />
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0 text-muted-ink">({formatFileSize(file.size)})</span>
                  </span>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setFile(null)} aria-label="Remove attachment">
                    <X />
                  </Button>
                </div>
              ) : (
                <Input type="file" accept={ACCEPT} aria-labelledby="inq-file-label" aria-describedby="inq-file-hint" onChange={(e) => onFile(e.target.files?.[0])} />
              )}
              <p id="inq-file-hint" className={cn('text-xs', fileError ? 'font-medium text-destructive' : 'text-muted-ink')} role={fileError ? 'alert' : undefined}>
                {fileError ?? 'PDF, Word, Excel, PowerPoint or image. Max 10 MB.'}
              </p>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="inq-budget" label="Expected budget" required error={errors.budgetRange?.message}>
                <NativeSelect {...register('budgetRange')} defaultValue="">
                  <option value="" disabled>
                    Select a range
                  </option>
                  {BUDGET_RANGES.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="inq-timeline" label="Desired timeline" required error={errors.timeline?.message}>
                <NativeSelect {...register('timeline')} defaultValue="">
                  <option value="" disabled>
                    Select a timeline
                  </option>
                  {TIMELINES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <fieldset>
              <legend className="text-sm font-medium text-ink">Preferred contact method</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PREFERRED_CONTACT_METHODS.map((m) => (
                  <label key={m} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/5">
                    <input type="radio" value={m} {...register('preferredContact')} className="accent-[var(--brand)]" />
                    {LABELS.preferredContact[m]}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <div className="flex items-start gap-3">
                <Controller
                  control={control}
                  name="consent"
                  render={({ field }) => (
                    <Checkbox id="inq-consent" checked={field.value === true} onCheckedChange={(v) => field.onChange(v === true ? true : undefined)} aria-invalid={errors.consent ? true : undefined} aria-describedby={errors.consent ? 'inq-consent-error' : undefined} className="mt-0.5" />
                  )}
                />
                <label htmlFor="inq-consent" className="text-sm text-slate-700">
                  I agree to the{' '}
                  <a href="/privacy-policy" target="_blank" className="font-medium text-brand hover:underline">
                    privacy policy
                  </a>{' '}
                  and consent to being contacted about this inquiry.
                </label>
              </div>
              {errors.consent && (
                <p id="inq-consent-error" role="alert" className="mt-1.5 text-xs font-medium text-destructive">
                  {errors.consent.message}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {step === STEPS.length - 1 && captcha.widget}
        <FormError message={error} />
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button type="button" variant="outline" onClick={() => goTo(step - 1)}>
            <ArrowLeft aria-hidden /> Back
          </Button>
        ) : (
          <span />
        )}
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            Continue <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button type="submit" variant="accent" size="lg" loading={formState.isSubmitting} disabled={captcha.enabled && !captcha.token}>
            Submit inquiry
          </Button>
        )}
      </div>
    </form>
  );
}
