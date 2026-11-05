'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { contactSubmissionSchema, type ContactSubmissionInput } from '@asva/shared';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/form-controls';
import { api } from '@/lib/api/client';
import { applyServerErrors, FormError, FormSuccess, Honeypot, useFormStart } from './form-helpers';
import { useTurnstile } from './turnstile';

const FIELDS = ['name', 'email', 'phone', 'company', 'subject', 'message', 'consent'] as const;

export function ContactForm() {
  const startedAt = useFormStart();
  const captcha = useTurnstile();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ContactSubmissionInput>({
    resolver: zodResolver(contactSubmissionSchema),
    defaultValues: { name: '', email: '', phone: '', company: '', subject: '', message: '', consent: undefined as unknown as true, website: '' },
  });
  const { register, handleSubmit, control, formState } = form;
  const errors = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await api<{ message: string }>('/contact', { method: 'POST', body: { ...values, formStartedAt: startedAt.current, turnstileToken: captcha.token } });
      setDone(result.message);
    } catch (e) {
      setError(applyServerErrors(e, form.setError, FIELDS));
      captcha.reset();
    }
  });

  if (done) {
    return (
      <FormSuccess title="Message sent" message={done}>
        <Button variant="outline" className="mt-6" onClick={() => { form.reset(); setDone(null); }}>
          Send another message
        </Button>
      </FormSuccess>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="relative space-y-5" aria-label="Contact form">
      <Honeypot register={register('website')} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="contact-name" label="Full name" required error={errors.name?.message}>
          <Input autoComplete="name" {...register('name')} />
        </Field>
        <Field id="contact-email" label="Email" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </Field>
        <Field id="contact-phone" label="Phone" hint="Include country code, e.g. +977" error={errors.phone?.message}>
          <Input type="tel" autoComplete="tel" {...register('phone')} />
        </Field>
        <Field id="contact-company" label="Company" error={errors.company?.message}>
          <Input autoComplete="organization" {...register('company')} />
        </Field>
      </div>
      <Field id="contact-subject" label="Subject" error={errors.subject?.message}>
        <Input {...register('subject')} />
      </Field>
      <Field id="contact-message" label="Message" required error={errors.message?.message}>
        <Textarea rows={6} {...register('message')} />
      </Field>
      <div>
        <div className="flex items-start gap-3">
          <Controller
            control={control}
            name="consent"
            render={({ field }) => (
              <Checkbox id="contact-consent" checked={field.value === true} onCheckedChange={(v) => field.onChange(v === true ? true : undefined)} aria-invalid={errors.consent ? true : undefined} aria-describedby={errors.consent ? 'contact-consent-error' : undefined} className="mt-0.5" />
            )}
          />
          <label htmlFor="contact-consent" className="text-sm text-slate-700">
            I agree that my details will be used to respond to my message, as described in the{' '}
            <Link href="/privacy-policy" className="font-medium text-brand underline-offset-2 hover:underline">
              privacy policy
            </Link>
            .
          </label>
        </div>
        {errors.consent && (
          <p id="contact-consent-error" role="alert" className="mt-1.5 text-xs font-medium text-destructive">
            {errors.consent.message}
          </p>
        )}
      </div>
      {captcha.widget}
      <FormError message={error} />
      <Button type="submit" size="lg" variant="accent" loading={formState.isSubmitting} disabled={captcha.enabled && !captcha.token} className="w-full sm:w-auto">
        Send message
      </Button>
    </form>
  );
}
