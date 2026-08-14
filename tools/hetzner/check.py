#!/usr/bin/env python3
"""Check Hetzner Cloud `console.hetzner` API — verifies token, servers, firewall.

Usage:
  HETZNER_TOKEN=... python -m tools.hetzner.check
  python tools/hetzner/check.py --token oPCv...
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import httpx
from rich.console import Console
from rich.table import Table

API = "https://api.hetzner.cloud/v1"
OPEN_PORTS_WARN = {"5432", "6379", "3000", "8080"}

console = Console()


def api_get(token: str, path: str) -> tuple[int, dict]:
    r = httpx.get(f"{API}{path}", headers={"Authorization": f"Bearer {token}"}, timeout=15)
    try:
        body = r.json()
    except Exception:
        body = {"raw": r.text[:2000]}
    return r.status_code, body


def main() -> None:
    ap = argparse.ArgumentParser(description="Hetzner Cloud API check")
    ap.add_argument("--token", default=os.getenv("HETZNER_TOKEN") or os.getenv("HETZNER_API_TOKEN"))
    args = ap.parse_args()
    token: str | None = args.token
    if not token:
        console.print("[red]Set HETZNER_TOKEN env or --token[/red]")
        sys.exit(2)

    # Masked preview
    console.print(f"Token ...{token[-6:]}  fingerprint check via API")

    code, servers = api_get(token, "/servers")
    if code != 200:
        console.print(f"[red]GET /servers -> {code}[/red] {json.dumps(servers)[:500]}")
        sys.exit(1)

    code2, fws = api_get(token, "/firewalls")
    if code2 != 200:
        console.print(f"[red]GET /firewalls -> {code2}[/red]")
        sys.exit(1)

    code3, keys = api_get(token, "/ssh_keys")
    ssh_keys = keys.get("ssh_keys", []) if code3 == 200 else []

    # Servers table
    t = Table(title="Servers")
    t.add_column("id")
    t.add_column("name")
    t.add_column("status")
    t.add_column("type")
    t.add_column("IPv4")
    t.add_column("location")
    for s in servers.get("servers", []):
        t.add_row(
            str(s["id"]),
            s["name"],
            s["status"],
            s["server_type"]["name"],
            s["public_net"]["ipv4"]["ip"],
            s["location"]["name"],
        )
    console.print(t)

    # Firewall table
    tf = Table(title="Firewalls")
    tf.add_column("id")
    tf.add_column("name")
    tf.add_column("in ports")
    for fw in fws.get("firewalls", []):
        ports = ", ".join(r["port"] for r in fw["rules"] if r["direction"] == "in")
        tf.add_row(str(fw["id"]), fw["name"], ports)
    console.print(tf)

    # Warn on world-open DB/cache
    warnings = []
    for fw in fws.get("firewalls", []):
        for r in fw["rules"]:
            if r["direction"] != "in":
                continue
            if r["port"] in OPEN_PORTS_WARN and "0.0.0.0/0" in r["source_ips"]:
                warnings.append(f"FW {fw['name']} ({fw['id']}) port {r['port']} open to 0.0.0.0/0")
    if warnings:
        console.print("[yellow]Warnings:[/yellow]")
        for w in warnings:
            console.print(f"  [yellow]• {w}[/yellow]")
        console.print("Lock 5432/6379 to VPN/bastion. Keep 22/80/443 only world-open.")
    else:
        console.print("[green]No world-open DB/cache ports detected.[/green]")

    # Keys
    if ssh_keys:
        tk = Table(title="SSH keys")
        tk.add_column("name")
        tk.add_column("fingerprint")
        tk.add_column("id")
        for k in ssh_keys:
            tk.add_row(k["name"], k["fingerprint"], str(k["id"]))
        console.print(tk)

    # JSON dump for CI
    out = {"servers": servers.get("servers", []), "firewalls": fws.get("firewalls", []), "warnings": warnings}
    json.dump(out, open("/tmp/hetzner-check.json", "w"), indent=2)
    console.print("Wrote /tmp/hetzner-check.json")


if __name__ == "__main__":
    main()
