import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SetPasswordForm } from '@/components/admin/auth-forms';

export const metadata: Metadata = { title: 'Choose a new password' };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordForm mode="reset" />
    </Suspense>
  );
}
