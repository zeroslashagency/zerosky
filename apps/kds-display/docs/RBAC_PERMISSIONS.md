# Role-Based Access Control (RBAC) Documentation

## Overview
Zerosky POS implements a hierarchical role-based access control system with 5 distinct roles.

## Role Hierarchy
From lowest to highest privilege:

1. **KITCHEN** (Level 1) - Kitchen staff
2. **WAITER** (Level 2) - Wait staff/servers
3. **CASHIER** (Level 3) - Cashiers/billing staff
4. **MANAGER** (Level 4) - Restaurant managers
5. **OWNER** (Level 5) - Restaurant owners (full access)

Higher roles inherit all permissions from lower roles.

## Role Permissions

### OWNER (Level 5)
**Full Access** - All permissions (`*`)
- Complete system access
- Staff management
- Financial reports
- System settings
- All lower-level permissions

### MANAGER (Level 4)
- `view_reports` - Access business reports
- `manage_menu` - Create/edit/delete menu items
- `manage_tables` - Configure tables and seating
- `manage_staff` - Add/edit staff members
- `view_orders` - View all orders
- `manage_orders` - Edit and manage orders

**UI Access:**
- Dashboard
- Menu (full edit)
- Orders (full control)
- Tables (full control)
- Billing
- Staff management
- Settings

### CASHIER (Level 3)
- `view_orders` - View order list
- `manage_orders` - Update order status
- `process_payments` - Handle billing and payments
- `view_menu` - View menu (read-only)

**UI Access:**
- Dashboard
- Menu (view only)
- Orders (view and update)
- Billing (full access)

### WAITER (Level 2)
- `view_orders` - View orders
- `create_orders` - Create new orders
- `view_menu` - View menu items
- `view_tables` - See table assignments

**UI Access:**
- Dashboard
- Menu (view only)
- Orders (create and view)
- Tables (view and assign)

### KITCHEN (Level 1)
- `view_orders` - View orders assigned to kitchen
- `update_order_status` - Update cooking status
- `view_kot` - View Kitchen Order Tickets

**UI Access:**
- Dashboard
- Kitchen view (KOT management)
- Orders (view only)

## Using RBAC in Code

### 1. useAuth Hook
```tsx
import { useAuth } from '@/lib/auth-context';

function MyComponent() {
  const { user, hasRole, hasMinRole, can, isOwner, isManager } = useAuth();
  
  // Check exact role
  if (hasRole('OWNER')) {
    // Owner-only logic
  }
  
  // Check minimum role level
  if (hasMinRole('MANAGER')) {
    // Manager or Owner can access
  }
  
  // Check permission
  if (can('manage_menu')) {
    // User has permission to manage menu
  }
  
  // Role shortcuts
  if (isOwner()) {
    // Owner-only
  }
}
```

### 2. RequireRole Component
```tsx
import { RequireRole } from '@/components/auth/require-role';

// Exact role match
<RequireRole role="OWNER">
  <OwnerOnlyFeature />
</RequireRole>

// Minimum role level
<RequireRole minRole="MANAGER">
  <ManagerFeature />
</RequireRole>

// Permission-based
<RequireRole permission="manage_menu">
  <MenuEditor />
</RequireRole>

// With fallback
<RequireRole minRole="CASHIER" fallback={<AccessDenied />}>
  <BillingPanel />
</RequireRole>
```

### 3. ShowForRole / HideForRole
```tsx
import { ShowForRole, HideForRole } from '@/components/auth/require-role';

// Show only for specific roles
<ShowForRole minRole="MANAGER">
  <button>Edit Settings</button>
</ShowForRole>

// Hide for specific roles
<HideForRole role="KITCHEN">
  <BillingSection />
</HideForRole>
```

### 4. Navigation Filtering
Navigation items in the sidebar automatically filter based on role permissions:

```tsx
const navItems = [
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    minRole: 'MANAGER', // Only MANAGER and above
  },
  {
    name: 'Kitchen',
    href: '/kitchen',
    icon: ChefHat,
    roles: ['KITCHEN', 'MANAGER', 'OWNER'], // Specific roles only
  },
  {
    name: 'Menu',
    href: '/menu',
    icon: UtensilsCrossed,
    permission: 'view_menu', // Permission-based
  },
];
```

## Login Methods

### Email + Password Login
Standard login for all roles:
- Email: user@example.com
- Password: minimum 8 characters

### PIN Login (Quick Login)
Fast login for frequently-used roles (typically CASHIER, WAITER):
- PIN: 4-6 digit numeric code
- Auto-submit when complete
- Keyboard navigation support

## Security Features

1. **Token Storage**: JWT tokens stored in localStorage
2. **Session Timeout**: 15-minute inactivity timeout
3. **Timeout Warning**: Modal at 14 minutes
4. **Auto-refresh**: Token refresh at 12 minutes (when backend supports)
5. **Protected Routes**: Middleware enforces authentication
6. **Role Validation**: Server-side and client-side role checks

## Testing Different Roles

Use these test accounts to test different role behaviors:

```
OWNER: owner@zerosky.com / password123 (or PIN: 999999)
MANAGER: manager@zerosky.com / password123 (or PIN: 888888)
CASHIER: cashier@zerosky.com / password123 (or PIN: 1234)
WAITER: waiter@zerosky.com / password123 (or PIN: 5678)
KITCHEN: kitchen@zerosky.com / password123 (or PIN: 4321)
```

## Adding New Permissions

1. Add permission to `PERMISSIONS` object in `lib/auth-context.tsx`:
```tsx
const PERMISSIONS: Record<Role, string[]> = {
  OWNER: ['*'],
  MANAGER: [...existing, 'new_permission'],
  // ...
};
```

2. Use in component:
```tsx
const { can } = useAuth();

if (can('new_permission')) {
  // Feature logic
}
```

## Best Practices

1. **Always use minimum role** - Use `hasMinRole()` instead of checking exact roles when possible
2. **Permission over role** - Prefer permission checks (`can()`) over role checks for feature access
3. **Fail secure** - Always provide fallbacks or redirects for unauthorized access
4. **Test all roles** - Verify each feature works correctly for all applicable roles
5. **Document changes** - Update this file when adding new roles or permissions
