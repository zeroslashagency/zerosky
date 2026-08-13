# Decision 002: Public clean

**Date:** 2026-08-14
**Author:** architect (opus)
**Status:** Accepted

## Context
Pre-public audit found 34 vulns, duplicate mobile-app, Hetzner IP leak, 3 experimental packages with 0 imports, team/plans noise.

## Decision
- Remove `apps/mobile-app` (keep Flutter), `npm ci` drops 34→12→9 vulns (remaining 9 are Next 16 postcss/sharp, require --force, deferred).
- Scrub `2.28.30.22` from `team/*` → `<HETZNER_HOST>`.
- Keep `offline/print/payments` as experimental with README, not deleted — they are layered adapters (data layer).
- Keep `team/` for orchestration transparency, scrubbed; `plans/` kept but not required for build.
- `.gitignore` add `packages/offline/generated/`.

## Consequences
Public repo builds with `vercel.json` prisma generate first, `turbo build` respects `^db:generate`. No secrets tracked.
