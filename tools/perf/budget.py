#!/usr/bin/env python3
"""Bundle budget — fails CI if chunk budget exceeded. No deps beyond stdlib.

Usage: python -m tools.perf.budget [--budget-kb 350] [--next-dir apps/pos-web/.next]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

DEFAULT_BUDGET_KB = 350  # framework + main + largest chunk


def main() -> None:
    ap = argparse.ArgumentParser(description="Next.js chunk budget check")
    ap.add_argument("--budget-kb", type=int, default=DEFAULT_BUDGET_KB)
    ap.add_argument("--next-dir", default="apps/pos-web/.next")
    ap.add_argument("--json-out", default="/tmp/bundle-budget.json")
    args = ap.parse_args()

    chunks_dir = Path(args.next_dir) / "static" / "chunks"
    if not chunks_dir.exists():
        print(f"chunks dir not found: {chunks_dir}", file=sys.stderr)
        sys.exit(2)

    files = sorted(chunks_dir.glob("*.js"), key=lambda p: p.stat().st_size, reverse=True)
    total = sum(f.stat().st_size for f in files)
    top = [(f.name, f.stat().st_size) for f in files[:10]]

    print(f"chunks: {len(files)}  total {(total/1024):.0f} KB  budget wall {args.budget_kb} KB (largest single)")
    for name, sz in top:
        print(f"  {(sz/1024):6.1f} KB  {name}")

    # Budget on largest single chunk — the bottleneck for parse/compile
    largest = files[0].stat().st_size / 1024 if files else 0
    result = {
        "chunks": len(files),
        "total_kb": round(total / 1024, 1),
        "largest_kb": round(largest, 1),
        "budget_kb": args.budget_kb,
        "top": [{"name": n, "kb": round(s / 1024, 1)} for n, s in top],
        "pass": largest <= args.budget_kb,
    }
    Path(args.json_out).write_text(json.dumps(result, indent=2))
    print(f"Wrote {args.json_out}  pass={result['pass']}")

    if not result["pass"]:
        print(f"FAIL largest chunk {largest:.0f}KB > budget {args.budget_kb}KB", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
