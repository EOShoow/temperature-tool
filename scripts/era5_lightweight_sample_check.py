#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ERA5-Land lightweight sampling check against existing NASA POWER CSV data.

This is a side-path validator. It reads existing NASA POWER long-table CSVs,
samples a small number of city-hour points, fetches matching ERA5-Land hourly
2m temperature from Open-Meteo's archive API, and writes comparison summaries.
It intentionally does not modify any NASA POWER web UI, export scripts, caches,
or workbooks.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import random
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable


OPEN_METEO_ARCHIVE_API = "https://archive-api.open-meteo.com/v1/archive"
DEFAULT_NASA_CSV_GLOB = "data/processed/nasa_power_t2m_hourly_2016_2025_*_lst.csv"
DEFAULT_OUTPUT_PREFIX = "era5_lightweight_sample_check"
DEFAULT_SEED = 20260512
DEFAULT_SAMPLE_SIZE = 100
DEFAULT_MEAN_THRESHOLD_C = 1.5
DEFAULT_TAIL_THRESHOLD_C = 3.0
DEFAULT_TAIL_VOTE_THRESHOLD_C = 4.0
DEFAULT_POINT_HARD_THRESHOLD_C = 6.0
DEFAULT_RETRIES = 4
DEFAULT_SLEEP_SECONDS = 0.5


@dataclass(frozen=True)
class NasaRecord:
    city_id: str
    city_zh: str
    city_en: str
    country_zh: str
    country_en: str
    latitude: float
    longitude: float
    date: str
    hour_lst: int
    datetime_lst: datetime
    t2m_c: float


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Lightweight ERA5-Land sampling check for existing NASA POWER hourly T2M CSVs."
    )
    parser.add_argument(
        "--nasa-csv",
        type=Path,
        default=None,
        help="Existing NASA POWER long-table CSV. If omitted, the widest matching local CSV is used.",
    )
    parser.add_argument(
        "--cities",
        default="",
        help="Comma-separated city_id list. Default: all cities in the selected NASA CSV.",
    )
    parser.add_argument("--sample-size", type=int, default=DEFAULT_SAMPLE_SIZE)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--mean-threshold-c", type=float, default=DEFAULT_MEAN_THRESHOLD_C)
    parser.add_argument("--tail-threshold-c", type=float, default=DEFAULT_TAIL_THRESHOLD_C)
    parser.add_argument("--tail-vote-threshold-c", type=float, default=DEFAULT_TAIL_VOTE_THRESHOLD_C)
    parser.add_argument("--point-hard-threshold-c", type=float, default=DEFAULT_POINT_HARD_THRESHOLD_C)
    parser.add_argument("--cache-dir", type=Path, default=Path("data/era5_sample_cache/open_meteo"))
    parser.add_argument(
        "--fetch-granularity",
        choices=["year", "day"],
        default="year",
        help="ERA5 request range for sampled points. year is faster; day is stricter but much slower.",
    )
    parser.add_argument("--summary-dir", type=Path, default=Path("data/summary"))
    parser.add_argument("--report-path", type=Path, default=Path("docs/era5_lightweight_sample_check_report.md"))
    parser.add_argument("--output-prefix", default=DEFAULT_OUTPUT_PREFIX)
    parser.add_argument("--refresh", action="store_true", help="Ignore cached ERA5/Open-Meteo responses.")
    parser.add_argument("--no-fetch", action="store_true", help="Only create the NASA sample plan; do not fetch ERA5.")
    parser.add_argument("--retries", type=int, default=DEFAULT_RETRIES)
    parser.add_argument("--sleep", type=float, default=DEFAULT_SLEEP_SECONDS)
    return parser.parse_args(argv)


def discover_nasa_csv() -> Path:
    candidates = sorted(Path(".").glob(DEFAULT_NASA_CSV_GLOB))
    if not candidates:
        raise FileNotFoundError(f"未找到 NASA 长表 CSV: {DEFAULT_NASA_CSV_GLOB}")
    return max(candidates, key=lambda path: path.stat().st_size)


