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
    if (pin.length < 6) {
      setPin(pin + num);
      setError('');
    }
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleSubmit = () => {
    if (pin.length >= 4) {
      loginMutation.mutate({ pin, tenantSlug: TENANT_SLUG });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <ChefHat className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Kitchen Display</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter your PIN to continue</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-lg">
          {/* PIN Display */}
          <div className="mb-6 flex justify-center gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border bg-background"
              >
                {i < pin.length && (
                  <div className="h-3 w-3 rounded-full bg-foreground" />
                )}
              </div>
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
              <button
                key={num}
                onClick={() => handleNumberClick(num)}
                disabled={loginMutation.isPending}
                className="flex h-16 items-center justify-center rounded-lg border border-border bg-background text-2xl font-semibold text-foreground transition-colors hover:bg-muted active:scale-95 disabled:opacity-50"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              disabled={loginMutation.isPending}
              className="flex h-16 items-center justify-center rounded-lg border border-border bg-background text-sm font-medium text-muted-foreground transition-colors hover:bg-muted active:scale-95 disabled:opacity-50"
            >
              Clear
            </button>
            <button
              onClick={() => handleNumberClick('0')}
              disabled={loginMutation.isPending}
              className="flex h-16 items-center justify-center rounded-lg border border-border bg-background text-2xl font-semibold text-foreground transition-colors hover:bg-muted active:scale-95 disabled:opacity-50"
            >
              0
            </button>
            <button
              onClick={handleSubmit}
              disabled={pin.length < 4 || loginMutation.isPending}
              className="flex h-16 items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-95 disabled:opacity-50"
            >
              {loginMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Enter'
              )}
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
