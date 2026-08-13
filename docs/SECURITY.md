# Security

This document describes the current security posture of Zerosky, including what's verified-good and what's known to be incomplete.

## Authentication

### ✅ Verified good

**Password verification:**
- Passwords are hashed with bcrypt (12 rounds) via `@zerosky/auth:hashPassword()`
- `auth.login` verifies the supplied password against the stored hash with `verifyPassword()` before returning a token
- Without this check, any password would authenticate the account (tested in `packages/api/tests/auth-password.test.ts`)

**Default-deny middleware:**
- All tRPC procedures start with `publicProcedure` (no auth) or `protectedProcedure` (requires auth)
- `protectedProcedure` enforces `ctx.auth` is non-null via `enforceAuth` middleware
- Unauthenticated requests to protected routes return `401 UNAUTHORIZED`

**Tenant scoping:**
- Every query is scoped by `ctx.auth.tenant.id`
- Users cannot access data from other tenants
- Tested in `packages/api/tests/integration.test.ts`

**RBAC (Role-Based Access Control):**
- `roleProcedure(...roles)` enforces the authenticated user's role is in the allowed set
- Example: `staffRouter.list` is restricted to OWNER and MANAGER only
- Unauthorized role access returns `403 FORBIDDEN`

**Credential exposure prevention:**
- `staff.list` never selects `passwordHash` or `pin` (verified in `packages/api/src/routers/staff.ts`)
- User credentials do not leak to the client

**Rate limiting:**
- General API: 1,000 req/min per `clientId` (user ID if authenticated, else IP)
- Auth attempts (login, PIN login): 10 req/min per `clientId` with separate tighter bucket
- Per-user buckets prevent one user exhausting the shared quota
- Tested in `packages/api/tests/rate-limit-scope.test.ts`

### ⚠️ Known gaps

**Session tokens are raw user IDs that never expire:**
- Tokens returned by `auth.login` are `User.id` strings with no signature, no expiration, no refresh rotation
- A leaked token remains valid indefinitely
- `context.ts:createDbUserResolver()` looks up the user directly from the database on every request (no JWT verification)

**Fix ready but not wired:**
- `@zerosky/auth` exports JWT generation/verification (`jwt.ts`) and Redis-backed session rotation with refresh tokens (`session.ts`)
- To enable: replace `createDbUserResolver` with a JWT-verifying resolver in `createContext()`
- Redis session store is already configured (`REDIS_URL` env var)

**PINs stored in plaintext:**
- `users.pin` is stored as plaintext in the database (e.g. `"1111"`, `"2222"`)
- `auth.pinLogin` compares the input directly: `where: { pin: input.pin }`
- If the database is compromised, PINs are immediately readable

**Fix:**
- Hash PINs with bcrypt before storing
- Verify with `verifyPassword(input.pin, user.pinHash)` instead of direct comparison
- Requires a migration to add `pinHash` column and backfill existing records

**`auth_token` cookie is JS-readable:**
- The `auth_token` cookie (if set by the frontend) does not have `httpOnly` flag
- XSS attacks can steal the token via `document.cookie`

**Fix:**
- Set `httpOnly: true, secure: true, sameSite: 'lax'` when setting the cookie
- Store the token server-side only; client should never access it directly

## Authorization

### ✅ Verified good

**Branch-level scoping:**
- Orders, tables, payments are scoped to `branchId`
- A user in one branch cannot access another branch's data within the same tenant (tested)

**Staff cannot escalate their own role:**
- No `user.updateSelf` endpoint exists
- Role changes require OWNER/MANAGER permission via a dedicated admin endpoint (TODO: verify this endpoint enforces RBAC)

### ⚠️ Known gaps

**No row-level security (RLS):**
- Trust boundary is entirely at the API layer (tRPC middleware)
- If an attacker bypasses the API (e.g., direct Prisma access, SQL injection), tenant isolation is lost
- PostgreSQL RLS policies would add defense-in-depth

## Input validation

### ✅ Verified good

**Zod schemas:**
- All tRPC inputs are validated with Zod schemas (`packages/api/src/schemas/`)
- Invalid inputs return `400 BAD_REQUEST` with flattened error messages
- Example: `order.create` validates `{ items: [{ itemId, quantity, modifiers? }], ... }`

**SQL injection protection:**
- Prisma uses parameterized queries
- No raw SQL (`prisma.$queryRaw`) is used in production routers yet

