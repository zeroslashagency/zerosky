# Decision 001: Hetzner + Vercel hybrid for Zerosky

**Date:** 2026-08-14
**Author:** orchestrator
**Status:** Accepted
**Tasks:** S1-U1..U3

## Context
Peacock uses Vercel rewrites → Hetzner Rust API. Zerosky is Next.js fullstack (API inside Next). "Only Hetzner" vs "Vercel+Hetzner" confusion caused deploy failures.

## Options
1. Pure Hetzner (Docker pos-web on :3000 + Caddy TLS) — offline-friendly, no pooling needed.
2. Hybrid: Vercel hosts pos-web+API, Hetzner hosts Postgres/Redis via PgBouncer — edge, serverless.

## Decision
Ship hybrid as default (Vercel + Hetzner PgBouncer) because user said "Our Cloud=Hetzner and front end is vercel". Keep pure Docker as fallback via same `docker-compose.prod.yml` (app service still exists, just `docker compose up` works for all-in-one).

## Consequences
- `vercel.json` required, `output:standalone` still valid for Docker.
- `docker-compose.prod.yml` adds `pgbouncer` (ignored in all-in-one, used in hybrid when Vercel connects to :6432).
- `.dockerignore` must not exclude migrations (fatal bug fixed).
