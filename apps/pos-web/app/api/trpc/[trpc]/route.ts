import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter, createContext } from '@zerosky/api';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: async ({ req }) => {
      const headers = req.headers;
      return createContext({
        req: {
          headers,
          ip: headers.get('x-forwarded-for') || headers.get('x-real-ip') || null,
        },
      });
    },
  });

export { handler as GET, handler as POST };
