# Deployment Guide

Zerosky can be deployed in two ways:

**Option A: All-in-one Docker** (Recommended for self-hosting)
- Frontend + API + Database + Redis in one Docker Compose stack

**Option B: Hybrid** (Recommended for scalability)
- Frontend on Vercel (static + SSR)
- Backend (Database + Redis) on Docker/VPS
- tRPC API calls from Vercel serverless functions to the database

This guide covers both.

---

## Architecture

### Option A: All-in-one Docker

```
┌─────────────────────────────────────┐
│        Docker Host / VPS            │
│  ┌─────────────────────────────┐   │
│  │   pos-web (Next.js)         │   │
│  │   - Frontend (SSR/Static)   │   │
│  │   - tRPC API (/api/trpc)    │   │
│  └──────────┬──────────────────┘   │
│             ↓                       │
│  ┌──────────────────┐               │
│  │  Postgres + Redis │               │
│  └──────────────────┘               │
└─────────────────────────────────────┘
```

### Option B: Hybrid (Vercel + Docker)

```
┌─────────────┐
│   Vercel    │  Frontend + tRPC API (serverless)
│  pos-web    │
└──────┬──────┘
       │ PostgreSQL protocol
       ↓
┌─────────────────────┐
│   Docker / VPS      │
│  Postgres + Redis   │
└─────────────────────┘
```

**Important:** In Option B, the database must accept connections from Vercel's IP ranges. Use connection pooling (PgBouncer, Prisma Accelerate) to avoid exhausting connections.

---

## Local development

### Start Postgres + Redis

```bash
cd /path/to/zerosky-repo
docker compose up -d
```

Uses `docker-compose.yml` (dev mode):
- Postgres: `zerosky:zerosky@localhost:5432/zerosky`
- Redis: `localhost:6379` (no password)

### Apply migrations

```bash
cd packages/database
npx prisma migrate deploy
```

### Seed dev data

```bash
cd packages/database
npx tsx prisma/seed.ts
```

### Run dev server

```bash
npm run dev
```

- `apps/pos-web` → http://localhost:3000 (includes tRPC API at `/api/trpc`)
- `apps/kds-display` → http://localhost:3002

---

## Option A: All-in-one Docker deployment

### Prerequisites

- Docker + Docker Compose
- VPS or cloud instance (2 vCPU, 4GB RAM recommended)
- Domain name (e.g., `pos.zerosky.yourdomain.com`)
- Reverse proxy with TLS (nginx, Caddy, Traefik)

### Step 1: Prepare environment variables

Create `.env.prod` on your VPS (do NOT commit):

```bash
# Database
POSTGRES_USER=zerosky_prod
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_DB=zerosky

# Redis
REDIS_PASSWORD=<strong-random-password>

# App
APP_PORT=3000
NEXT_PUBLIC_API_URL=https://pos.zerosky.yourdomain.com/api/trpc
NEXT_PUBLIC_TENANT_SLUG=zerosky-demo

# JWT/Session
JWT_SECRET=<64-char-random-hex>
SESSION_TTL_SECONDS=604800

# Rate limiting
API_RATE_LIMIT=1000
API_RATE_LIMIT_WINDOW_MS=60000
API_AUTH_RATE_LIMIT=10
API_AUTH_RATE_LIMIT_WINDOW_MS=60000

# Payments
RAZORPAY_KEY_ID=<your-razorpay-key-id>
RAZORPAY_KEY_SECRET=<your-razorpay-key-secret>
```

**Generate secrets:**
```bash
openssl rand -hex 32  # JWT_SECRET
openssl rand -base64 32  # Passwords
```

### Step 2: Deploy with Docker Compose

```bash
# Clone repo
git clone <repo-url> /opt/zerosky
cd /opt/zerosky

# Copy env
cp .env.prod .env

# Build and start
docker compose -f docker-compose.prod.yml up -d --build

# Check logs
docker compose -f docker-compose.prod.yml logs -f app

# Apply migrations (first time)
docker compose -f docker-compose.prod.yml exec app sh -c "cd packages/database && npx prisma migrate deploy"
```

The app runs on `http://localhost:3000` (internal).

### Step 3: Set up reverse proxy (nginx + Let's Encrypt)

