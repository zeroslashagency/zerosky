-- Hash User.pin.
--
-- `users.pin` stored the quick-login PIN in PLAINTEXT and auth.pinLogin
-- compared it with a WHERE clause, so any read of this table (backup, log,
-- SQL injection, curious operator) handed over working POS credentials.
--
-- The column is replaced by `pin_hash`, a bcrypt hash. Existing PINs are
-- migrated in place with pgcrypto's bcrypt (`gen_salt('bf', 10)`), which
-- produces `$2a$` hashes that bcryptjs verifies, so nobody's PIN stops working.
-- The plaintext column is then dropped.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "pin_hash" TEXT;

-- Backfill: hash every existing plaintext PIN at cost 10 (matches hashPin()).
UPDATE "users"
SET "pin_hash" = crypt("pin", gen_salt('bf', 10))
WHERE "pin" IS NOT NULL AND "pin" <> '';

-- Drop the plaintext column.
ALTER TABLE "users" DROP COLUMN "pin";
