'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import superjson from 'superjson';
import { trpc } from '@/lib/trpc';
import { resolveTrpcUrl } from '@/lib/trpc-url';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: resolveTrpcUrl(),
          transformer: superjson,
          async fetch(url, options) {
            const res = await fetch(url, { ...options, credentials: 'include' });
            if (res.status === 401 && typeof window !== 'undefined') {
              try {
                localStorage.removeItem('auth_user');
                localStorage.removeItem('auth_timestamp');
                localStorage.removeItem('auth_token');
              } catch {}
              if (!window.location.pathname.startsWith('/login')) {
                window.location.href = '/login';
              }
            }
            return res;
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
