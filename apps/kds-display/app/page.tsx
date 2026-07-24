'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc-client';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@zerosky/api';

type RouterOutput = inferRouterOutputs<AppRouter>;
type KotWithDetails = RouterOutput['kot']['listForOrder'][number];

function getKotAge(createdAt: Date): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000 / 60);
}

function getKotStatusColor(ageMinutes: number): string {
  if (ageMinutes < 5) return 'kot-fresh';
  if (ageMinutes < 10) return 'kot-warn';
  return 'kot-late';
}

function KotCard({ kot }: { kot: KotWithDetails }) {
  const [age, setAge] = useState(getKotAge(kot.createdAt));
  const utils = trpc.useUtils();

  useEffect(() => {
    const interval = setInterval(() => {
      setAge(getKotAge(kot.createdAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [kot.createdAt]);

  const updateStatus = trpc.kot.updateStatus.useMutation({
    onSuccess: () => {
      utils.kot.invalidate();
    },
  });

  const handleReady = () => {
    updateStatus.mutate({ kotId: kot.id, status: 'READY' });
  };

  const handleServed = () => {
    updateStatus.mutate({ kotId: kot.id, status: 'SERVED' });
  };

  const statusColor = getKotStatusColor(age);

  return (
    <div className={`${statusColor} rounded-lg p-6 shadow-lg transition-colors`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-2xl font-bold text-white">{kot.kotNumber}</h3>
          <p className="text-gray-300 text-sm">
            {kot.order?.orderNumber || 'N/A'} • Table {kot.order?.table?.number || 'N/A'}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-white">{age}m</div>
          <div className="text-xs text-gray-400 uppercase">{kot.status}</div>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        {kot.items?.map((item) => (
          <div key={item.id} className="bg-black/30 rounded p-3">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <span className="text-lg font-semibold text-white">
                  {item.quantity}x {item.name}
                </span>
                {item.modifiers && (
                  <div className="text-sm text-gray-400 mt-1">
                    {JSON.stringify(item.modifiers)}
                  </div>
                )}
                {item.notes && (
                  <div className="text-sm text-yellow-400 mt-1">
                    Note: {item.notes}
                  </div>
                )}
              </div>
              <div className="text-gray-400 text-sm uppercase ml-2">
                {item.status}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {kot.status === 'NEW' || kot.status === 'MODIFIED' ? (
          <button
            onClick={handleReady}
            disabled={updateStatus.isPending}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Mark Ready
          </button>
        ) : null}
        {kot.status === 'READY' ? (
          <button
            onClick={handleServed}
            disabled={updateStatus.isPending}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Mark Served
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function KDSBoard() {
  const { data: kots = [], isLoading } = trpc.kot.getActiveKots.useQuery(
    {},
    {
      refetchInterval: 5000, // Poll every 5 seconds
    }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl text-gray-400">Loading...</div>
      </div>
    );
  }

  if (kots.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-400 mb-2">No Active Orders</h2>
          <p className="text-gray-500">Kitchen is clear!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <header className="mb-6">
        <h1 className="text-4xl font-bold text-white">Kitchen Display</h1>
        <p className="text-gray-400 mt-1">{kots.length} active orders</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {kots.map((kot) => (
          <KotCard key={kot.id} kot={kot} />
        ))}
      </div>
    </div>
  );
}