def read_nasa_records(path: Path) -> dict[str, list[NasaRecord]]:
    grouped: dict[str, list[NasaRecord]] = defaultdict(list)
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {
            "city_id",
            "city_zh",
            "city_en",
            "country_zh",
            "country_en",
            "latitude",
            "longitude",
            "date",
            "hour_lst",
            "datetime_lst",
            "t2m_c",
        }
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"{path} 缺少字段: {', '.join(sorted(missing))}")

        for row in reader:
            raw_t2m = (row.get("t2m_c") or "").strip()
            if not raw_t2m:
                continue
            try:
                t2m_c = float(raw_t2m)
                latitude = float(row["latitude"])
                longitude = float(row["longitude"])
                hour_lst = int(row["hour_lst"])
                dt_lst = datetime.strptime(row["datetime_lst"], "%Y-%m-%d %H:%M")
            except (TypeError, ValueError):
                continue
            record = NasaRecord(
                city_id=row["city_id"],
                city_zh=row["city_zh"],
                city_en=row["city_en"],
                country_zh=row["country_zh"],
                country_en=row["country_en"],
                latitude=latitude,
                longitude=longitude,
                date=row["date"],
                hour_lst=hour_lst,
                datetime_lst=dt_lst,
                t2m_c=t2m_c,
            )
            grouped[record.city_id].append(record)

    for city_id in grouped:
        grouped[city_id].sort(key=lambda item: (item.datetime_lst, item.t2m_c))
    return dict(grouped)


def percentile(values: list[float], percent: float) -> float:
    if not values:
        return float("nan")
    ordered = sorted(values)
    k = (len(ordered) - 1) * percent / 100
    lower = math.floor(k)
    upper = math.ceil(k)
    if lower == upper:
        return ordered[int(k)]
    return ordered[lower] * (upper - k) + ordered[upper] * (k - lower)


def stable_sample(pool: list[NasaRecord], count: int, seed_key: str) -> list[NasaRecord]:
    if count <= 0 or not pool:
        return []
    rng = random.Random(seed_key)
    if len(pool) <= count:
        shuffled = list(pool)
        rng.shuffle(shuffled)
        return shuffled
    return rng.sample(pool, count)


def sample_city(records: list[NasaRecord], sample_size: int, seed: int) -> list[tuple[str, NasaRecord]]:
    if sample_size <= 0:
        raise ValueError("--sample-size 必须大于 0")

    values = [record.t2m_c for record in records]
    p95 = percentile(values, 95)
    p99 = percentile(values, 99)
    p95_pool = [record for record in records if p95 <= record.t2m_c < p99]
    tail_pool = [record for record in records if record.t2m_c >= p99]

    p95_count = round(sample_size * 0.2)
    tail_count = round(sample_size * 0.2)
    random_count = sample_size - p95_count - tail_count

    selected: list[tuple[str, NasaRecord]] = []
    used_keys: set[tuple[str, int]] = set()

    city_id = records[0].city_id
    for stratum, pool, count in (
        ("random", records, random_count),
        ("p95_p99", p95_pool, p95_count),
        ("tail", tail_pool, tail_count),
    ):
        for record in stable_sample(pool, count, f"{seed}:{city_id}:{stratum}"):
            key = (record.date, record.hour_lst)
            if key not in used_keys:
                selected.append((stratum, record))
                used_keys.add(key)

    if len(selected) < sample_size:
        remaining = [record for record in records if (record.date, record.hour_lst) not in used_keys]
        for record in stable_sample(remaining, sample_size - len(selected), f"{seed}:{city_id}:fill"):
            selected.append(("fill", record))
            used_keys.add((record.date, record.hour_lst))

    selected.sort(key=lambda item: (item[1].datetime_lst, item[0]))
    return selected[:sample_size]


def round_to_nearest_hour(dt: datetime) -> datetime:
    rounded = dt + timedelta(minutes=30)
    return rounded.replace(minute=0, second=0, microsecond=0)


def lst_to_utc_nearest_hour(dt_lst: datetime, longitude: float) -> datetime:
    utc_estimate = dt_lst - timedelta(hours=longitude / 15.0)
    return round_to_nearest_hour(utc_estimate)


