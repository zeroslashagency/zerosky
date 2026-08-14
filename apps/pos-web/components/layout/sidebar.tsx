'use client';

import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  ShoppingCart, 
  TableProperties,
  ChefHat,
  Receipt,
  Settings,
  LogOut,
  Users,
  Package,
  BarChart3,
  Handshake,
  Banknote
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth, type Role } from '@/lib/auth-context';
import { X } from 'lucide-react';
import { NavItem } from './nav-item';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  minRole?: Role;
  permission?: string;
  roles?: Role[];
}

const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Menu',
    href: '/menu',
    icon: UtensilsCrossed,
    permission: 'view_menu',
  },
  {
    name: 'Orders',
    href: '/orders',
    icon: ShoppingCart,
    permission: 'view_orders',
  },
  {
    name: 'Tables',
    href: '/tables',
    icon: TableProperties,
    minRole: 'WAITER',
  },
  {
    name: 'Kitchen',
    href: '/kitchen',
    icon: ChefHat,
    roles: ['KITCHEN', 'MANAGER', 'OWNER'],
  },
  {
    name: 'Billing',
    href: '/billing',
    icon: Receipt,
    minRole: 'CASHIER',
  },
  {
    name: 'Shift',
    href: '/shift',
    icon: Banknote,
    minRole: 'CASHIER',
  },
  {
    name: 'Inventory',
    href: '/inventory',
    icon: Package,
    minRole: 'MANAGER',
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: BarChart3,
    permission: 'view_reports',
  },
  {
    name: 'Partners',
    href: '/partners',
    icon: Handshake,
    minRole: 'OWNER',
  },
  {
    name: 'Staff',
    href: '/staff',
    icon: Users,
    minRole: 'MANAGER',
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    minRole: 'MANAGER',
  },
];

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void } = {}) {
  const pathname = usePathname();
  const { logout, user, hasMinRole, can } = useAuth();

  const isNavItemVisible = (item: NavItem): boolean => {
    if (!user) return false;

    // Check role-specific access
    if (item.roles && !item.roles.includes(user.role)) {
      return false;
    }

    // Check minimum role
    if (item.minRole && !hasMinRole(item.minRole)) {
      return false;
    }

    // Check permission
    if (item.permission && !can(item.permission)) {
      return false;
    }

    return true;
  };

  const nav = navItems.filter(isNavItemVisible).map((item) => {
    const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
    return (
      <NavItem
        key={item.href}
        href={item.href}
        label={item.name}
        icon={item.icon}
        active={Boolean(isActive)}
        onClick={onClose}
      />
    );
  });

  return (
    <>
      {/* Desktop sidebar — §3 R4: divide-y not cards, tapered density */}
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-border/60 bg-card/80 backdrop-blur-xl text-card-foreground lg:flex h-full">
        <div className="px-5 pb-4 pt-6">
          <h1 className="text-[15px] font-semibold tracking-tight text-card-foreground">Zerosky</h1>
          <p className="text-xs tracking-wide text-muted-foreground">POS — Restaurant</p>
          {user && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/40 px-3 py-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {user.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium leading-none text-card-foreground">{user.name}</p>
                <p className="text-[11px] leading-none text-muted-foreground">{user.role}</p>
              </div>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">{nav}</nav>
        <div className="border-t border-border/60 p-3">
          <button
            onClick={logout}
            className="flex min-h-[42px] w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.98]"
          >
            <LogOut strokeWidth={1.5} className="h-[18px] w-[18px]" />
            <span className="font-medium tracking-tight">Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <>
          <button
            aria-label="Close navigation"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-[84vw] max-w-[320px] flex-col border-r border-border bg-card text-card-foreground shadow-xl lg:hidden">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <div>
                <h1 className="text-sm font-semibold tracking-tight text-card-foreground">Zerosky</h1>
                {user && <p className="text-xs text-muted-foreground">{user.name} · {user.role}</p>}
              </div>
              <button
                aria-label="Close menu"
                onClick={onClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border hover:bg-muted"
              >
                <X strokeWidth={1.5} className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">{nav}</nav>
            <div className="border-t border-border/60 p-3 pb-safe">
              <button
                onClick={logout}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.98]"
              >
                <LogOut strokeWidth={1.5} className="h-[18px] w-[18px]" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
