'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingCart,
  TableProperties,
  Receipt,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

const primaryNav = [
  { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Menu', href: '/menu', icon: UtensilsCrossed, permission: 'view_menu' },
  { name: 'Orders', href: '/orders', icon: ShoppingCart, permission: 'view_orders' },
  { name: 'Tables', href: '/tables', icon: TableProperties },
  { name: 'Billing', href: '/billing', icon: Receipt, minRole: 'CASHIER' as const },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { hasMinRole, can } = useAuth();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- primaryNav is heterogeneous const tuple; filter narrows safely
  const visible = primaryNav.filter((item: any) => {
    if (item.minRole && !hasMinRole(item.minRole)) return false;
    if (item.permission && !can(item.permission)) return false;
    return true;
  });

  // Cap at 5 to keep tap targets ≥44px and avoid crowding (iOS HIG).
  const items = visible.slice(0, 5);

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-3 left-3 right-3 z-40 flex items-center justify-around gap-1 rounded-full border border-white/10 bg-card/95 px-2 py-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.2)] backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center gap-1 rounded-full py-2 text-[11px] font-medium leading-none transition-colors min-h-[44px] active:scale-[0.98]',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {active && <span className="absolute inset-0 rounded-full bg-primary/10" aria-hidden />}
            <Icon strokeWidth={1.5} className={cn('relative h-5 w-5', active && 'text-primary')} />
            <span className="relative max-w-full truncate px-1">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
