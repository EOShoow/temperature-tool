#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""导出 NASA POWER 小时级 T2M 气温数据。

默认导出苏丹港和沙特吉赞 2016-2025 年的逐日逐小时平均气温。
数据源为 NASA POWER Hourly API，参数为 T2M，时间标准为 LST。
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable


API_URL = "https://power.larc.nasa.gov/api/temporal/hourly/point"
DEFAULT_START_YEAR = 2016
DEFAULT_END_YEAR = 2025
DEFAULT_TIME_STANDARD = "LST"
DEFAULT_COMMUNITY = "AG"
PARAMETER = "T2M"
FILL_VALUE = -999.0


@dataclass(frozen=True)
class City:
    city_id: str
    city_zh: str
    city_en: str
    country_zh: str
    country_en: str
    latitude: float
    longitude: float


CITIES = [
    City(
        city_id="port_sudan",
        city_zh="苏丹港",
        city_en="Port Sudan",
        country_zh="苏丹",
        country_en="Sudan",
        latitude=19.6158,
        longitude=37.2164,
    ),
    City(
        city_id="jizan_saudi",
        city_zh="吉赞",
        city_en="Jizan",
        country_zh="沙特阿拉伯",
        country_en="Saudi Arabia",
        latitude=16.8892,
        longitude=42.5511,
    ),
    City(
        city_id="kuwait_city",
        city_zh="科威特市",
        city_en="Kuwait City",
        country_zh="科威特",
        country_en="Kuwait",
        latitude=29.3759,
        longitude=47.9774,
    ),
    City(
        city_id="ahvaz",
        city_zh="阿瓦士",
        city_en="Ahvaz",
        country_zh="伊朗",
        country_en="Iran",
        latitude=31.3183,
        longitude=48.6706,
    ),
    City(
        city_id="basra",
        city_zh="巴士拉",
        city_en="Basra",
        country_zh="伊拉克",
        country_en="Iraq",
        latitude=30.5085,
        longitude=47.7804,
    ),
    City(
        city_id="jacobabad",
        city_zh="雅各布阿巴德",
        city_en="Jacobabad",
        country_zh="巴基斯坦",
        country_en="Pakistan",
        latitude=28.2810,
        longitude=68.4388,
    ),
    City(
        city_id="riyadh",
        city_zh="利雅得",
        city_en="Riyadh",
        country_zh="沙特阿拉伯",
        country_en="Saudi Arabia",
        latitude=24.7136,
        longitude=46.6753,
    ),
    City(
        city_id="mecca",
        city_zh="麦加",
        city_en="Mecca",
        country_zh="沙特阿拉伯",
        country_en="Saudi Arabia",
        latitude=21.3891,
        longitude=39.8579,
    ),
]


def build_url(city: City, year: int, time_standard: str, community: str) -> str:
    query = {
        "parameters": PARAMETER,
        "community": community,
        "latitude": f"{city.latitude:.4f}",
        "longitude": f"{city.longitude:.4f}",
        "start": f"{year}0101",
        "end": f"{year}1231",
        "format": "JSON",
        "time-standard": time_standard,
        "header": "true",
    }
    return API_URL + "?" + urllib.parse.urlencode(query)


def cache_path(cache_dir: Path, url: str) -> Path:
    digest = hashlib.md5(url.encode("utf-8")).hexdigest()
    return cache_dir / f"{digest}.json"


def fetch_json(url: str, cache_dir: Path, refresh: bool, retries: int, sleep: float) -> dict:
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = cache_path(cache_dir, url)
    if path.exists() and path.stat().st_size > 0 and not refresh:
        return json.loads(path.read_text(encoding="utf-8"))

    request = urllib.request.Request(url, headers={"User-Agent": "codex-nasa-power-t2m-export/1.0"})
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = response.read().decode("utf-8")
            data = json.loads(payload)
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            return data
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(sleep * attempt)
    raise RuntimeError(f"NASA POWER 请求失败: {url}\n{last_error}")


def parse_t2m_records(city: City, year: int, data: dict, time_standard: str) -> list[dict]:
    header = data.get("header", {})
    fill_value = float(header.get("fill_value", FILL_VALUE))
    parameter = data.get("properties", {}).get("parameter", {}).get(PARAMETER)
    if not isinstance(parameter, dict):
        raise ValueError(f"{city.city_zh} {year}: JSON 中未找到 properties.parameter.{PARAMETER}")

    rows: list[dict] = []
    for key in sorted(parameter):
        value = parameter[key]
        if value is None:
            t2m_c = ""
        else:
            numeric = float(value)
            t2m_c = "" if numeric <= fill_value else f"{numeric:.2f}"

        dt = datetime.strptime(key, "%Y%m%d%H")
        rows.append(
            {
                "city_id": city.city_id,
                "city_zh": city.city_zh,
                "city_en": city.city_en,
                "country_zh": city.country_zh,
                "country_en": city.country_en,
                "latitude": f"{city.latitude:.4f}",
                "longitude": f"{city.longitude:.4f}",
                "date": dt.strftime("%Y-%m-%d"),
                f"hour_{time_standard.lower()}": f"{dt.hour:02d}",
                f"datetime_{time_standard.lower()}": dt.strftime("%Y-%m-%d %H:00"),
                "t2m_c": t2m_c,
                "source": "NASA POWER Hourly API",
                "parameter": PARAMETER,
                "time_standard": time_standard,
            }
        )
    return rows


