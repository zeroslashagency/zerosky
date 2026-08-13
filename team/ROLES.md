# ROLES — Zerosky

## Orchestrator (opus)
- Owns `Inbox→Assigned→In Progress` and `Review→Done`.
- Picks agent, writes task file, comments every transition.
- Never builds directly — routes.
- Escalates ambiguous spec before builder guesses.

## builder-web (sonnet, opus for hard UI)
- Owns `apps/pos-web`, `apps/kds-display`, `packages/ui`.
- Implements per `team/shared/specs/*.md`, writes artifacts to `shared/artifacts/`.
- Handoff must list: what/where/verify/known/next.

## builder-api (sonnet/opus)
- Owns `packages/api,auth,database,offline,print,payments`.
- Schema changes via Prisma migration, never `db push` except CI `db:push`.
- Verifies with `npm test` + `prisma migrate status`.

## Reviewer (opus, never the builder)
- Owns `team/shared/reviews/*.md`.
- Checks spec match, edge cases, theater (fake greens).
- Returns `Review→In Progress` with 1-3 concrete fixes, or `Approved`.

## Ops (haiku)
- Owns `team/evals/*`, `docker compose config`, healthchecks, cron.
- Cheapest reliable model, but blocks ship if health fails.

## Handoff contract (required)
1. What was done
2. Where artifacts are (exact paths)
3. How to verify (command)
4. Known issues
5. What's next
