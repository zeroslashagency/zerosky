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
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth, type Role } from '@/lib/auth-context';

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

export function Sidebar() {
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

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col h-full">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold">Zerosky POS</h1>
        <p className="text-sm text-gray-400">Restaurant Management</p>
        {user && (
          <div className="mt-2 text-xs text-gray-500">
            <p className="font-medium text-gray-300">{user.name}</p>
            <p className="text-gray-500">{user.role}</p>
          </div>
        )}
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {navItems.filter(isNavItemVisible).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