### ⚠️ Known gaps

**No output validation:**
- tRPC responses are not validated against a Zod schema
- Database fields are passed directly to the client
- If a database value is malformed (e.g., null where non-null is expected), the client may crash

## Secrets management

### ✅ Verified good

**No secrets committed:**
- `.env` files are gitignored
- Dev credentials (`zerosky:zerosky@localhost:5432`) are safe to commit because they're only valid for local Docker containers
- Seed password (`zerosky123`) is documented as a dev-only value

### ⚠️ Known gaps

**Razorpay keys in .env files:**
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` must be set in production
- No automated secrets rotation
- Recommend: Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) instead of `.env` files in production

## Network security

### ✅ Current setup (dev)

**Local only:**
- Postgres (5432) and Redis (6379) are exposed to localhost
- Docker Compose publishes ports but binds to `0.0.0.0` (all interfaces)
- Safe in dev; **DO NOT** expose these ports to the public internet in production

### ⚠️ Production requirements

**Database and Redis must not be publicly accessible:**
- Use internal networking (Docker networks, VPC)
- Firewall rules: only the API container can reach Postgres/Redis
- No published ports on `0.0.0.0:5432` or `0.0.0.0:6379`

**API must sit behind TLS:**
- The tRPC API is HTTP-only in dev
- Production deployment (Vercel, Docker + nginx/Caddy) must enforce HTTPS
- `NEXT_PUBLIC_API_URL` must be `https://...`

## Logging & monitoring

### ⚠️ Gaps

**No structured logging:**
- tRPC middleware logs to `console.info` / `console.error`
- No centralized log aggregation (e.g., Datadog, CloudWatch, Loki)
- Errors log stack traces but no alerting

**No audit trail:**
- No record of who performed sensitive actions (e.g., voided an order, adjusted stock)
- Recommend: Add `performedBy` field to `StockAdjustment` (already exists), `Order.cancelledBy`, etc.

**No intrusion detection:**
- Rate limiting is the only defense against brute-force
- No anomaly detection (e.g., 100 orders from one user in 1 minute)

## Compliance (GST/PCI)

### ✅ GST-ready

**Tax calculation:**
- `Item.taxRate` (5%, 12%, 18%, 28%)
- `Order.taxTotal` computed correctly
- GSTIN stored in `Tenant` and `Branch`

### ⚠️ PCI DSS

**Card data is NOT stored:**
- Payment flow delegates to Razorpay (PCI-compliant gateway)
- Only `payment.reference` (Razorpay txn ID) is stored, never card numbers or CVV

**Recommendation:**
- If storing cardholder data in the future, full PCI DSS compliance (SAQ D) is required
- Current setup is PCI DSS SAQ A-EP (payment page hosted by third party)

## Recommendations (priority order)

1. **Enable JWT sessions with refresh rotation** (high, ~1 day)
   - Wire `@zerosky/auth:SessionManager` into `createContext()`
   - Set expiration on access tokens (15 min), refresh tokens (7 days)
   - Revoke refresh token on logout

2. **Hash PINs** (high, ~2 hours)
   - Add `pinHash` column to `users` table
   - Migrate existing PINs: `UPDATE users SET pinHash = bcrypt(pin, 10)`
   - Update `auth.pinLogin` to verify with bcrypt

3. **Set httpOnly cookies** (high, ~30 min)
   - Ensure `auth_token` cookie has `httpOnly: true, secure: true, sameSite: 'lax'`

4. **Add PostgreSQL RLS policies** (medium, ~1 day)
   - `CREATE POLICY tenant_isolation ON orders USING (tenant_id = current_setting('app.tenant_id')::uuid)`
   - Requires setting `app.tenant_id` session variable before each query

5. **Centralized logging** (medium, ~1 day)
   - Replace `console.info` with structured logger (pino, winston)
   - Ship logs to external service (Datadog, CloudWatch, Loki)

6. **Output validation** (low, ~2 hours)
   - Add Zod schemas for tRPC responses
   - Catch database schema drift early

7. **Audit trail** (low, ~1 day)
   - Add `performedBy` fields to sensitive mutations
   - Log all actions to an `audit_log` table

## Disclosure

This is an open-source project. Security gaps are documented transparently so adopters can assess risk and harden their deployments.

**Zerosky is not production-ready by default.** The recommendations above must be implemented before handling real customer data or payment transactions.

For security issues, contact: [security contact email/GitHub Security tab].
