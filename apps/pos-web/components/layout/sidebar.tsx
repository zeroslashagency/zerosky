'use client';

import Link from 'next/link';
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
import { cn } from '@/lib/utils';
import { useAuth, type Role } from '@/lib/auth-context';
import { X } from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: any;
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
  const { logout, user, hasMinRole, can, hasRole } = useAuth();

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
    const Icon = item.icon;
    const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors min-h-[44px]',
          isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="font-medium">{item.name}</span>
      </Link>
    );
  });

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card text-card-foreground lg:flex h-full">
        <div className="p-4 border-b border-border">
          <h1 className="text-2xl font-bold text-card-foreground">Zerosky POS</h1>
          <p className="text-sm text-muted-foreground">Restaurant Management</p>
          {user && (
            <div className="mt-2 text-xs">
              <p className="font-medium text-card-foreground">{user.name}</p>
              <p className="text-muted-foreground">{user.role}</p>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">{nav}</nav>
        <div className="p-4 border-t border-border">
          <button
            onClick={logout}
            className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-4 py-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Logout</span>
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
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h1 className="text-xl font-bold text-card-foreground">Zerosky POS</h1>
                {user && <p className="text-xs text-muted-foreground">{user.name} · {user.role}</p>}
              </div>
              <button
                aria-label="Close menu"
                onClick={onClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 space-y-2">{nav}</nav>
            <div className="border-t border-border p-4 pb-safe">
              <button
                onClick={logout}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-4 py-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-5 w-5" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
