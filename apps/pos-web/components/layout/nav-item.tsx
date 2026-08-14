'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const spring = { type: 'spring' as const, stiffness: 100, damping: 20 };

export function NavItem({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors min-h-[42px]',
        active ? 'text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          transition={spring}
          className="absolute inset-0 rounded-xl bg-primary"
          aria-hidden
        />
      )}
      <Icon
        strokeWidth={1.5}
        className={cn('relative h-[18px] w-[18px] shrink-0', active ? 'text-primary-foreground' : 'text-muted-foreground')}
      />
      <span className="relative font-medium tracking-tight">{label}</span>
    </Link>
  );
}