Install nginx and certbot:

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/zerosky`:

```nginx
server {
    listen 80;
    server_name pos.zerosky.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Increase timeouts for slow connections
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

Enable and get TLS:

```bash
sudo ln -s /etc/nginx/sites-available/zerosky /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d pos.zerosky.yourdomain.com
```

Visit: `https://pos.zerosky.yourdomain.com`

---

## Option B: Vercel + Docker deployment

### Step 1: Deploy database to Docker

Follow the same steps as Option A, but only start Postgres + Redis (comment out the `app` service in `docker-compose.prod.yml`).

Alternatively, use managed services:
- **Postgres:** AWS RDS, DigitalOcean Managed Databases, Supabase, Neon
- **Redis:** AWS ElastiCache, Redis Cloud, Upstash

### Step 2: Configure Vercel environment variables

In your Vercel project settings (or via CLI):

```bash
vercel env add NEXT_PUBLIC_API_URL production
# Value: https://your-vercel-app.vercel.app/api/trpc

vercel env add NEXT_PUBLIC_TENANT_SLUG production
# Value: zerosky-demo

vercel env add DATABASE_URL production
# Value: postgresql://user:pass@your-db-host:5432/zerosky?schema=public

vercel env add REDIS_URL production
# Value: redis://:password@your-redis-host:6379

vercel env add JWT_SECRET production
# Value: <64-char-random-hex>

vercel env add RAZORPAY_KEY_ID production
# Value: <your-key>

vercel env add RAZORPAY_KEY_SECRET production
# Value: <your-secret>
```

**Security:** Ensure your database firewall allows Vercel's IP ranges. See [Vercel IP ranges](https://vercel.com/docs/concepts/solutions/databases#allow-vercel-ips).

### Step 3: Deploy to Vercel

```bash
cd apps/pos-web
vercel --prod
```

Or link to Git for auto-deploy:

```bash
vercel link
git push origin main  # Auto-deploys
```

### Step 4: Connection pooling (recommended)

Vercel serverless functions can exhaust Postgres connections. Use:

- **Prisma Accelerate:** Managed connection pooling by Prisma
- **PgBouncer:** Self-hosted connection pooler
- **Supabase Pooler:** Built-in if using Supabase

Example with PgBouncer:

```bash
# In docker-compose.prod.yml, add:
pgbouncer:
  image: pgbouncer/pgbouncer:latest
  environment:
    DATABASES_HOST: postgres
    DATABASES_PORT: 5432
    DATABASES_USER: ${POSTGRES_USER}
    DATABASES_PASSWORD: ${POSTGRES_PASSWORD}
    DATABASES_DBNAME: ${POSTGRES_DB}
    PGBOUNCER_POOL_MODE: transaction
    PGBOUNCER_MAX_CLIENT_CONN: 1000
    PGBOUNCER_DEFAULT_POOL_SIZE: 20
  ports:
    - "6432:6432"
  networks:
    - zerosky-internal
```

Then use `postgresql://user:pass@your-vps:6432/zerosky` on Vercel.

---

## Environment variables reference

### Docker (All-in-one)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_USER` | Yes | - | Postgres username |
| `POSTGRES_PASSWORD` | Yes | - | Postgres password |
| `POSTGRES_DB` | Yes | - | Database name |
| `REDIS_PASSWORD` | Yes | - | Redis password |
| `APP_PORT` | No | 3000 | Next.js server port |
| `NEXT_PUBLIC_API_URL` | Yes | - | tRPC API URL (must match public URL) |
| `NEXT_PUBLIC_TENANT_SLUG` | Yes | - | Default tenant slug |
| `JWT_SECRET` | Yes | - | JWT signing secret (64+ chars) |
| `SESSION_TTL_SECONDS` | No | 604800 | Session expiry (7 days) |
| `API_RATE_LIMIT` | No | 1000 | General rate limit (req/min) |
| `API_AUTH_RATE_LIMIT` | No | 10 | Auth rate limit (req/min) |
| `RAZORPAY_KEY_ID` | Yes | - | Razorpay key |
| `RAZORPAY_KEY_SECRET` | Yes | - | Razorpay secret |

### Vercel (Hybrid)

Same as above, plus:
- `DATABASE_URL` must point to your external database (with connection pooling)
- `REDIS_URL` must point to your external Redis
- `NEXT_PUBLIC_API_URL` should be your Vercel domain + `/api/trpc`

---

## Migrations

### Apply new migrations (Docker)

```bash
cd /opt/zerosky
git pull origin main
docker compose -f docker-compose.prod.yml exec app sh -c "cd packages/database && npx prisma migrate deploy"
docker compose -f docker-compose.prod.yml restart app
```

### Apply new migrations (Vercel)

Vercel builds run `npm run build`, which should include migration apply. If not, add a build hook:

In `apps/pos-web/package.json`:

```json
{
  "scripts": {
    "build": "cd ../../packages/database && npx prisma migrate deploy && cd ../../apps/pos-web && next build --webpack"
  }
}
```

Or run migrations manually via SSH on your database host.

---

## Backup & restore

### Postgres backup (Docker)

```bash
docker exec zerosky-postgres-prod pg_dump -U zerosky_prod zerosky | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restore

```bash
gunzip < backup_20260726.sql.gz | docker exec -i zerosky-postgres-prod psql -U zerosky_prod -d zerosky
```

### Automated daily backups

```bash
# /etc/cron.daily/zerosky-backup
#!/bin/bash
BACKUP_DIR=/var/backups/zerosky
DATE=$(date +%Y%m%d)
docker exec zerosky-postgres-prod pg_dump -U zerosky_prod zerosky | gzip > $BACKUP_DIR/zerosky_$DATE.sql.gz
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

Make executable: `sudo chmod +x /etc/cron.daily/zerosky-backup`

---

## Monitoring

### Health check

The app should expose a health endpoint at `/api/health` (TODO: implement).

For now, check auth endpoint:

```bash
curl https://pos.zerosky.yourdomain.com/api/trpc/auth.me
# Should return 401 (unauthenticated) but proves API is up
```

### Docker health status

```bash
docker compose -f docker-compose.prod.yml ps
```

All services should show `healthy`.

### Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# App only
docker compose -f docker-compose.prod.yml logs -f app --tail=100
```

### External monitoring

Use UptimeRobot, Pingdom, or Healthchecks.io to ping your domain every 5 minutes.

---

## Security checklist

- [ ] Postgres and Redis NOT exposed to public internet
- [ ] App behind TLS (HTTPS)
- [ ] Strong passwords (32+ chars, random)
- [ ] JWT secret is 64+ chars
- [ ] Firewall allows only 80, 443, SSH
- [ ] SSH key-only (no password)
- [ ] Database backups automated
- [ ] Rate limiting enabled
- [ ] `.env` files gitignored

---

## Troubleshooting

### Build fails: "Module not found"

Ensure `--webpack` flag is in the build command. Check `apps/pos-web/package.json`:

```json
{
  "scripts": {
    "build": "next build --webpack"
  }
}
```

### Database connection error

Check `DATABASE_URL` format:

```
postgresql://user:password@host:port/database?schema=public
```

From inside Docker: use service name (`postgres`) instead of `localhost`.

### Prisma client not found

Regenerate:

```bash
docker compose -f docker-compose.prod.yml exec app sh -c "cd packages/database && npx prisma generate"
docker compose -f docker-compose.prod.yml restart app
```

### Vercel: Database connection pool exhausted

Reduce `connection_limit` in `DATABASE_URL`:

```
postgresql://user:pass@host:5432/db?schema=public&connection_limit=5
```

Or use connection pooling (PgBouncer, Prisma Accelerate).

---

## Cost estimate

### Option A: All-in-one Docker

- VPS (2 vCPU, 4GB RAM): $12-24/month (Hetzner, DigitalOcean, Vultr)
- Domain: $10-15/year
- **Total:** ~$15-30/month

### Option B: Vercel + Managed DB

- Vercel Pro: $20/month (or Free for hobby)
- Managed Postgres: $15-50/month (DigitalOcean, Supabase, Neon)
- Managed Redis: $10-30/month (Redis Cloud, Upstash)
- **Total:** ~$45-100/month

For a single-branch restaurant, Option A is more cost-effective. For multi-branch or high traffic, Option B scales better.
