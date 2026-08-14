'use client';

import {
  Settings as SettingsIcon,
  Building2,
  User as UserIcon,
  Palette as PaletteIcon,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { useBranch } from '@/hooks/use-branch';
import { useTheme } from '@/components/theme/theme-provider';
import { PalettePicker } from '@/components/theme/palette-picker';

type Mode = 'light' | 'dark' | 'system';

const MODE_OPTIONS: { value: Mode; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** Accessible segmented control for the light / dark / system mode. */
function ModeSegmentedControl() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour mode"
      className="inline-flex rounded-lg border border-border bg-muted p-1"
    >
      {MODE_OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={[
              'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted',
              active
                ? 'bg-card text-card-foreground shadow-sm'
                : 'text-muted-foreground hover:text-card-foreground',
            ].join(' ')}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Small live preview so palette/mode changes are obviously landing. */
function AppearancePreview() {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Table 12</span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
          Open
        </span>
      </div>
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Paneer Tikka</dt>
          <dd className="text-foreground">₹320</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Butter Naan × 2</dt>
          <dd className="text-foreground">₹120</dd>
        </div>
      </dl>
      <div className="my-3 h-px bg-border" />
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Total</span>
        <span className="text-base font-bold text-primary">₹440</span>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Charge
        </button>
        <button
          type="button"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Hold
        </button>
      </div>
    </div>
  );
}

/**
 * Settings shows the resolved tenant, branch and session identity, plus an
 * Appearance section for choosing colour mode and palette. Organisation and
 * session details remain read-only.
 */
export default function SettingsPage() {
  const { user } = useAuth();
  const { branchName, branchId } = useBranch();
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: 1 });

  const tenant = meQuery.data?.tenant;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold text-foreground">
          <SettingsIcon className="h-6 w-6 sm:h-7 sm:w-7" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">Appearance, session and organisation details</p>
      </div>

      <section className="mb-6 rounded-lg border border-border bg-card p-4 sm:p-6">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-card-foreground">
          <PaletteIcon className="h-5 w-5 text-muted-foreground" />
          Appearance
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Personalise how Zerosky looks. Changes apply instantly and are saved to this device.
        </p>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-8">
            <div>
              <h3 className="mb-3 text-sm font-medium text-card-foreground">Mode</h3>
              <ModeSegmentedControl />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-medium text-card-foreground">Palette</h3>
              <PalettePicker />
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-medium text-card-foreground">Preview</h3>
            <AppearancePreview />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border p-5 bg-card">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-card-foreground">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            Organisation
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Tenant</dt>
              <dd className="font-medium text-card-foreground">{tenant?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Slug</dt>
              <dd className="font-mono text-xs text-card-foreground">{tenant?.slug ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Active branch</dt>
              <dd className="font-medium text-card-foreground">{branchName ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Branch ID</dt>
              <dd className="font-mono text-xs break-all text-card-foreground">{branchId ?? '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-border p-5 bg-card">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-card-foreground">
            <UserIcon className="h-5 w-5 text-muted-foreground" />
            Signed in as
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium text-card-foreground">{user?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-card-foreground">{user?.email ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-semibold text-card-foreground">{user?.role ?? '—'}</dd>
            </div>
          </dl>
        </section>
      </div>

      <p className="mt-6 rounded-lg bg-amber-100 dark:bg-amber-950 p-4 text-sm text-amber-900 dark:text-amber-100">
        Editing organisation fields (tenant, branch) is not implemented yet — those values are
        read from the server so you can confirm which tenant and branch the session is scoped to.
        Appearance settings above are fully editable.
      </p>
    </div>
  );
}
