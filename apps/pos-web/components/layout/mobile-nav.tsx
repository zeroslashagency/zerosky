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
      className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-card pb-safe lg:hidden"
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
              'flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium leading-none transition-colors min-h-[52px]',
              active ? 'text-primary' : 'text-muted-foreground active:text-foreground',
            )}
          >
            <Icon className={cn('h-5 w-5', active && 'text-primary')} />
            <span className="max-w-full truncate px-1">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
