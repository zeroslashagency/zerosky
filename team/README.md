# Team — Zerosky (Hetzner + Vercel)

**Stack:** Next 16 + tRPC 11 + Prisma + Postgres 16 + Redis 7 + Hetzner + Vercel
**Deploy:** `Vercel (pos-web)` → `Hetzner (Postgres/Redis/PgBouncer)` — single Hetzner box, no separate Rust API.

## Roles

| Agent | Role | Model | Owns |
|-------|------|-------|------|
| Orchestrator | Route + judge | opus | task lifecycle, priority, Done |
| builder-web | Next.js + tRPC frontend | sonnet | `apps/pos-web`, `packages/ui` |
| builder-api | API + DB + auth | sonnet/opus | `packages/api,auth,database` |
| Reviewer | Verify, never builder | opus | `team/shared/reviews/*` |
| Ops | Health, cron, dispatch | haiku | `team/evals/*`, compose health |

One agent = one primary role. Every artifact → Review.

## Task lifecycle

```
Inbox → Assigned → In Progress → Review → Done | Failed
```

Orchestrator owns `Inbox→Assigned→In Progress` and `Review→Done`. Builder moves `In Progress→Review`. Reviewer moves `Review→Done` or `Review→In Progress` with feedback. Every transition has a comment.

## Workspace

```
team/agents/{orchestrator,builder-web,builder-api,reviewer,ops}/SOUL.md
team/shared/specs/      — approved specs
team/shared/artifacts/  — build outputs
team/shared/reviews/    — review notes
team/shared/decisions/  — ADRs
team/tasks/2026-08-14-s1-*.md  — 15-min lanes
team/evals/capability.sh + regression.sh
```

## Current slice S1 — Make Hetzner+Vercel deployable

5 lanes × ~15 min, honest evals (no theater).

| Lane | Id | Title | Agent |
|------|----|-------|-------|
| U1 | 2026-08-14-s1-u1 | Fix .dockerignore migrations | builder-api |
| U2 | 2026-08-14-s1-u2 | Add vercel.json + standalone | builder-web |
| U3 | 2026-08-14-s1-u3 | PgBouncer pooling in prod compose | builder-api |
| U4 | 2026-08-14-s1-u4 | Capability eval (real DB + build) | ops+reviewer |
| U5 | 2026-08-14-s1-u5 | Regression slice + ship | reviewer+orchestrator |