def build_open_meteo_url(record: NasaRecord, start_date: str, end_date: str) -> str:
    params = {
        "latitude": f"{record.latitude:.4f}",
        "longitude": f"{record.longitude:.4f}",
        "start_date": start_date,
        "end_date": end_date,
        "hourly": "temperature_2m",
        "temperature_unit": "celsius",
        "timezone": "UTC",
        "models": "era5_land",
    }
    return OPEN_METEO_ARCHIVE_API + "?" + urllib.parse.urlencode(params)


def cache_path(cache_dir: Path, url: str) -> Path:
    digest = hashlib.md5(url.encode("utf-8")).hexdigest()
    return cache_dir / f"{digest}.json"


def fetch_json(url: str, cache_dir: Path, refresh: bool, retries: int, sleep: float) -> dict:
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = cache_path(cache_dir, url)
    if path.exists() and path.stat().st_size > 0 and not refresh:
        return json.loads(path.read_text(encoding="utf-8"))

    request = urllib.request.Request(url, headers={"User-Agent": "codex-era5-lightweight-sample-check/1.0"})
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = response.read().decode("utf-8")
            data = json.loads(payload)
            if "error" in data:
                raise RuntimeError(data.get("reason") or data["error"])
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            return data
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, RuntimeError) as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(sleep * attempt)
    raise RuntimeError(f"ERA5/Open-Meteo 请求失败: {url}\n{last_error}")


def extract_era5_temperature(data: dict, utc_dt: datetime) -> float | None:
    hourly = data.get("hourly", {})
    times = hourly.get("time")
    values = hourly.get("temperature_2m")
    if not isinstance(times, list) or not isinstance(values, list):
        return None
    lookup = dict(zip(times, values))
    value = lookup.get(utc_dt.strftime("%Y-%m-%dT%H:00"))
    if value is None:
        return None
    return float(value)


def compare_samples(
    samples_by_city: dict[str, list[tuple[str, NasaRecord]]],
    cache_dir: Path,
    refresh: bool,
    retries: int,
    sleep: float,
    no_fetch: bool,
    fetch_granularity: str,
) -> list[dict]:
    rows: list[dict] = []
    response_cache: dict[str, dict] = {}
    for city_id, samples in samples_by_city.items():
        print(f"check {city_id}: {len(samples)} sample points", flush=True)
        for index, (stratum, record) in enumerate(samples, start=1):
            utc_dt = lst_to_utc_nearest_hour(record.datetime_lst, record.longitude)
            era5_t2m_c: float | None = None
            fetch_status = "skipped"
            source_url = ""
            if not no_fetch:
                if fetch_granularity == "year":
                    start_date = f"{utc_dt.year}-01-01"
                    end_date = f"{utc_dt.year}-12-31"
                else:
                    start_date = utc_dt.strftime("%Y-%m-%d")
                    end_date = start_date
                source_url = build_open_meteo_url(record, start_date, end_date)
                if source_url not in response_cache:
                    response_cache[source_url] = fetch_json(source_url, cache_dir, refresh, retries, sleep)
                data = response_cache[source_url]
                era5_t2m_c = extract_era5_temperature(data, utc_dt)
                fetch_status = "ok" if era5_t2m_c is not None else "missing"

            diff_c = "" if era5_t2m_c is None else round(era5_t2m_c - record.t2m_c, 3)
            abs_diff_c = "" if era5_t2m_c is None else round(abs(era5_t2m_c - record.t2m_c), 3)
            rows.append(
                {
                    "city_id": city_id,
                    "city_zh": record.city_zh,
                    "city_en": record.city_en,
                    "country_zh": record.country_zh,
                    "country_en": record.country_en,
                    "latitude": f"{record.latitude:.4f}",
                    "longitude": f"{record.longitude:.4f}",
                    "sample_index": index,
                    "stratum": stratum,
                    "nasa_datetime_lst": record.datetime_lst.strftime("%Y-%m-%d %H:%M"),
                    "nasa_date": record.date,
                    "nasa_hour_lst": f"{record.hour_lst:02d}",
                    "era5_datetime_utc": utc_dt.strftime("%Y-%m-%d %H:%M"),
                    "nasa_t2m_c": round(record.t2m_c, 3),
                    "era5_t2m_c": "" if era5_t2m_c is None else round(era5_t2m_c, 3),
                    "diff_era5_minus_nasa_c": diff_c,
                    "abs_diff_c": abs_diff_c,
                    "fetch_status": fetch_status,
                    "era5_source": "Open-Meteo Historical Weather API / ERA5-Land",
                    "era5_url": source_url,
                }
            )
    return rows


