import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/admin/auth-forms';

export const metadata: Metadata = { title: 'Reset password' };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
