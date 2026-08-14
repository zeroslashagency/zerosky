// Core money type — hex kernel, zero infra dependencies.
// Prisma.Decimal IS decimal.js under the hood, so adapters map Prisma.Decimal → Money
// and core never imports @zerosky/database.
import Decimal from "decimal.js";
export type Money = Decimal;
export { Decimal };
