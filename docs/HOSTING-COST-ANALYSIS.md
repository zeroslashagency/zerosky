# Backend Hosting Cost Analysis for Zerosky POS
**Date:** July 2026  
**Currency:** INR (Indian Rupees)  
**Exchange Rate:** $1 = ₹83

---

## Executive Summary
For a startup with 10 restaurants initially scaling to 100, **Oracle Cloud Free Tier** or **Railway** are the most cost-effective options for the first year. For long-term stability at scale, **DigitalOcean** or **Hetzner** offer the best value.

---

## Cost Comparison Table

### Scenario 1: 10 Restaurants (Current)
**Estimated Traffic:** ~500-1000 orders/day total, ~50 concurrent users peak

| Provider | Monthly Cost (INR) | What's Included | Limitations |
|----------|-------------------|-----------------|-------------|
| **Oracle Cloud Free Tier** | ₹0 (FREE) | 2x AMD Compute (1 core, 1GB RAM each), 200GB storage, 10TB bandwidth | **FREE FOREVER** - Best for startup phase |
| **Railway** | ₹0 - ₹830 | $10/month = ₹830, Free tier: $5 credit/month | Great DX, auto-scaling, but expensive at scale |
| **Supabase Free** | ₹0 | 500MB database, 1GB file storage, 2GB bandwidth | Limited for production, good for MVP |
| **Fly.io** | ₹0 - ₹1,660 | Free: 3x shared VMs, 3GB storage. Paid: $20/month = ₹1,660 | Good for small scale |
| **DigitalOcean Droplet** | ₹415 | $5/month = ₹415 (1 vCPU, 1GB RAM, 25GB SSD, 1TB transfer) | Most popular, simple pricing |
| **Hetzner Cloud** | ₹249 - ₹415 | €2.99-€4.99/month = ₹249-₹415 (2 vCPU, 2GB RAM, 40GB SSD) | **CHEAPEST paid option** |
| **AWS (t4g.micro)** | ₹664 - ₹1,245 | $8-$15/month = ₹664-₹1,245 (with RDS, S3, etc.) | Complex pricing, overkill for startup |
| **Render** | ₹581 | $7/month = ₹581 (0.5 vCPU, 512MB RAM) | Easy deployment, moderate cost |

**Recommendation for 10 Restaurants:** Oracle Cloud Free Tier or Hetzner Cloud (₹249/month)

---

### Scenario 2: 50 Restaurants
**Estimated Traffic:** ~2,500-5,000 orders/day, ~250 concurrent users peak

| Provider | Monthly Cost (INR) | Configuration | Notes |
|----------|-------------------|---------------|-------|
| **Oracle Cloud** | ₹0 - ₹830 | Free tier + 1 paid instance (2 vCPU, 8GB RAM) = $10 | Still mostly free |
| **Hetzner Cloud** | ₹664 | CPX21: 3 vCPU, 4GB RAM, 80GB SSD, 20TB traffic | **Best value** |
| **DigitalOcean** | ₹996 | $12/month (2 vCPU, 2GB RAM) + Managed Postgres $15 = ₹1,245 | Reliable, good support |
| **Railway** | ₹4,150 | $50/month usage (scales automatically) | Expensive but zero maintenance |
| **Render** | ₹2,490 | $30/month (2 vCPU, 4GB RAM) | Mid-range pricing |
| **AWS** | ₹4,980 - ₹8,300 | $60-$100/month (EC2 + RDS + S3 + CloudFront) | Enterprise-grade, costly |

**Recommendation for 50 Restaurants:** Hetzner Cloud (₹664/month) or DigitalOcean (₹1,245/month)

---

### Scenario 3: 100 Restaurants
**Estimated Traffic:** ~5,000-10,000 orders/day, ~500 concurrent users peak

