#!/usr/bin/env python3
"""Update public usage stats from GoatCounter aggregate API."""

from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


API_BASE = os.environ.get("GOATCOUNTER_API_BASE", "https://eoshow.goatcounter.com/api/v0")
API_TOKEN = os.environ.get("GOATCOUNTER_API_TOKEN", "")
OUTPUT_PATH = Path(os.environ.get("USAGE_STATS_OUTPUT", "web/usage-stats.json"))
START_AT = os.environ.get("GOATCOUNTER_STATS_START", "2026-06-01T00:00:00Z")

STAT_PATHS = {
    "completed_exports": "temperature-tool-run-complete",
    "excel_downloads": "temperature-tool-download-excel",
}


def request_json(path: str, query_params: dict[str, object]) -> dict:
    query = urllib.parse.urlencode(query_params, doseq=True)
    request = urllib.request.Request(
        f"{API_BASE.rstrip('/')}{path}?{query}",
        headers={
            "Authorization": f"Bearer {API_TOKEN}",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "temperature-tool-usage-stats/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def fetch_path_ids() -> dict[str, int]:
    path_ids: dict[str, int] = {}
    after = 0
    while True:
        params = {"Limit": 200}
        if after:
            params["After"] = after
        payload = request_json("/paths", params)
        paths = payload.get("paths", [])
        for row in paths:
            path = str(row.get("path", ""))
            if path in STAT_PATHS.values():
                path_ids[path] = int(row["id"])
            after = max(after, int(row.get("id", after)))
        if not payload.get("more"):
            return path_ids


def fetch_total(path_id: int, end_at: str) -> int:
    payload = request_json(
        "/stats/total",
        {
            "start": START_AT,
            "end": end_at,
            "include_paths": [str(path_id)],
        },
    )
    return int(payload.get("total", 0))


def main() -> int:
    if not API_TOKEN:
        print("GOATCOUNTER_API_TOKEN is not set; leaving usage stats unchanged.", file=sys.stderr)
        return 0

    end_at = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0).isoformat().replace("+00:00", "Z")
    path_ids = fetch_path_ids()
    stats = {
        key: fetch_total(path_ids[path], end_at) if path in path_ids else 0
        for key, path in STAT_PATHS.items()
    }
    payload = {
        "ready": True,
        "completed_exports": stats["completed_exports"],
        "excel_downloads": stats["excel_downloads"],
        "updated_at": end_at,
        "source": "GoatCounter anonymous aggregate stats",
        "window": {
            "start": START_AT,
            "end": end_at,
        },
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUT_PATH}: {payload}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
