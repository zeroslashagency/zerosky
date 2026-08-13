// Staff router.
//
// Read-only staff directory for the management screens. Deliberately never
// selects `passwordHash` or `pin` so credentials cannot leak to the client.
import { roleProcedure, router } from "../trpc.js";

export const staffRouter = router({
  /**
   * Staff for the caller's tenant. Restricted to management roles: a waiter or
   * kitchen user has no reason to enumerate colleagues.
   */
  list: roleProcedure("OWNER", "MANAGER").query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      where: { tenantId: ctx.auth.tenant.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        // passwordHash and pin are intentionally omitted.
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
  }),
});