| Provider | Monthly Cost (INR) | Configuration | Notes |
|----------|-------------------|---------------|-------|
| **Hetzner Cloud** | ₹1,245 | CPX31: 4 vCPU, 8GB RAM, 160GB SSD + ₹415 managed Postgres | **Best value at scale** |
| **DigitalOcean** | ₹2,905 | $35/month droplet (4 vCPU, 8GB RAM) + managed DB | Stable, trusted |
| **Oracle Cloud** | ₹2,490 | Mix of free + paid instances | Still competitive |
| **Railway** | ₹12,450+ | $150+/month (autoscales) | Expensive at scale |
| **AWS** | ₹16,600 - ₹24,900 | $200-$300/month (multi-AZ, autoscaling) | Enterprise features |
| **Render** | ₹8,300 | $100/month (8 vCPU, 16GB RAM) | Mid-tier pricing |

**Recommendation for 100 Restaurants:** Hetzner Cloud (₹1,245/month) or DigitalOcean (₹2,905/month)

---

## Detailed Resource Requirements

### 10 Restaurants
```
CPU: 1-2 vCPU
RAM: 1-2GB
Storage: 20GB (database + logs)
Bandwidth: 500GB/month
Database: PostgreSQL (500MB - 2GB data)
Redis: 100MB
```

### 50 Restaurants
```
CPU: 2-4 vCPU
RAM: 4GB
Storage: 50GB
Bandwidth: 2TB/month
Database: PostgreSQL (5GB - 10GB data)
Redis: 500MB
```

### 100 Restaurants
```
CPU: 4-8 vCPU
RAM: 8-16GB
Storage: 100GB
Bandwidth: 5TB/month
Database: PostgreSQL (10GB - 30GB data)
Redis: 1GB
```

---

## Cost Breakdown by Component

### Infrastructure Costs (100 Restaurants - Monthly INR)

| Component | Hetzner | DigitalOcean | AWS | Railway |
|-----------|---------|--------------|-----|---------|
| Compute | ₹830 | ₹2,490 | ₹8,300 | ₹8,300 |
| Database | ₹415 | ₹1,245 | ₹4,150 | Included |
| Redis | ₹0 (self-hosted) | ₹830 | ₹1,660 | Included |
| Object Storage | ₹83 | ₹415 | ₹830 | ₹415 |
| Bandwidth | ₹0 (included) | ₹0 (1TB free) | ₹2,490 | ₹2,490 |
| Backups | ₹83 | ₹415 | ₹830 | Included |
| Monitoring | ₹0 (self-hosted) | ₹0 | ₹415 | Included |
| **TOTAL** | **₹1,411** | **₹5,395** | **₹18,675** | **₹11,205** |

---

## Hidden Costs to Consider

### Development & Maintenance Time
| Provider | Setup Time | Monthly Maintenance | DevOps Skill Required |
|----------|-----------|---------------------|---------------------|
| Oracle Cloud Free | 4-6 hours | 2-4 hours | Medium |
| Railway | 30 minutes | 0 hours | Low |
| Hetzner | 2-3 hours | 1-2 hours | Medium |
| DigitalOcean | 1-2 hours | 1 hour | Low-Medium |
| AWS | 8-12 hours | 4-6 hours | High |
| Render | 30 minutes | 0 hours | Low |

**Developer Cost Assumption:** ₹50,000/month salary = ₹312/hour
- If you spend 4 extra hours/month on AWS vs Railway, that's ₹1,248 in lost productivity

---

## Pricing Models Explained

### Free Tier Providers
**Oracle Cloud (Always Free):**
- ✅ 2x Arm-based Ampere A1 cores (4GB RAM total)
- ✅ 200GB storage
- ✅ 10TB outbound bandwidth/month
- ✅ **NO time limit** - free forever
- ⚠️ Arm architecture may need Docker adjustments
- ⚠️ Slower support, complex UI

**Railway ($5 free credit/month):**
- ✅ $5 = ~50 hours of small instance
- ✅ Auto-scaling, zero config
- ⚠️ After free tier, very expensive

**Supabase Free:**
- ✅ Good for small projects
- ⚠️ 500MB database limit
- ⚠️ Not suitable for production POS

### Pay-as-you-go vs Fixed Pricing
**Fixed (Hetzner, DigitalOcean):**
- Simple, predictable billing
- Pay even if unused
- Best for stable workloads

**Pay-as-you-go (AWS, Railway):**
- Pay only for usage
- Can spike unexpectedly
- Best for variable workloads

