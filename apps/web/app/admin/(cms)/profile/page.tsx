'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { changePasswordSchema, type ChangePasswordInput } from '@asva/shared';
import { useAuth } from '@/components/admin/auth';
import { PageHeader } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { Alert, Badge, Card } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/api/client';
import { formatDateTime } from '@/lib/utils';

export default function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState(user.name);
  const [error, setError] = useState<string | null>(null);
  const updateName = useMutation({
    mutationFn: () => api('/auth/me', { method: 'PATCH', body: { name } }),
    onSuccess: (u) => {
      qc.setQueryData(['me'], u);
      toast.success('Profile updated');
    },
  });
  const form = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });
  const changePassword = useMutation({
    mutationFn: (v: ChangePasswordInput) => api('/auth/change-password', { method: 'POST', body: v }),
    onSuccess: () => {
      toast.success('Password changed. Your other sessions have been signed out.');
      form.reset();
      setError(null);
    },
    onError: (e) => {
      if (e instanceof ApiError) for (const d of e.details) form.setError(d.path === 'password' ? 'newPassword' : (d.path as keyof ChangePasswordInput), { message: d.message });
      setError(e instanceof ApiError ? e.message : 'Could not change password');
    },
  });

  return (
    <>
      <PageHeader title="My profile" description={user.email} />
      <div className="grid max-w-4xl gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <h2 className="font-semibold">Account</h2>
          <Field id="p-name" label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div>
            <p className="text-sm font-medium">Roles</p>
            <div className="mt-1 flex flex-wrap gap-1">{user.roles.map((r) => <Badge key={r.key} variant="secondary">{r.name}</Badge>)}</div>
          </div>
          <p className="text-xs text-muted-foreground">Last sign-in: {formatDateTime(user.lastLoginAt)}</p>
          <Button disabled={!name.trim() || name === user.name} loading={updateName.isPending} onClick={() => updateName.mutate()}>
            Save
          </Button>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">Change password</h2>
          <form className="mt-4 space-y-4" noValidate onSubmit={form.handleSubmit((v) => changePassword.mutate(v))}>
            <Field id="cp-current" label="Current password" error={form.formState.errors.currentPassword?.message}>
              <Input type="password" autoComplete="current-password" {...form.register('currentPassword')} />
            </Field>
            <Field id="cp-new" label="New password" hint="12+ characters, mixing letters, numbers and symbols" error={form.formState.errors.newPassword?.message}>
              <Input type="password" autoComplete="new-password" {...form.register('newPassword')} />
            </Field>
            <Field id="cp-confirm" label="Confirm new password" error={form.formState.errors.confirmPassword?.message}>
              <Input type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
            </Field>
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" loading={changePassword.isPending}>
              Change password
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
