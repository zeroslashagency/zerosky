'use client';

import { trpc } from '@/lib/trpc';
import { ShoppingCart, DollarSign, Users, TrendingUp } from 'lucide-react';

export default function DashboardPage() {
  // Test tRPC connection - use a mock branchId for now
  const { data: tables, isLoading, error } = trpc.table.list.useQuery({ 
    branchId: 'branch-1' 
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your restaurant operations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Today's Orders"
          value="24"
          icon={ShoppingCart}
          trend="+12%"
          trendUp={true}
        />
        <StatCard
          title="Revenue"
          value="₹12,450"
          icon={DollarSign}
          trend="+8%"
          trendUp={true}
        />
        <StatCard
          title="Active Tables"
          value={tables?.length.toString() || '0'}
          icon={Users}
          trend="3/12"
          trendUp={false}
        />
        <StatCard
          title="Avg Order Value"
          value="₹518"
          icon={TrendingUp}
          trend="+5%"
          trendUp={true}
        />
      </div>

      {/* tRPC Connection Test */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">tRPC Connection Status</h2>
        {isLoading && <p className="text-gray-600">Loading tables...</p>}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4">
            <p className="text-red-800 font-medium">Error connecting to backend:</p>
            <p className="text-red-600 text-sm mt-1">{error.message}</p>
          </div>
        )}
        {tables && (
          <div className="bg-green-50 border border-green-200 rounded p-4">
            <p className="text-green-800 font-medium">✓ Successfully connected to backend!</p>
            <p className="text-green-700 text-sm mt-1">
              Found {tables.length} tables in the database
            </p>
            {tables.length > 0 && (
              <ul className="mt-3 space-y-1">
                {tables.slice(0, 5).map((table) => (
                  <li key={table.id} className="text-sm text-gray-700">
                    • {table.name} ({table.state})
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickActionButton label="New Order" />
          <QuickActionButton label="View Menu" />
          <QuickActionButton label="Generate Bill" />
          <QuickActionButton label="Kitchen View" />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendUp,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  trend: string;
  trendUp: boolean;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          <p className={`text-sm mt-2 ${trendUp ? 'text-green-600' : 'text-gray-500'}`}>
            {trend}
          </p>
        </div>
        <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <Icon className="h-6 w-6 text-blue-600" />
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({ label }: { label: string }) {
  return (
    <button className="px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors">
      {label}
    </button>
  );
}
