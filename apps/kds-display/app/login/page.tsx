'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChefHat, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';

const TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG ?? 'zerosky-demo';

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const loginMutation = trpc.auth.pinLogin.useMutation({
    onSuccess: async (data) => {
      // The token goes into an httpOnly cookie written by the server. It is
      // deliberately NOT stored in localStorage, where any injected script
      // could read it. Awaited before navigating: the middleware gates on that
      // cookie, so redirecting early bounces straight back to /login.
      try {
        await writeSessionCookies({
          token: data.token,
          refreshToken: data.refreshToken,
        });
      } catch {
        setError('Could not start your session. Please try again.');
        setPin('');
        return;
      }

      // Profile only — no credentials.
      localStorage.setItem('auth_user', JSON.stringify(data.user));

      router.push('/');
    },
    onError: (err) => {
      setError(err.message);
      setPin('');
    },
  });

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      const next = pin + num;
      setPin(next);
      setError('');
      if (next.length === 4) loginMutation.mutate({ pin: next, tenantSlug: TENANT_SLUG });
    }
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleSubmit = () => {
    if (pin.length === 4) loginMutation.mutate({ pin, tenantSlug: TENANT_SLUG });
  };

  const filled = pin.length;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
            <ChefHat className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Kitchen Display</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter your 4-digit PIN to continue</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl">
          {/* PIN Display */}
          <div className="mb-2 flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`flex h-14 w-14 items-center justify-center rounded-xl border-2 bg-background shadow-sm transition-all ${i < pin.length ? 'border-primary bg-primary/5' : 'border-border'}`}>
                {i < pin.length && <div className="h-3.5 w-3.5 rounded-full bg-primary shadow-sm" />}
              </div>
            ))}
          </div>
          <div className="mb-6 flex justify-center gap-1.5" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-1.5 w-8 rounded-full transition-colors ${i < filled ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-center text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button key={num} onClick={() => handleNumberClick(num)} disabled={loginMutation.isPending || pin.length >= 4} className="flex h-14 sm:h-16 items-center justify-center rounded-xl border border-border bg-background text-2xl font-semibold text-foreground shadow-sm transition-all hover:bg-muted active:scale-[0.97] disabled:opacity-40">
                {num}
              </button>
            ))}
            <button onClick={handleClear} disabled={loginMutation.isPending} className="flex h-14 sm:h-16 items-center justify-center rounded-xl border border-border bg-background text-sm font-semibold text-muted-foreground shadow-sm transition-all hover:bg-muted active:scale-[0.97] disabled:opacity-40">Clear</button>
            <button onClick={() => handleNumberClick('0')} disabled={loginMutation.isPending || pin.length >= 4} className="flex h-14 sm:h-16 items-center justify-center rounded-xl border border-border bg-background text-2xl font-semibold text-foreground shadow-sm transition-all hover:bg-muted active:scale-[0.97] disabled:opacity-40">0</button>
            <button onClick={handleSubmit} disabled={pin.length !== 4 || loginMutation.isPending} className="flex h-14 sm:h-16 items-center justify-center rounded-xl bg-primary text-sm font-bold tracking-wide text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.97] disabled:opacity-40">
              {loginMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enter'}
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Kitchen staff PIN required
        </p>
      </div>
    </div>
  );
}

/**
 * Hand the issued tokens to the server, which writes them as httpOnly cookies.
 *
 * Kitchen tablets stay signed in for a full shift (2 hours), longer than
 * pos-web's 15 minutes: unattended screens should not time out mid-service.
 * The cookie Max-Age lives in app/api/auth/session/route.ts.
 *
 * The token is now a signed, Redis-backed session token rather than the raw
 * user id, so the longer window is revocable and expires on its own.
 */
async function writeSessionCookies(tokens: {
  token: string;
  refreshToken?: string;
}): Promise<void> {
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(tokens),
  });
  if (!res.ok) {
    throw new Error('Could not establish session');
  }
}