---

## Cost Projection: 1-Year Timeline

### Conservative Growth (10 → 50 → 100 restaurants)

| Month | Restaurants | Hetzner Cost | DigitalOcean Cost | AWS Cost | Railway Cost |
|-------|-------------|--------------|-------------------|----------|--------------|
| 1-3 | 10 | ₹0 (Oracle) | ₹415 | ₹1,245 | ₹0-₹830 |
| 4-6 | 20 | ₹249 | ₹830 | ₹2,490 | ₹1,660 |
| 7-9 | 50 | ₹664 | ₹1,245 | ₹6,640 | ₹4,150 |
| 10-12 | 100 | ₹1,245 | ₹2,905 | ₹16,600 | ₹12,450 |
| **TOTAL YEAR 1** | - | **₹6,474** | **₹16,473** | **₹81,965** | **₹57,115** |

---

## Authentication & Complexity Concerns

### Simple (Low Maintenance) Options
**1. Supabase Auth (Free tier available)**
- ✅ Built-in authentication
- ✅ JWT tokens, row-level security
- ✅ Email, magic links, OAuth
- **Cost:** Free up to 50,000 monthly active users
- **Integration:** Easy with Next.js

**2. Clerk (Paid, but managed)**
- ✅ Complete auth solution
- ✅ Multi-tenancy built-in
- ✅ PIN codes, session management
- **Cost:** $25/month (₹2,075) for 10,000 users
- **Best for:** Zero auth maintenance

**3. Self-hosted with Lucia or next-auth**
- ✅ Full control
- ✅ Zero auth provider cost
- ⚠️ You manage security
- **Cost:** ₹0, but requires dev time

### Recommendation
- **Phase 1 (10 restaurants):** Self-hosted JWT + Redis sessions (what you have)
- **Phase 2 (50+ restaurants):** Migrate to Supabase Auth (free) or Clerk (₹2,075/month)

---

## Final Recommendations

### Option A: Ultra Low Cost (Year 1)
**Months 1-6: Oracle Cloud Free Tier (₹0)**
- Use always-free tier for everything
- PostgreSQL on free VM
- Redis on free VM
- Zero cost while learning

**Months 7-12: Migrate to Hetzner (₹664/month)**
- When Oracle feels limiting
- More RAM, better performance
- Total Year 1 Cost: ₹3,984

### Option B: Balanced (Startup Recommended)
**Months 1-3: Railway Free Tier (₹0)**
- Zero setup, deploy in minutes
- Learn the platform

**Months 4-12: Hetzner Cloud (₹664/month)**
- Migrate when Railway gets expensive
- Best price/performance
- Total Year 1 Cost: ₹5,976

### Option C: Premium (Zero DevOps)
**All year: Railway (₹830 - ₹4,150/month)**
- Zero infrastructure management
- Auto-scaling
- Focus 100% on product
- Total Year 1 Cost: ₹24,900 - ₹49,800

---

## Migration Strategy

### Path 1: Oracle → Hetzner (Recommended)
```
Months 1-6: Build on Oracle Free (₹0)
  ↓
Month 7: Move to Hetzner CPX11 (₹249)
  ↓
Month 10: Upgrade to CPX21 (₹664)
  ↓
Year 2: Scale to CPX31 (₹1,245)
```

### Path 2: Railway → DigitalOcean
```
Months 1-3: Prototype on Railway Free (₹0)
  ↓
Month 4: Move to DigitalOcean $5 droplet (₹415)
  ↓
Month 8: Add managed database (₹1,245 total)
  ↓
Scale vertically as needed
```

---

## Cost Reduction Strategies

### 1. Use Oracle Always Free for Non-Critical Services
- Staging environment: ₹0
- Background jobs: ₹0
- Backups: ₹0
- **Savings:** ₹1,660/month

### 2. Self-host Database Instead of Managed
- Hetzner VPS with PostgreSQL: ₹664
- vs Managed PostgreSQL: ₹1,245
- **Savings:** ₹581/month

### 3. Use Cloudflare for CDN/Images
- Cloudflare Free tier: ₹0
- vs DigitalOcean Spaces: ₹415
- **Savings:** ₹415/month

