#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按 10°C 寿命减半规则分析全球候选热城的温度严苛度。

指标：
    damage_index = mean(2 ** (T2M / 10))
    equivalent_temperature = 10 * log2(damage_index)

其中 T2M 使用 NASA POWER Hourly API 的 2 米气温小时平均值，单位摄氏度。
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path


API_URL = "https://power.larc.nasa.gov/api/temporal/hourly/point"
START_YEAR = 2016
END_YEAR = 2025
TIME_STANDARD = "LST"
PARAMETER = "T2M"


@dataclass(frozen=True)
class Candidate:
    place_id: str
    place_zh: str
    place_en: str
    country_zh: str
    country_en: str
    latitude: float
    longitude: float


CANDIDATES = [
    Candidate("kuwait_city", "科威特市", "Kuwait City", "科威特", "Kuwait", 29.3759, 47.9774),
    Candidate("port_sudan", "苏丹港", "Port Sudan", "苏丹", "Sudan", 19.6158, 37.2164),
    Candidate("jizan_saudi", "吉赞", "Jizan", "沙特阿拉伯", "Saudi Arabia", 16.8892, 42.5511),
    Candidate("jeddah", "吉达", "Jeddah", "沙特阿拉伯", "Saudi Arabia", 21.4858, 39.1925),
    Candidate("mecca", "麦加", "Mecca", "沙特阿拉伯", "Saudi Arabia", 21.3891, 39.8579),
    Candidate("al_hudaydah", "荷台达", "Al Hudaydah", "也门", "Yemen", 14.7978, 42.9545),
    Candidate("assab", "阿萨布", "Assab", "厄立特里亚", "Eritrea", 13.0092, 42.7394),
    Candidate("djibouti", "吉布提市", "Djibouti City", "吉布提", "Djibouti", 11.5721, 43.1456),
    Candidate("gao", "加奥", "Gao", "马里", "Mali", 16.2717, -0.0447),
    Candidate("timbuktu", "廷巴克图", "Timbuktu", "马里", "Mali", 16.7666, -3.0026),
    Candidate("ndjamena", "恩贾梅纳", "N'Djamena", "乍得", "Chad", 12.1348, 15.0557),
    Candidate("jacobabad", "雅各布阿巴德", "Jacobabad", "巴基斯坦", "Pakistan", 28.2810, 68.4388),
    Candidate("turbat", "图尔伯德", "Turbat", "巴基斯坦", "Pakistan", 26.0023, 63.0500),
    Candidate("basra", "巴士拉", "Basra", "伊拉克", "Iraq", 30.5085, 47.7804),
    Candidate("ahvaz", "阿瓦士", "Ahvaz", "伊朗", "Iran", 31.3183, 48.6706),
    Candidate("doha", "多哈", "Doha", "卡塔尔", "Qatar", 25.2854, 51.5310),
    Candidate("dubai", "迪拜", "Dubai", "阿联酋", "United Arab Emirates", 25.2048, 55.2708),
    Candidate("abu_dhabi", "阿布扎比", "Abu Dhabi", "阿联酋", "United Arab Emirates", 24.4539, 54.3773),
    Candidate("riyadh", "利雅得", "Riyadh", "沙特阿拉伯", "Saudi Arabia", 24.7136, 46.6753),
    Candidate("aswan", "阿斯旺", "Aswan", "埃及", "Egypt", 24.0889, 32.8998),
    Candidate("furnace_creek", "Furnace Creek", "Furnace Creek", "美国", "United States", 36.4570, -116.8669),
]


def build_url(candidate: Candidate, year: int) -> str:
    query = {
        "parameters": PARAMETER,
        "community": "AG",
        "latitude": f"{candidate.latitude:.4f}",
        "longitude": f"{candidate.longitude:.4f}",
        "start": f"{year}0101",
        "end": f"{year}1231",
        "format": "JSON",
        "time-standard": TIME_STANDARD,
        "header": "true",
    }
    return API_URL + "?" + urllib.parse.urlencode(query)


def cache_path(cache_dir: Path, url: str) -> Path:
    return cache_dir / (hashlib.md5(url.encode("utf-8")).hexdigest() + ".json")


