#!/usr/bin/env python3
"""Explain hot queries — prints EXPLAIN ANALYZE for the indexes we rely on.

Needs DATABASE_URL env. Read-only — uses EXPLAIN, not EXPLAIN ANALYZE on prod
by default (set --analyze to actually run).

Usage: DATABASE_URL=... python -m tools.db.explain
"""
from __future__ import annotations

import argparse
import os
import sys

QUERIES = {
    "billing_queue": "EXPLAIN SELECT * FROM \"orders\" WHERE \"branchId\" = '00000000-0000-0000-0000-000000000000' AND status IN ('SERVED','BILLED') ORDER BY \"createdAt\" DESC LIMIT 50",
    "daily_sales": "EXPLAIN SELECT date_trunc('day', \"createdAt\")::date, SUM(\"grandTotal\") FROM \"orders\" WHERE \"branchId\" = '00000000-0000-0000-0000-000000000000' AND status='PAID' GROUP BY 1",
    "gst_report": "EXPLAIN SELECT \"taxRate\", SUM(\"lineTotal\") FROM \"order_items\" JOIN \"orders\" ON \"orders\".id = \"order_items\".\"orderId\" WHERE \"orders\".\"branchId\"='00000000-0000-0000-0000-000000000000' GROUP BY \"taxRate\"",
}


def main() -> None:
    ap = argparse.ArgumentParser(description="DB EXPLAIN for hot queries")
    ap.add_argument("--analyze", action="store_true", help="use EXPLAIN ANALYZE (runs query)")
    ap.add_argument("--query", choices=list(QUERIES.keys()), default=None)
    args = ap.parse_args()

    url = os.getenv("DATABASE_URL")
    if not url:
        print("Set DATABASE_URL", file=sys.stderr)
        sys.exit(2)

    try:
        import psycopg  # psycopg 3
    except ImportError:
        print("pip install psycopg[binary]", file=sys.stderr)
        sys.exit(2)

    targets = [args.query] if args.query else list(QUERIES.keys())
    with psycopg.connect(url) as conn:
        for name in targets:
            sql = QUERIES[name]
            if args.analyze:
                sql = sql.replace("EXPLAIN ", "EXPLAIN ANALYZE ")
            print(f"\n== {name} ==")
            print(sql)
            for row in conn.execute(sql):
                print(row[0])


if __name__ == "__main__":
    main()
