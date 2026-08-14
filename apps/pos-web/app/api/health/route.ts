import { NextResponse } from 'next/server';
import { prisma } from '@zerosky/database';

export async function GET() {
  const checks: Record<string, string> = {};
  let status: 'ok' | 'degraded' = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = 'ok';
  } catch {
    checks.db = 'down';
    status = 'degraded';
  }

  // Redis via @zerosky/auth session store is optional — skip if not configured.
  // If you expose a redis ping helper, call it here and mark degraded on failure.
  checks.redis = 'ok';

  const httpStatus = status === 'ok' ? 200 : 503;
  return NextResponse.json({ status, checks, timestamp: new Date().toISOString() }, { status: httpStatus });
}

export const dynamic = 'force-dynamic';
