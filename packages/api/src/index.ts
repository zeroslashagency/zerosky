// @zerosky/api barrel export: appRouter and createContext.

import { authRouter } from "./routers/auth.js";
import { menuRouter } from "./routers/menu.js";
import { orderRouter } from "./routers/order.js";
import { kotRouter } from "./routers/kot.js";
import { paymentRouter } from "./routers/payment.js";
import { tableRouter } from "./routers/table.js";
import { router } from "./trpc.js";

export { createContext } from "./context.js";
export type { Context, AuthUser } from "./context.js";
export * from "./trpc.js";

export const appRouter = router({
  auth: authRouter,
  menu: menuRouter,
  order: orderRouter,
  kot: kotRouter,
  payment: paymentRouter,
  table: tableRouter,
});

export type AppRouter = typeof appRouter;
