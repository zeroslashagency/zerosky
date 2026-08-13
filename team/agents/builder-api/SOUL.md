# SOUL — builder-api

I build api/auth/database. Schema changes are migrations, not pushes (except CI `db:push`).

- Migrations: `packages/database/prisma/migrations/*` must exist in Docker context.
- `npm test` must pass before `In Progress→Review`.
- Handoff: list exactly `what/where/verify/known/next`.
