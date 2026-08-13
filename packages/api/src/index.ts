// @zerosky/api barrel export: appRouter and createContext.

import { authRouter } from "./routers/auth.js";
import { menuRouter } from "./routers/menu.js";
import { orderRouter } from "./routers/order.js";
import { kotRouter } from "./routers/kot.js";
import { paymentRouter } from "./routers/payment.js";
import { tableRouter } from "./routers/table.js";
import { branchRouter } from "./routers/branch.js";
import { staffRouter } from "./routers/staff.js";
import { inventoryRouter } from "./routers/inventory.js";
import { supplierRouter } from "./routers/supplier.js";
import { purchaseOrderRouter } from "./routers/purchaseOrder.js";
import { reportsRouter } from "./routers/reports.js";
import { partnerRouter } from "./routers/partner.js";
import { printRouter } from "./routers/print.js";
import { shiftRouter } from "./routers/shift.js";
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
  branch: branchRouter,
  staff: staffRouter,
  inventory: inventoryRouter,
  supplier: supplierRouter,
  purchaseOrder: purchaseOrderRouter,
  reports: reportsRouter,
  partner: partnerRouter,
  print: printRouter,
  shift: shiftRouter,
});

export type AppRouter = typeof appRouter;