def write_csv(path: Path, rows: Iterable[dict], fieldnames: list[str]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
            count += 1
    return count


def build_wide_rows(long_rows: list[dict], time_standard: str) -> list[dict]:
    hour_col = f"hour_{time_standard.lower()}"
    wide: dict[tuple[str, str], dict] = {}
    for row in long_rows:
        key = (row["date"], row[hour_col])
        target = wide.setdefault(key, {"date": row["date"], hour_col: row[hour_col]})
        target[f"{row['city_id']}_t2m_c"] = row["t2m_c"]
    return [wide[key] for key in sorted(wide)]


def summarize(rows: list[dict], cities: list[City], time_standard: str) -> dict:
    hour_col = f"hour_{time_standard.lower()}"
    summary: dict[str, dict] = {}
    for city in cities:
        city_rows = [row for row in rows if row["city_id"] == city.city_id]
        values = [float(row["t2m_c"]) for row in city_rows if row["t2m_c"] != ""]
        missing = len(city_rows) - len(values)
        summary[city.city_id] = {
            "city_zh": city.city_zh,
            "city_en": city.city_en,
            "country_zh": city.country_zh,
            "country_en": city.country_en,
            "latitude": city.latitude,
            "longitude": city.longitude,
            "row_count": len(city_rows),
            "missing_count": missing,
            "date_start": min(row["date"] for row in city_rows),
            "date_end": max(row["date"] for row in city_rows),
            "hour_column": hour_col,
            "t2m_c_min": round(min(values), 2) if values else None,
            "t2m_c_max": round(max(values), 2) if values else None,
            "t2m_c_mean": round(sum(values) / len(values), 2) if values else None,
        }
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="导出 NASA POWER 小时级 T2M 气温数据")
    parser.add_argument("--start-year", type=int, default=DEFAULT_START_YEAR)
    parser.add_argument("--end-year", type=int, default=DEFAULT_END_YEAR)
    parser.add_argument("--time-standard", choices=["LST", "UTC"], default=DEFAULT_TIME_STANDARD)
    parser.add_argument("--community", default=DEFAULT_COMMUNITY)
    parser.add_argument("--out-dir", type=Path, default=Path("data/processed"))
    parser.add_argument("--cache-dir", type=Path, default=Path("data/cache"))
    parser.add_argument("--summary-dir", type=Path, default=Path("data/summary"))
    parser.add_argument(
        "--city-ids",
        default="port_sudan,jizan_saudi",
        help="逗号分隔 city_id；可选: " + ",".join(city.city_id for city in CITIES),
    )
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--sleep", type=float, default=2.0)
    args = parser.parse_args()

    if args.start_year > args.end_year:
        parser.error("--start-year 不能晚于 --end-year")

    city_ids = [item.strip() for item in args.city_ids.split(",") if item.strip()]
    city_by_id = {city.city_id: city for city in CITIES}
    unknown = [city_id for city_id in city_ids if city_id not in city_by_id]
    if unknown:
        parser.error("未知 city_id: " + ",".join(unknown))
    selected_cities = [city_by_id[city_id] for city_id in city_ids]
    selected_slug = "_".join(city.city_id for city in selected_cities)

    all_rows: list[dict] = []
    years = list(range(args.start_year, args.end_year + 1))
    for city in selected_cities:
        print(f"== {city.city_zh} / {city.city_en} ==")
        city_rows: list[dict] = []
        for year in years:
            url = build_url(city, year, args.time_standard, args.community)
            print(f"  fetch {year} {args.time_standard}")
            data = fetch_json(url, args.cache_dir, args.refresh, args.retries, args.sleep)
            rows = parse_t2m_records(city, year, data, args.time_standard)
            city_rows.extend(rows)
        all_rows.extend(city_rows)

        city_path = args.out_dir / f"{city.city_id}_t2m_hourly_{args.start_year}_{args.end_year}_{args.time_standard.lower()}.csv"
        fieldnames = list(city_rows[0].keys())
        written = write_csv(city_path, city_rows, fieldnames)
        print(f"  wrote {written}: {city_path}")

    fieldnames = list(all_rows[0].keys())
    combined_path = args.out_dir / (
        f"nasa_power_t2m_hourly_{args.start_year}_{args.end_year}_"
        f"{selected_slug}_{args.time_standard.lower()}.csv"
    )
    combined_count = write_csv(combined_path, all_rows, fieldnames)

    wide_rows = build_wide_rows(all_rows, args.time_standard)
    wide_path = args.out_dir / (
        f"nasa_power_t2m_by_date_hour_{args.start_year}_{args.end_year}_"
        f"{selected_slug}_{args.time_standard.lower()}.csv"
    )
    wide_fields = [
        "date",
        f"hour_{args.time_standard.lower()}",
        *[f"{city.city_id}_t2m_c" for city in selected_cities],
    ]
    wide_count = write_csv(wide_path, wide_rows, wide_fields)

    summary = {
        "source": "NASA POWER Hourly API",
        "endpoint": API_URL,
        "parameter": PARAMETER,
        "parameter_meaning": "2-meter air temperature, hourly average, degree Celsius",
        "community": args.community,
        "time_standard": args.time_standard,
        "start_year": args.start_year,
        "end_year": args.end_year,
        "combined_rows": combined_count,
        "wide_rows": wide_count,
        "city_ids": city_ids,
        "selected_slug": selected_slug,
        "cities": summarize(all_rows, selected_cities, args.time_standard),
        "outputs": {
            "combined_csv": str(combined_path),
            "wide_csv": str(wide_path),
        },
    }
    args.summary_dir.mkdir(parents=True, exist_ok=True)
    summary_path = args.summary_dir / (
        f"nasa_power_t2m_export_summary_{args.start_year}_{args.end_year}_{selected_slug}_{args.time_standard.lower()}.json"
    )
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {combined_count}: {combined_path}")
    print(f"wrote {wide_count}: {wide_path}")
    print(f"wrote summary: {summary_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
