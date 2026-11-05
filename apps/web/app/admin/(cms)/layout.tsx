import { AuthGate } from '@/components/admin/auth';
import { AdminShell } from '@/components/admin/shell';

export default function CmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AdminShell>{children}</AdminShell>
    </AuthGate>
  );
}