### 4. Optimize Docker Images
- Smaller images = faster deploys = less compute
- Alpine Linux base images
- **Savings:** 20-30% compute costs

### 5. Database Connection Pooling
- Use PgBouncer to reduce database load
- **Savings:** Can defer database upgrade 3-6 months

---

## Quick Decision Matrix

**Choose Oracle Cloud Free if:**
- ✅ Budget is ₹0
- ✅ Can handle Arm architecture
- ✅ Comfortable with Linux
- ✅ Don't need 24/7 support

**Choose Hetzner if:**
- ✅ Want cheapest paid option
- ✅ Can manage infrastructure
- ✅ Need predictable costs
- ✅ European data center is okay

**Choose DigitalOcean if:**
- ✅ Want easy managed services
- ✅ Need good documentation
- ✅ Want strong community
- ✅ Budget allows ₹1,000-₹3,000/month

**Choose Railway if:**
- ✅ Zero DevOps time available
- ✅ Need instant deploys
- ✅ Budget allows ₹4,000-₹12,000/month
- ✅ Value developer time over money

**Avoid AWS if:**
- ❌ First-time DevOps
- ❌ Budget under ₹10,000/month
- ❌ Don't need enterprise features
- ❌ Small startup team

---

## Action Plan for You (10 Restaurants → 100)

### Immediate (Next 7 Days)
1. **Sign up for Oracle Cloud Free Tier** - Deploy entire stack for ₹0
2. **Parallel: Sign up for Railway** - Test deployment ease
3. **Keep existing dev setup** - packages/database already works

### Month 1-3 (10-20 Restaurants)
- Run on Oracle Free Tier: **₹0/month**
- Focus on product, not infrastructure
- Learn what resources you actually need

### Month 4-6 (20-50 Restaurants)
- If Oracle is stable: **Stay free (₹0)**
- If Oracle has issues: **Migrate to Hetzner CPX11 (₹249/month)**

### Month 7-12 (50-100 Restaurants)
- **Upgrade to Hetzner CPX21** (₹664/month)
- Add managed PostgreSQL if needed (+₹415/month)
- Total: **₹664 - ₹1,079/month**

### Year 2 (100+ Restaurants)
- **Hetzner CPX31** (₹1,245/month) or
- **DigitalOcean + Managed DB** (₹2,905/month)

---

## Total Cost Summary: First Year

### Conservative Path (Oracle → Hetzner)
```
Months 1-6: ₹0 (Oracle Free)
Months 7-12: ₹664/month × 6 = ₹3,984
Total Year 1: ₹3,984
```

### Balanced Path (Railway → Hetzner)
```
Months 1-3: ₹0 (Railway Free)
Months 4-12: ₹664/month × 9 = ₹5,976
Total Year 1: ₹5,976
```

### Premium Path (Railway Only)
```
Average ₹3,000/month × 12 = ₹36,000
Total Year 1: ₹36,000
```

---

## FAQ

**Q: Is Oracle Free Tier really free forever?**
A: Yes, but only the "Always Free" resources. Read carefully: https://www.oracle.com/cloud/free/

**Q: What if I exceed free tier limits?**
A: Oracle won't auto-charge. You'll hit limits. Hetzner/DO will charge.

**Q: Best for Indian startups?**
A: Oracle (free) or Hetzner (cheapest paid). DigitalOcean has Bangalore datacenter too.

**Q: Can I avoid authentication complexity?**
A: Use Supabase Auth (free) or pay for Clerk (₹2,075/month). Don't reinvent auth.

**Q: What about Vercel/Netlify?**
A: Good for frontend (free tier works), but backend needs separate hosting.

---

## Next Steps

1. **Start with Oracle Cloud Free Tier** - Deploy your existing Prisma + PostgreSQL stack
2. **Set up Railway as backup** - Test both, pick winner after 30 days
3. **Implement cost monitoring** - Track actual usage vs estimates
4. **Plan migration to Hetzner at Month 6** - When you understand real requirements

**Questions? Need help with setup? Let me know which provider you choose and I'll create deployment guide.**
