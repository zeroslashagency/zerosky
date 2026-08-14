'use client';

import { memo, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };

// ── Perpetual pulse dot — isolated, memoized, no parent re-render §9 B
const PulseDot = memo(function PulseDot({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-flex h-2.5 w-2.5 shrink-0', className)} aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
    </span>
  );
});

// ── Bento frame
function BentoFrame({
  children,
  className,
  padding = 'p-8',
}: {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}) {
  return <div className={cn('bento-card', padding, className)}>{children}</div>;
}

export function SkeletonBento({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 w-full shimmer rounded-lg" style={{ width: `${88 - i * 12}%` }} />
      ))}
    </div>
  );
}

// ── Revenue hero — wide §9 C archetype 4
export function RevenueBento({
  value,
  loading,
  icon: Icon,
}: {
  value: string;
  loading?: boolean;
  icon: LucideIcon;
}) {
  return (
    <BentoFrame>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">REVENUE TODAY</p>
          {loading ? (
            <div className="mt-3 h-8 w-36 shimmer rounded-lg" />
          ) : (
            <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-foreground md:text-4xl">{value}</p>
          )}
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Gross sales · India GST separated at billing</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/50">
          <Icon strokeWidth={1.5} className="h-5 w-5 text-muted-foreground" />
        </span>
      </div>
      {/* Seamless data stream — thin marquee like §9 archetype 4 */}
      <div className="mt-6 overflow-hidden rounded-full border border-border bg-muted/40">
        <motion.div
          className="flex gap-1.5 whitespace-nowrap py-1.5 pl-3 text-[11px] font-medium tracking-wide text-muted-foreground"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          aria-hidden
        >
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k} className="flex gap-1.5">
              <span className="rounded-full bg-card px-2.5 py-1">UPI 47.2%</span>
              <span className="rounded-full bg-card px-2.5 py-1">Cash 31%</span>
              <span className="rounded-full bg-card px-2.5 py-1">Card 21.8%</span>
              <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-white">GST pooled</span>
            </span>
          ))}
        </motion.div>
      </div>
    </BentoFrame>
  );
}

export function StatBento({
  title,
  value,
  note,
  loading,
  icon: Icon,
}: {
  title: string;
  value: string;
  note: string;
  loading?: boolean;
  icon: LucideIcon;
}) {
  return (
    <BentoFrame className="flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">{title.toUpperCase()}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40">
          <Icon strokeWidth={1.5} className="h-4 w-4 text-muted-foreground" />
        </span>
      </div>
      {loading ? <div className="mt-3 h-7 w-20 shimmer rounded-lg" /> : <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-foreground">{value}</p>}
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </BentoFrame>
  );
}

// Live floor — breathing + notification pop (§9 archetype 3)
export function FloorBento({
  occupied,
  total,
  loading,
}: {
  occupied: number;
  total: number;
  loading?: boolean;
}) {
  const [showBadge, setShowBadge] = useState(false);
  useEffect(() => {
    const t = setInterval(() => {
      setShowBadge(true);
      setTimeout(() => setShowBadge(false), 3000);
    }, 7000);
    return () => clearInterval(t);
  }, []);
  return (
    <BentoFrame className="relative overflow-hidden">
      <div className="flex items-center gap-2">
        <PulseDot />
        <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">FLOOR · LIVE</p>
      </div>
      {loading ? <div className="mt-4 h-8 w-24 shimmer rounded-lg" /> : <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-foreground">{occupied}/{total}</p>}
      <p className="mt-1 text-xs text-muted-foreground">Tables occupied</p>
      <AnimatePresence>
        {showBadge && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={spring}
            className="absolute right-4 top-4 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white shadow"
          >
            Fire: table run
          </motion.div>
        )}
      </AnimatePresence>
    </BentoFrame>
  );
}

export function QuickActionsBento() {
  const actions = [
    { label: 'New order', href: '/orders/create', sub: 'Dine-in / takeaway' },
    { label: 'Menu', href: '/menu', sub: 'Categories · modifiers' },
    { label: 'Billing', href: '/billing', sub: 'Queue · split' },
    { label: 'Kitchen', href: '/kitchen', sub: 'KDS display' },
  ];
  return (
    <div className="rounded-[2.5rem] border border-border/50 bg-card p-2">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group flex flex-col rounded-[1.75rem] bg-muted/40 px-5 py-5 transition-colors hover:bg-muted active:scale-[0.98]"
          >
            <span className="text-sm font-semibold tracking-tight text-foreground">{a.label}</span>
            <span className="mt-1 text-xs text-muted-foreground">{a.sub}</span>
            <span className="mt-3 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">Open →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
