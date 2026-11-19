'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { contactSubmissionSchema, phoneSchema } from '@asva/shared';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, NativeSelect, Textarea } from '@/components/ui/form-controls';
import { api } from '@/lib/api/client';
import { applyServerErrors, FormError, FormSuccess, Honeypot, useFormStart } from './form-helpers';
import { useTurnstile } from './turnstile';

const courseEnrollmentSchema = contactSubmissionSchema.extend({
  phone: phoneSchema,
  inquiryType: z.enum(['I want to enroll', 'I want course details', 'I have another question']),
  background: z.string().trim().max(500, 'Please keep this under 500 characters.'),
  message: z.string().trim().min(10, 'Please write at least 10 characters').max(4000, 'Please keep this under 4,000 characters.'),
});

type CourseEnrollmentInput = z.input<typeof courseEnrollmentSchema>;

const FIELDS = ['name', 'email', 'phone', 'subject', 'message', 'consent'] as const;

export function CourseEnrollmentForm({ courseTitle }: { courseTitle: string }) {
  const startedAt = useFormStart();
  const captcha = useTurnstile();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<CourseEnrollmentInput>({
    resolver: zodResolver(courseEnrollmentSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      company: '',
      subject: '',
      message: '',
      consent: undefined as unknown as true,
      website: '',
      inquiryType: 'I want to enroll',
      background: '',
    },
  });
  const { register, handleSubmit, control, formState } = form;
  const errors = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const message = [
      `Course: ${courseTitle}`,
      `Enquiry type: ${values.inquiryType}`,
      `Current education or experience: ${values.background || 'Not provided'}`,
      '',
      'Message:',
      values.message,
    ].join('\n');

    try {
      const result = await api<{ message: string }>('/contact', {
        method: 'POST',
        body: {
          name: values.name,
          email: values.email,
          phone: values.phone,
          subject: `Course enrollment: ${courseTitle}`,
          message,
          consent: values.consent,
          website: values.website,
          formStartedAt: startedAt.current,
          turnstileToken: captcha.token,
        },
      });
      setDone(result.message);
    } catch (e) {
      setError(applyServerErrors(e, form.setError, FIELDS));
      captcha.reset();
    }
  });

  if (done) return <FormSuccess title="Enrollment enquiry sent" message={done} />;

  return (
    <form onSubmit={onSubmit} noValidate className="relative space-y-5" aria-label={`Enquire about ${courseTitle}`}>
      <Honeypot register={register('website')} />
      <p className="rounded-lg bg-surface px-4 py-3 text-sm text-muted-ink">
        Course of interest: <span className="font-semibold text-ink">{courseTitle}</span>
      </p>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="course-enquiry-name" label="Full name" required error={errors.name?.message}>
          <Input autoComplete="name" {...register('name')} />
        </Field>
        <Field id="course-enquiry-email" label="Email" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" {...register('email')} />
        </Field>
        <Field id="course-enquiry-phone" label="Phone number" required hint="Include your country code" error={errors.phone?.message}>
          <Input type="tel" autoComplete="tel" placeholder="+977" {...register('phone')} />
        </Field>
        <Field id="course-enquiry-type" label="How can we help?" required error={errors.inquiryType?.message}>
          <NativeSelect {...register('inquiryType')}>
            <option value="I want to enroll">I want to enroll</option>
            <option value="I want course details">I want course details</option>
            <option value="I have another question">I have another question</option>
          </NativeSelect>
        </Field>
      </div>
      <Field id="course-enquiry-background" label="Education or experience" hint="Optional — helps us recommend the right starting point" error={errors.background?.message}>
        <Input {...register('background')} />
      </Field>
      <Field id="course-enquiry-message" label="Your message" required hint="Ask about enrollment, schedule, fees, or course content." error={errors.message?.message}>
        <Textarea rows={5} {...register('message')} />
      </Field>
      <div>
        <div className="flex items-start gap-3">
          <Controller
            control={control}
            name="consent"
            render={({ field }) => (
              <Checkbox
                id="course-enquiry-consent"
                checked={field.value === true}
                onCheckedChange={(value) => field.onChange(value === true ? true : undefined)}
                aria-invalid={errors.consent ? true : undefined}
                aria-describedby={errors.consent ? 'course-enquiry-consent-error' : undefined}
                className="mt-0.5"
              />
            )}
          />
          <label htmlFor="course-enquiry-consent" className="text-sm text-slate-700">
            I agree that my details will be used to respond to my course enquiry, as described in the{' '}
            <Link href="/privacy-policy" className="font-medium text-brand underline-offset-2 hover:underline">
              privacy policy
            </Link>
            .
          </label>
        </div>
        {errors.consent && (
          <p id="course-enquiry-consent-error" role="alert" className="mt-1.5 text-xs font-medium text-destructive">
            {errors.consent.message}
          </p>
        )}
      </div>
      {captcha.widget}
      <FormError message={error} />
      <Button type="submit" size="lg" variant="accent" loading={formState.isSubmitting} disabled={captcha.enabled && !captcha.token} className="w-full">
        Send enrollment enquiry
      </Button>
    </form>
  );
}
