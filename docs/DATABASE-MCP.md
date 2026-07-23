# Oracle Database MCP Guide

This project uses an **Oracle Autonomous AI Database** (Always Free tier) as its
live database. AI assistants (Warp, Claude Code, Cursor, etc.) talk to it through
the **Oracle SQLcl MCP server**, which exposes tools to list connections, connect,
run SQL, and inspect the schema.

This guide explains how the MCP is wired up so any IDE / agent can use it.

---

## 1. What the MCP server is

The MCP server is just **Oracle SQLcl** launched in MCP mode (`sql -mcp`). It runs
locally on your machine and proxies MCP tool calls to the Oracle database over the
mTLS wallet connection.

- **Binary:** `/opt/homebrew/Caskroom/sqlcl/26.2.0.181.2110/sqlcl/bin/sql`
  (installed via `brew install --cask sqlcl`; requires Java 17+)
- **Mode:** `-mcp`
- **Wallet / TNS config:** `TNS_ADMIN=/Users/xoxo/.oci/wallet_zerosky`

### Database facts

- Engine: Oracle Autonomous Database 19c (19.32.0.1.0)
- Display name: `zerosky-dev-db` (DB name `ZEROSKY`)
- Region: `ap-hyderabad-1`
- Character set: `AL32UTF8`, `AUTOCOMMIT ON`
- TNS aliases (in the wallet): `zerosky_high`, `zerosky_medium`, `zerosky_low`,
  `zerosky_tp`, `zerosky_tpurgent` (host `adb.ap-hyderabad-1.oraclecloud.com:1522`)

---

## 2. MCP configuration per IDE

The config below is **already committed** to this repo at `.mcp.json`, so IDEs that
auto-detect a project-level MCP file will pick it up automatically. If your IDE uses
a global config instead, copy the `oracle-sqlcl` block into it.

```json
{
  "mcpServers": {
    "oracle-sqlcl": {
      "command": "/opt/homebrew/Caskroom/sqlcl/26.2.0.181.2110/sqlcl/bin/sql",
      "args": ["-mcp"],
      "env": {
        "TNS_ADMIN": "/Users/xoxo/.oci/wallet_zerosky"
      }
    }
  }
}
```

### Where each IDE reads MCP config

- **Warp:** global `~/.warp/.mcp.json` (already configured) — key `oracle-sqlcl`.
- **Claude Code:** project `.mcp.json` (this repo) is auto-detected, or run
  `claude mcp add oracle-sqlcl -- /opt/homebrew/Caskroom/sqlcl/26.2.0.181.2110/sqlcl/bin/sql -mcp`.
- **Cursor:** `.cursor/mcp.json` in the project, or global `~/.cursor/mcp.json`.
- **VS Code (Continue / others):** `.vscode/mcp.json` or the extension's MCP settings.

> Note: the SQLcl path contains a version number (`26.2.0.181.2110`). If you upgrade
> SQLcl, update the path in every config, or symlink a stable path and point configs
> at the symlink.

---

## 3. Available MCP tools

The `oracle-sqlcl` server exposes these tools:

- `connections_list` — list saved SQLcl connections.
- `connect` — open one of the saved connections (e.g. `zerosky_admin`).
- `sql_run` — run a SQL statement / script against the active connection.
- `schema_information` — inspect tables, columns, and other schema objects.

### Saved connection

A named connection is already saved in SQLcl:

- **`zerosky_admin`** → user `ADMIN` on TNS alias `zerosky_low`.

> ⚠️ **Full-access connection.** `ADMIN` is the database superuser. Any IDE or
> agent that loads this MCP server can run **any** SQL against the database —
> full read/write (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) **and** schema-changing
> DDL (`CREATE`/`ALTER`/`DROP`/`TRUNCATE`), plus user/grant management. There is
> no built-in read-only or row-level restriction on this connection. Treat every
> agent with this MCP as having unrestricted control over the whole database.
>
> To limit blast radius, create a lower-privilege application user and save a
> separate connection for day-to-day agent use, keeping `ADMIN` only for
> migrations:
>
> ```sql
> -- as ADMIN, one-time setup
> CREATE USER zerosky_app IDENTIFIED BY "<APP_PASSWORD>";
> GRANT CONNECT, RESOURCE TO zerosky_app;
> ALTER USER zerosky_app QUOTA UNLIMITED ON DATA;
> -- grant only what the app needs on specific objects, e.g.:
> -- GRANT SELECT, INSERT, UPDATE, DELETE ON zerosky_app.orders TO zerosky_app;
> ```
>
> ```bash
> # save a scoped connection for agents
> conn -save zerosky_app -savepwd zerosky_app/"<APP_PASSWORD>"@zerosky_low
> ```

So an agent flow is typically:

1. `connect` → `zerosky_admin`
2. `sql_run` → e.g. `SELECT table_name FROM user_tables;`
3. `schema_information` → to explore structure.

---

## 4. Manual connection (without MCP)

If you need a plain SQLcl session (for debugging the MCP setup):

```bash
export TNS_ADMIN=/Users/xoxo/.oci/wallet_zerosky
/opt/homebrew/Caskroom/sqlcl/26.2.0.181.2110/sqlcl/bin/sql \
  ADMIN/"<ADMIN_PASSWORD>"@zerosky_low
```

> If the password contains an `@` it **must be quoted**, otherwise SQLcl parses it
> as part of the connect string.

To re-create the saved connection:

```sql
conn -save zerosky_admin -savepwd ADMIN/"<ADMIN_PASSWORD>"@zerosky_low
```

---

## 5. Current state & caveats

- The Oracle database is currently **empty** — the only table is `DBTOOLS$MCP_LOG`
  (created by the MCP tooling). No application tables are deployed yet.
- ⚠️ **Schema mismatch:** `packages/database/prisma/schema.prisma` targets
  **PostgreSQL** (`provider = "postgresql"`). It **cannot** be pushed to Oracle
  as-is. Before deploying, decide the architecture:
  - **(a)** Keep Oracle ADB → convert the Prisma schema to Oracle-compatible SQL
    (or use a different ORM/migration path), or
  - **(b)** Use a PostgreSQL host (see `docs/HOSTING-COST-ANALYSIS.md`) and reserve
    Oracle for another purpose.

---

## 6. Security note

The wallet, private key, and DB password live **outside** the repo (in `~/.oci/`),
and only file paths are referenced here. Do **not** commit the wallet, the
`oci_api_key.pem`, or plaintext passwords into version control. Rotate the ADMIN
password if it has been shared.