def mean(values: list[float]) -> float:
    return statistics.mean(values) if values else float("nan")


def summarize_city(
    rows: list[dict],
    mean_threshold_c: float,
    tail_threshold_c: float,
    tail_vote_threshold_c: float,
    point_hard_threshold_c: float,
) -> list[dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[row["city_id"]].append(row)

    summaries: list[dict] = []
    for city_id, city_rows in sorted(grouped.items()):
        compared = [row for row in city_rows if isinstance(row["era5_t2m_c"], (int, float))]
        missing_count = len(city_rows) - len(compared)
        if not compared:
            summaries.append(
                {
                    "city_id": city_id,
                    "city_zh": city_rows[0]["city_zh"],
                    "sample_count": len(city_rows),
                    "compared_count": 0,
                    "missing_count": missing_count,
                    "status": "需第三/第四源投票",
                    "reason": "ERA5 抽样点未返回可比较温度",
                }
            )
            continue

        nasa_values = [float(row["nasa_t2m_c"]) for row in compared]
        era5_values = [float(row["era5_t2m_c"]) for row in compared]
        abs_diffs = [float(row["abs_diff_c"]) for row in compared]
        mean_bias = mean(era5_values) - mean(nasa_values)

        p95_rows = [row for row in compared if row["stratum"] == "p95_p99"]
        tail_rows = [row for row in compared if row["stratum"] == "tail"]
        p95_bias = (
            mean([float(row["era5_t2m_c"]) for row in p95_rows])
            - mean([float(row["nasa_t2m_c"]) for row in p95_rows])
            if p95_rows
            else float("nan")
        )
        tail_bias = (
            mean([float(row["era5_t2m_c"]) for row in tail_rows])
            - mean([float(row["nasa_t2m_c"]) for row in tail_rows])
            if tail_rows
            else float("nan")
        )
        point_p95_abs_diff = percentile(abs_diffs, 95)

        tail_checks = [
            abs(value)
            for value in (p95_bias, tail_bias)
            if not math.isnan(value)
        ]
        max_tail_bias_abs = max(tail_checks) if tail_checks else float("nan")
        missing_pass = missing_count == 0
        reasons: list[str] = []
        mean_abs = abs(mean_bias)
        point_hard_trigger = point_p95_abs_diff > point_hard_threshold_c
        tail_vote_trigger = not math.isnan(max_tail_bias_abs) and max_tail_bias_abs > tail_vote_threshold_c
        tail_mark_trigger = not math.isnan(max_tail_bias_abs) and max_tail_bias_abs > tail_threshold_c

        if not missing_pass:
            reasons.append(f"ERA5 缺测 {missing_count} 点")
        if mean_abs > mean_threshold_c:
            reasons.append(f"抽样均值偏差 {abs(mean_bias):.2f}°C > {mean_threshold_c:.2f}°C")
        if tail_vote_trigger:
            reasons.append(f"高温分层均值偏差 {max_tail_bias_abs:.2f}°C > {tail_vote_threshold_c:.2f}°C")
        if point_hard_trigger:
            reasons.append(f"单点绝对偏差 P95 {point_p95_abs_diff:.2f}°C > {point_hard_threshold_c:.2f}°C")

        if reasons:
            status = "需第三/第四源投票"
            reason = "；".join(reasons)
        elif tail_mark_trigger:
            status = "双源基本一致，高温尾部需标注"
            reason = f"抽样均值通过；高温分层均值偏差 {max_tail_bias_abs:.2f}°C 位于 {tail_threshold_c:.2f}-{tail_vote_threshold_c:.2f}°C 标注区间"
        else:
            status = "双源一致"
            reason = "抽样均值和高温尾部低于工程阈值；单点 P95 未触发硬异常线"

        summaries.append(
            {
                "city_id": city_id,
                "city_zh": city_rows[0]["city_zh"],
                "city_en": city_rows[0]["city_en"],
                "country_zh": city_rows[0]["country_zh"],
                "country_en": city_rows[0]["country_en"],
                "latitude": city_rows[0]["latitude"],
                "longitude": city_rows[0]["longitude"],
                "sample_count": len(city_rows),
                "compared_count": len(compared),
                "missing_count": missing_count,
                "nasa_mean_sample_t2m_c": round(mean(nasa_values), 3),
                "era5_mean_sample_t2m_c": round(mean(era5_values), 3),
                "mean_bias_era5_minus_nasa_c": round(mean_bias, 3),
                "mean_abs_diff_c": round(mean(abs_diffs), 3),
                "p95_abs_point_diff_c": round(point_p95_abs_diff, 3),
                "max_abs_point_diff_c": round(max(abs_diffs), 3),
                "p95_band_mean_bias_c": "" if math.isnan(p95_bias) else round(p95_bias, 3),
                "tail_mean_bias_c": "" if math.isnan(tail_bias) else round(tail_bias, 3),
                "mean_threshold_c": mean_threshold_c,
                "tail_threshold_c": tail_threshold_c,
                "tail_vote_threshold_c": tail_vote_threshold_c,
                "point_hard_threshold_c": point_hard_threshold_c,
                "status": status,
                "reason": reason,
            }
        )
    return summaries


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


def write_report(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    summaries = payload["city_summaries"]
    lines = [
        "# ERA5-Land 轻量抽样校验报告",
        "",
        "## 口径",
        "",
        "- 目标：基于 NASA POWER 已有长表 CSV 随机打点，用 ERA5-Land 做轻量旁路校验。",
        f"- NASA 输入：`{payload['nasa_csv']}`。",
        f"- 抽样：每城 `{payload['sample_size']}` 点，固定随机种子 `{payload['seed']}`；`60%` 全时段随机、`20%` NASA `P95-P99`、`20%` NASA 最高温尾部。",
        "- ERA5 来源：Open-Meteo Historical Weather API 的 `era5_land` 模型，变量 `temperature_2m`，单位摄氏度。",
        f"- ERA5 拉取粒度：`{payload['fetch_granularity']}`；默认按抽样点所在 UTC 年份批量缓存，以减少请求次数。",
        "- 时间对齐：NASA 当前为 `LST`；ERA5 为 `UTC`。本脚本按 `UTC = LST - longitude / 15` 近似换算，并取最近整点。",
        f"- 判定阈值：抽样均值偏差 `<= {payload['mean_threshold_c']:.2f}°C`；高温分层均值偏差 `<= {payload['tail_threshold_c']:.2f}°C` 为双源一致，`{payload['tail_threshold_c']:.2f}-{payload['tail_vote_threshold_c']:.2f}°C` 为标注区间，`> {payload['tail_vote_threshold_c']:.2f}°C` 触发投票；单点绝对偏差 P95 `> {payload['point_hard_threshold_c']:.2f}°C` 才作为硬异常触发投票。",
        "",
        "## 城市级结论",
        "",
        "| 城市 | 样本 | NASA均值 | ERA5均值 | 均值偏差 | 单点P95绝对偏差 | 高温尾部偏差 | 状态 |",
        "|---|---:|---:|---:|---:|---:|---:|---|",
    ]
    for row in summaries:
        tail_bias = row.get("tail_mean_bias_c", "")
        tail_display = "" if tail_bias == "" else f"{tail_bias:.2f}"
        lines.append(
            "| {city} | {count} | {nasa:.2f} | {era5:.2f} | {bias:.2f} | {p95:.2f} | {tail} | {status} |".format(
                city=row["city_zh"],
                count=row["compared_count"],
                nasa=float(row.get("nasa_mean_sample_t2m_c", float("nan"))),
                era5=float(row.get("era5_mean_sample_t2m_c", float("nan"))),
                bias=float(row.get("mean_bias_era5_minus_nasa_c", float("nan"))),
                p95=float(row.get("p95_abs_point_diff_c", float("nan"))),
                tail=tail_display,
                status=row["status"],
            )
        )

    disputed = [row for row in summaries if row["status"] == "需第三/第四源投票"]
    marked = [row for row in summaries if row["status"] == "双源基本一致，高温尾部需标注"]
    lines.extend(
        [
            "",
            "## 投票触发",
            "",
        ]
    )
    if disputed:
        lines.append("以下城市超过阈值，后续只针对这些城市和争议时段引入第三、第四源：")
        lines.append("")
        for row in disputed:
            lines.append(f"- {row['city_zh']}：{row['reason']}")
    else:
        lines.append("本轮抽样未触发第三、第四源投票。")

    if marked:
        lines.extend(["", "以下城市为双源基本一致，但高温尾部需要在工程结论中标注：", ""])
        for row in marked:
            lines.append(f"- {row['city_zh']}：{row['reason']}")

    lines.extend(
        [
            "",
            "## 输出文件",
            "",
            f"- 抽样明细：`{payload['sample_csv']}`",
            f"- 城市汇总：`{payload['city_summary_csv']}`",
            f"- JSON 汇总：`{payload['json_summary']}`",
            "",
            "## 边界",
            "",
            "- 这是轻量抽检，不是 ERA5 全量复算。",
            "- 单点小时偏差可能包含 LST/UTC 近似换算、网格代表性、地形下采样和再分析模型差异。",
            "- 结论优先看城市级抽样均值和高温分层趋势，不用单个小时差异直接否定 NASA POWER。",
        ]
    )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    nasa_csv = args.nasa_csv or discover_nasa_csv()
    records_by_city = read_nasa_records(nasa_csv)
    requested_cities = [item.strip() for item in args.cities.split(",") if item.strip()]
    city_ids = requested_cities or sorted(records_by_city)
    missing = [city_id for city_id in city_ids if city_id not in records_by_city]
    if missing:
        raise ValueError(f"NASA CSV 中未找到城市: {', '.join(missing)}")

    samples_by_city = {
        city_id: sample_city(records_by_city[city_id], args.sample_size, args.seed)
        for city_id in city_ids
    }
    sample_rows = compare_samples(
        samples_by_city=samples_by_city,
        cache_dir=args.cache_dir,
        refresh=args.refresh,
        retries=args.retries,
        sleep=args.sleep,
        no_fetch=args.no_fetch,
        fetch_granularity=args.fetch_granularity,
    )
    city_summaries = summarize_city(
        sample_rows,
        args.mean_threshold_c,
        args.tail_threshold_c,
        args.tail_vote_threshold_c,
        args.point_hard_threshold_c,
    )

    args.summary_dir.mkdir(parents=True, exist_ok=True)
    sample_csv = args.summary_dir / f"{args.output_prefix}_samples.csv"
    city_summary_csv = args.summary_dir / f"{args.output_prefix}_city_summary.csv"
    json_summary = args.summary_dir / f"{args.output_prefix}_summary.json"

    sample_fields = list(sample_rows[0].keys()) if sample_rows else []
    summary_fields = list(city_summaries[0].keys()) if city_summaries else []
    if sample_fields:
        write_csv(sample_csv, sample_rows, sample_fields)
    if summary_fields:
        write_csv(city_summary_csv, city_summaries, summary_fields)

    payload = {
        "method": "NASA POWER sampled points checked against Open-Meteo ERA5-Land temperature_2m",
        "nasa_csv": str(nasa_csv),
        "provider": "Open-Meteo Historical Weather API",
        "provider_model": "era5_land",
        "provider_endpoint": OPEN_METEO_ARCHIVE_API,
        "fetch_granularity": args.fetch_granularity,
        "sample_size": args.sample_size,
        "seed": args.seed,
        "mean_threshold_c": args.mean_threshold_c,
        "tail_threshold_c": args.tail_threshold_c,
        "tail_vote_threshold_c": args.tail_vote_threshold_c,
        "point_hard_threshold_c": args.point_hard_threshold_c,
        "cities": city_ids,
        "sample_csv": str(sample_csv),
        "city_summary_csv": str(city_summary_csv),
        "json_summary": str(json_summary),
        "report_path": str(args.report_path),
        "city_summaries": city_summaries,
    }
    json_summary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_report(args.report_path, payload)

    print(f"wrote {sample_csv}")
    print(f"wrote {city_summary_csv}")
    print(f"wrote {json_summary}")
    print(f"wrote {args.report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
