'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, ShieldAlert } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect } from 'react';
import { hasPermission, type AuthUser, type PermissionKey } from '@asva/shared';
import { api, ApiError } from '@/lib/api/client';

interface AuthContextValue {
  user: AuthUser;
  can: (permission: PermissionKey | PermissionKey[]) => boolean;
  canAny: (permissions: PermissionKey[]) => boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthGate>');
  return ctx;
}

/** Loads the signed-in user; redirects to login when the session is missing or expired. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: user, error, isLoading } = useQuery({ queryKey: ['me'], queryFn: () => api<AuthUser>('/auth/me'), staleTime: 60_000 });

  const toLogin = useCallback(() => {
    queryClient.clear();
    document.cookie = 'asva_session=; Max-Age=0; Path=/';
    router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
  }, [pathname, queryClient, router]);

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) toLogin();
  }, [error, toLogin]);

  useEffect(() => {
    window.addEventListener('asva:unauthenticated', toLogin);
    return () => window.removeEventListener('asva:unauthenticated', toLogin);
  }, [toLogin]);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST', noRefresh: true }).catch(() => undefined);
    queryClient.clear();
    router.replace('/admin/login');
  }, [queryClient, router]);

  if (isLoading || (error instanceof ApiError && error.status === 401)) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface" role="status">
        <Loader2 className="size-6 animate-spin text-brand" aria-hidden />
        <span className="sr-only">Loading admin…</span>
      </div>
    );
  }
  if (error || !user) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface p-6 text-center">
        <div>
          <ShieldAlert className="mx-auto size-8 text-destructive" aria-hidden />
          <p className="mt-3 font-semibold">The admin service is unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">{error instanceof ApiError ? error.message : 'Please try again in a moment.'}</p>
        </div>
      </div>
    );
  }

  const value: AuthContextValue = {
    user,
    can: (p) => hasPermission(user.permissions, p),
    canAny: (ps) => ps.some((p) => user.permissions.includes(p)),
    logout,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Client-side guard for UX only — the API enforces the same permission. */
export function RequirePermission({ permission, children }: { permission: PermissionKey | PermissionKey[]; children: React.ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <ShieldAlert className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <p className="mt-3 font-semibold">You don’t have access to this section</p>
        <p className="mt-1 text-sm text-muted-foreground">Ask an administrator if you need this permission.</p>
      </div>
    );
  }
  return <>{children}</>;
}
