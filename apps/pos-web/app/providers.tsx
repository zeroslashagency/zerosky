'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import superjson from 'superjson';
import { trpc } from '@/lib/trpc';
import { resolveTrpcUrl } from '@/lib/trpc-url';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/components/theme/theme-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // A 5s staleTime meant almost every screen change refetched from
            // scratch and showed a spinner. Terminal staff move between
            // screens constantly, so serve the cache immediately and
            // revalidate in the background instead: navigation feels instant
            // and the data is still fresh within a couple of minutes.
            staleTime: 2 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            // Revalidate when the cashier returns to the tab. Combined with
            // staleTime this is cheap and keeps figures honest without the
            // per-mount refetch storm.
            refetchOnWindowFocus: true,
            // Polling screens (kitchen, tables, orders, billing) must not
            // keep hitting the API while the tab is hidden.
            refetchIntervalInBackground: false,
            retry: 1,
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
          // The session token is an httpOnly cookie now, so JS cannot read it
          // and cannot put it in an Authorization header. The browser attaches
          // it itself as long as credentials are included.
          fetch(url, options) {
            return fetch(url, { ...options, credentials: 'include' });
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
