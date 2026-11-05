'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { checkPasswordStrength, forgotPasswordSchema, loginSchema, resetPasswordSchema, type ForgotPasswordInput, type LoginInput, type ResetPasswordInput } from '@asva/shared';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { Alert } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/api/client';

/** Only allow same-site relative redirects after login (prevents open redirects). */
function safeNext(next: string | null): string {
  return next && next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin';
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const { register, handleSubmit, formState } = form;

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const user = await api('/auth/login', { method: 'POST', body: values, noRefresh: true });
      queryClient.setQueryData(['me'], user);
      router.replace(safeNext(params.get('next')));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unable to reach the server. Please try again.');
    }
  });

  return (
    <>
      <h1 className="text-xl font-semibold">Sign in to the CMS</h1>
      <p className="mt-1 text-sm text-muted-foreground">Use your Asva Innovation Lab admin account.</p>
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <Field id="login-email" label="Email" error={formState.errors.email?.message}>
          <Input type="email" autoComplete="username" autoFocus {...register('email')} />
        </Field>
        <Field id="login-password" label="Password" error={formState.errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register('password')} />
        </Field>
        {error && <Alert variant="error">{error}</Alert>}
        <Button type="submit" className="w-full" size="lg" loading={formState.isSubmitting}>
          Sign in
        </Button>
        <p className="text-center text-sm">
          <Link href="/admin/forgot-password" className="text-primary hover:underline">
            Forgot your password?
          </Link>
        </p>
      </form>
    </>
  );
}

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });
  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const r = await api<{ message: string }>('/auth/forgot-password', { method: 'POST', body: values, noRefresh: true });
      setMessage(r.message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unable to reach the server.');
    }
  });
  return (
    <>
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <p className="mt-1 text-sm text-muted-foreground">We will email you a single-use link that expires in 30 minutes.</p>
      {message ? (
        <Alert variant="success" className="mt-6">
          {message}
        </Alert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          <Field id="fp-email" label="Email" error={form.formState.errors.email?.message}>
            <Input type="email" autoComplete="email" autoFocus {...form.register('email')} />
          </Field>
          {error && <Alert variant="error">{error}</Alert>}
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/admin/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}

export function SetPasswordForm({ mode }: { mode: 'reset' | 'invite' }) {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { token, password: '', confirmPassword: '' } });
  const password = form.watch('password');
  const problems = password ? checkPasswordStrength(password) : [];

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      const r = await api<{ message: string }>(mode === 'invite' ? '/auth/accept-invite' : '/auth/reset-password', { method: 'POST', body: values, noRefresh: true });
      setDone(r.message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unable to reach the server.');
    }
  });

  if (!token) return <Alert variant="error">This link is missing its token. Please use the full link from your email.</Alert>;
  return (
    <>
      <h1 className="text-xl font-semibold">{mode === 'invite' ? 'Set up your account' : 'Choose a new password'}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Use at least 12 characters with a mix of letters, numbers and symbols.</p>
      {done ? (
        <div className="mt-6 space-y-4">
          <Alert variant="success">{done}</Alert>
          <Button asChild className="w-full">
            <Link href="/admin/login">Sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          <Field id="sp-password" label="New password" error={form.formState.errors.password?.message}>
            <Input type="password" autoComplete="new-password" autoFocus {...form.register('password')} />
          </Field>
          {password && (
            <ul className="space-y-1 text-xs" aria-live="polite">
              {problems.length === 0 ? <li className="text-success">✓ Strong password</li> : problems.map((p) => <li key={p} className="text-muted-foreground">• {p}</li>)}
            </ul>
          )}
          <Field id="sp-confirm" label="Confirm password" error={form.formState.errors.confirmPassword?.message}>
            <Input type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
          </Field>
          {error && <Alert variant="error">{error}</Alert>}
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
            {mode === 'invite' ? 'Create account' : 'Update password'}
          </Button>
        </form>
      )}
    </>
  );
}