def fetch_json(url: str, cache_dir: Path, retries: int = 5) -> dict:
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = cache_path(cache_dir, url)
    if path.exists() and path.stat().st_size > 0:
        return json.loads(path.read_text(encoding="utf-8"))

    request = urllib.request.Request(url, headers={"User-Agent": "codex-arrhenius-temperature-severity/1.0"})
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = response.read().decode("utf-8")
            data = json.loads(payload)
            path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            return data
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(2 * attempt)
    raise RuntimeError(f"NASA POWER 请求失败: {url}\n{last_error}")


def percentile(values: list[float], percent: float) -> float:
    ordered = sorted(values)
    k = (len(ordered) - 1) * percent / 100
    lower = math.floor(k)
    upper = math.ceil(k)
    if lower == upper:
        return ordered[int(k)]
    return ordered[lower] * (upper - k) + ordered[upper] * (k - lower)


def read_hourly_t2m(candidate: Candidate, cache_dir: Path) -> list[float]:
    values: list[float] = []
    for year in range(START_YEAR, END_YEAR + 1):
        data = fetch_json(build_url(candidate, year), cache_dir)
        parameter = data.get("properties", {}).get("parameter", {}).get(PARAMETER)
        if not isinstance(parameter, dict):
            raise ValueError(f"{candidate.place_zh} {year}: 未找到 {PARAMETER}")
        for value in parameter.values():
            if value is None:
                continue
            numeric = float(value)
            if numeric > -900:
                values.append(numeric)
    return values


def analyze(candidate: Candidate, values: list[float]) -> dict:
    damage_index = sum(2 ** (value / 10) for value in values) / len(values)
    equivalent_temperature = 10 * math.log(damage_index, 2)
    return {
        "place_id": candidate.place_id,
        "place_zh": candidate.place_zh,
        "place_en": candidate.place_en,
        "country_zh": candidate.country_zh,
        "country_en": candidate.country_en,
        "latitude": candidate.latitude,
        "longitude": candidate.longitude,
        "hour_count": len(values),
        "mean_t2m_c": round(statistics.mean(values), 2),
        "arrhenius_10c_equivalent_t_c": round(equivalent_temperature, 2),
        "damage_index": damage_index,
        "p95_t2m_c": round(percentile(values, 95), 2),
        "p99_t2m_c": round(percentile(values, 99), 2),
        "max_t2m_c": round(max(values), 2),
        "hours_ge_40c": sum(value >= 40 for value in values),
        "hours_ge_45c": sum(value >= 45 for value in values),
    }


def main() -> int:
    cache_dir = Path("data/cache")
    summary_dir = Path("data/summary")
    summary_dir.mkdir(parents=True, exist_ok=True)

    results = []
    for candidate in CANDIDATES:
        print(f"analyze {candidate.place_zh}")
        values = read_hourly_t2m(candidate, cache_dir)
        results.append(analyze(candidate, values))

    kuwait_damage = next(row["damage_index"] for row in results if row["place_id"] == "kuwait_city")
    results.sort(key=lambda row: row["damage_index"], reverse=True)
    for index, row in enumerate(results, start=1):
        row["rank"] = index
        row["damage_ratio_vs_kuwait_city"] = round(row["damage_index"] / kuwait_damage, 3)
        row["damage_index"] = round(row["damage_index"], 6)

    csv_path = summary_dir / "arrhenius_10c_halving_severity_2016_2025.csv"
    fieldnames = [
        "rank",
        "place_id",
        "place_zh",
        "place_en",
        "country_zh",
        "country_en",
        "latitude",
        "longitude",
        "hour_count",
        "mean_t2m_c",
        "arrhenius_10c_equivalent_t_c",
        "damage_index",
        "damage_ratio_vs_kuwait_city",
        "p95_t2m_c",
        "p99_t2m_c",
        "max_t2m_c",
        "hours_ge_40c",
        "hours_ge_45c",
    ]
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)

    json_path = summary_dir / "arrhenius_10c_halving_severity_2016_2025.json"
    payload = {
        "method": "damage_index = mean(2 ** (T2M_C / 10)); equivalent_temperature = 10 * log2(damage_index)",
        "source": "NASA POWER Hourly API",
        "endpoint": API_URL,
        "parameter": PARAMETER,
        "time_standard": TIME_STANDARD,
        "start_year": START_YEAR,
        "end_year": END_YEAR,
        "results": results,
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {csv_path}")
    print(f"wrote {json_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
