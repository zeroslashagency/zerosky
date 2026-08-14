'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@zerosky/ui';

/**
 * Tenant this POS terminal belongs to. A terminal is installed for one
 * restaurant, so the slug is deployment configuration rather than user input.
 * Previously hardcoded to 'default', which does not exist and made every login
 * fail with "Invalid tenant."
 */
const TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG ?? 'zerosky-demo';

function LoginPageContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [showPinLogin, setShowPinLogin] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      try {
        // Awaited: the httpOnly cookie must exist before we navigate, or the
        // middleware bounces the redirect straight back to /login.
        await login(
          { token: data.token, refreshToken: data.refreshToken },
          data.user as any,
        );
      } catch {
        setErrors({ general: 'Could not start your session. Please try again.' });
        return;
      }
      const redirect = searchParams.get('redirect') || '/dashboard';
      router.push(redirect);
    },
    onError: (error) => {
      setErrors({ general: error.message || 'Login failed. Please check your credentials.' });
    },
  });

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};
    
    // Email validation
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Password validation
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    if (!validateForm()) {
      return;
    }
    
    loginMutation.mutate({ 
      email: email.trim().toLowerCase(), 
      password,
      tenantSlug: TENANT_SLUG
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="bg-card p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-card-foreground">Zerosky POS</h1>
          <p className="text-muted-foreground mt-2">
            {showPinLogin ? 'Quick PIN Login' : 'Sign in to your account'}
          </p>
        </div>

        {!showPinLogin ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.general && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm" role="alert">
                {errors.general}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-card-foreground mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: undefined });
                }}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={`w-full px-4 py-2 border ${errors.email ? 'border-destructive' : 'border-input'} rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors bg-background text-foreground`}
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-card-foreground mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors({ ...errors, password: undefined });
                }}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                className={`w-full px-4 py-2 border ${errors.password ? 'border-destructive' : 'border-input'} rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition-colors bg-background text-foreground`}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              {errors.password && (
                <p id="password-error" className="mt-1 text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full"
            >
              {loginMutation.isPending ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </Button>
          </form>
        ) : (
          <PinLoginForm onBack={() => setShowPinLogin(false)} />
        )}

        <div className="mt-6 text-center space-y-3">
          <button
            type="button"
            onClick={() => setShowPinLogin(!showPinLogin)}
            className="text-sm text-primary hover:text-primary/80 font-medium"
          >
            {showPinLogin ? '← Back to Email Login' : 'Quick PIN Login →'}
          </button>
          
          {!showPinLogin && (
            <p className="text-xs text-muted-foreground">
              Demo: owner@zerosky.dev / zerosky123 · PIN 1111
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PinLoginForm({ onBack }: { onBack: () => void }) {
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  
  const pinLoginMutation = trpc.auth.pinLogin.useMutation({
    onSuccess: async (data) => {
      try {
        await login(
          { token: data.token, refreshToken: data.refreshToken },
          data.user as any,
        );
      } catch {
        setError('Could not start your session. Please try again.');
        return;
      }
      const redirect = searchParams.get('redirect') || '/dashboard';
      router.push(redirect);
    },
    onError: (error) => {
      setError(error.message || 'Invalid PIN');
      setPin(['', '', '', '', '', '']);
      document.getElementById('pin-0')?.focus();
    },
  });

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError('');
    
    // Auto-advance to next field
    if (value && index < 5) {
      document.getElementById(`pin-${index + 1}`)?.focus();
    }
    
    // Auto-submit when 6 digits entered
    const pinString = newPin.join('');
    if (pinString.length >= 4 && newPin.slice(0, pinString.length).every(d => d)) {
      pinLoginMutation.mutate({
        pin: pinString.slice(0, 6),
        tenantSlug: TENANT_SLUG
      });
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      document.getElementById(`pin-${index - 1}`)?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      document.getElementById(`pin-${index - 1}`)?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      document.getElementById(`pin-${index + 1}`)?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newPin = [...pin];
    for (let i = 0; i < pastedData.length; i++) {
      newPin[i] = pastedData[i];
    }
    setPin(newPin);
    
    if (pastedData.length >= 4) {
      pinLoginMutation.mutate({
        pin: pastedData.slice(0, 6),
        tenantSlug: TENANT_SLUG
      });
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm" role="alert">
          {error}
        </div>
      )}
      
      <div>
        <label className="block text-sm font-medium text-card-foreground mb-3 text-center">
          Enter your PIN (4-6 digits)
        </label>
        <div className="flex justify-center gap-2" onPaste={handlePaste}>
          {pin.map((digit, index) => (
            <input
              key={index}
              id={`pin-${index}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handlePinChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={pinLoginMutation.isPending}
              className="w-12 h-14 text-center text-2xl font-bold border-2 border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-ring disabled:bg-muted bg-background text-foreground"
              autoFocus={index === 0}
              aria-label={`PIN digit ${index + 1}`}
            />
          ))}
        </div>
      </div>
      
      {pinLoginMutation.isPending && (
        <div className="text-center text-sm text-muted-foreground">
          <svg className="animate-spin inline-block mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Verifying PIN...
        </div>
      )}
      
      <p className="text-xs text-muted-foreground text-center">
        Demo PINs: 1111 owner · 2222 manager · 3333 cashier · 4444 waiter · 5555 kitchen
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
        <div className="bg-card p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-md">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
