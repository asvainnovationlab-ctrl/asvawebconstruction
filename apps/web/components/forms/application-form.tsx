'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { jobApplicationSchema, type JobApplicationInput } from '@asva/shared';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/form-controls';
import { api } from '@/lib/api/client';
import { applyServerErrors, FormError, FormSuccess, Honeypot, useFormStart } from './form-helpers';
import { useTurnstile } from './turnstile';

const FIELDS = ['fullName', 'email', 'phone', 'coverLetter', 'portfolioUrl', 'linkedinUrl', 'consent'] as const;
const ACCEPT = '.pdf,.doc,.docx';
const MAX = 5 * 1024 * 1024;

export function ApplicationForm({ jobId, jobTitle }: { jobId: string | null; jobTitle: string }) {
  const startedAt = useFormStart();
  const captcha = useTurnstile();
  const [resume, setResume] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const form = useForm<JobApplicationInput>({
    resolver: zodResolver(jobApplicationSchema),
    defaultValues: { fullName: '', email: '', phone: '', coverLetter: '', portfolioUrl: '', linkedinUrl: '', consent: undefined, website: '' },
  });
  const { register, control, handleSubmit, formState } = form;
  const errors = formState.errors;

  const validateResume = (f: File | null): string | null => {
    if (!f) return 'Please attach your CV / resume.';
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['pdf', 'doc', 'docx'].includes(ext)) return 'Upload a PDF or Word document.';
    if (f.size > MAX) return 'The file must be 5 MB or smaller.';
    return null;
  };

  const onSubmit = handleSubmit(
    async (values) => {
      const problem = validateResume(resume);
      setResumeError(problem);
      if (problem) return;
      setError(null);
      const body = new FormData();
      body.append('payload', JSON.stringify({ ...values, formStartedAt: startedAt.current, turnstileToken: captcha.token }));
      body.append('resume', resume!);
      try {
        const result = await api<{ message: string }>(jobId ? `/jobs/${jobId}/applications` : '/careers/applications', { method: 'POST', body });
        setDone(result.message);
      } catch (e) {
        setError(applyServerErrors(e, form.setError, FIELDS));
        captcha.reset();
      }
    },
    () => setResumeError(validateResume(resume)),
  );

  if (done) return <FormSuccess title="Application submitted" message={done} />;

  return (
    <form onSubmit={onSubmit} noValidate className="relative space-y-5" aria-label={`Apply for ${jobTitle}`}>
      <Honeypot register={register('website')} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="app-name" label="Full name" required error={errors.fullName?.message}>
          <Input autoComplete="name" {...register('fullName')} />
        </Field>
        <Field id="app-email" label="Email" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </Field>
        <Field id="app-phone" label="Phone" required hint="With country code" error={errors.phone?.message}>
          <Input type="tel" autoComplete="tel" placeholder="+977" {...register('phone')} />
        </Field>
        <Field id="app-linkedin" label="LinkedIn profile" error={errors.linkedinUrl?.message}>
          <Input type="url" placeholder="https://linkedin.com/in/…" {...register('linkedinUrl')} />
        </Field>
      </div>
      <Field id="app-portfolio" label="Portfolio / GitHub" error={errors.portfolioUrl?.message}>
        <Input type="url" placeholder="https://" {...register('portfolioUrl')} />
      </Field>
      <Field id="app-cover" label="Cover letter" hint="Optional — tell us why you are interested" error={errors.coverLetter?.message}>
        <Textarea rows={5} {...register('coverLetter')} />
      </Field>
      <Field id="app-resume" label="CV / resume" required hint="PDF, DOC or DOCX, up to 5 MB" error={resumeError ?? undefined}>
        <Input type="file" accept={ACCEPT} onChange={(e) => { const f = e.target.files?.[0] ?? null; setResume(f); setResumeError(f ? validateResume(f) : null); }} />
      </Field>
      <div>
        <div className="flex items-start gap-3">
          <Controller
            control={control}
            name="consent"
            render={({ field }) => <Checkbox id="app-consent" checked={field.value === true} onCheckedChange={(v) => field.onChange(v === true ? true : undefined)} aria-invalid={errors.consent ? true : undefined} className="mt-0.5" />}
          />
          <label htmlFor="app-consent" className="text-sm text-slate-700">
            I consent to Asva Innovation Lab storing my application and CV to evaluate me for this and similar roles, as described in the{' '}
            <a href="/privacy-policy" target="_blank" className="font-medium text-brand hover:underline">
              privacy policy
            </a>
            .
          </label>
        </div>
        {errors.consent && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
            {errors.consent.message}
          </p>
        )}
      </div>
      {captcha.widget}
      <FormError message={error} />
      <Button type="submit" size="lg" variant="accent" loading={formState.isSubmitting} disabled={captcha.enabled && !captcha.token}>
        Submit application
      </Button>
    </form>
  );
}
