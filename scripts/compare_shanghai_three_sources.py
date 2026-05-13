#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Compare Shanghai hourly temperature across NASA POWER, ERA5-Land and NOAA station data.

NASA POWER and ERA5-Land are gridded point extractions. NOAA is represented by
the Shanghai Hongqiao WMO 58367 station via Meteostat's bulk mirror, with
temperature source checked as ISD-Lite where available.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import math
import statistics
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable


NASA_API = "https://power.larc.nasa.gov/api/temporal/hourly/point"
OPEN_METEO_API = "https://archive-api.open-meteo.com/v1/archive"
METEOSTAT_HOURLY_BULK = "https://data.meteostat.net/hourly/{year}/{station}.csv.gz"

FILL_VALUE = -999.0
DEFAULT_CITY_ID = "shanghai"
DEFAULT_CITY_ZH = "上海"
DEFAULT_LATITUDE = 31.2304
DEFAULT_LONGITUDE = 121.4737
DEFAULT_NOAA_STATION = "58367"
DEFAULT_NOAA_STATION_NAME = "Shanghai Hongqiao"
DEFAULT_START_YEAR = 2021
DEFAULT_END_YEAR = 2025
WINDOWS = (
    ("jan_week", "01-01", "01-07"),
    ("may_week", "05-01", "05-07"),
    ("oct_week", "10-01", "10-07"),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="上海 NASA / ERA5 / NOAA 近 5 年小时气温对比")
    parser.add_argument("--start-year", type=int, default=DEFAULT_START_YEAR)
    parser.add_argument("--end-year", type=int, default=DEFAULT_END_YEAR)
    parser.add_argument("--latitude", type=float, default=DEFAULT_LATITUDE)
    parser.add_argument("--longitude", type=float, default=DEFAULT_LONGITUDE)
    parser.add_argument("--noaa-station", default=DEFAULT_NOAA_STATION)
    parser.add_argument(
        "--era5-provider",
        choices=["auto", "open-meteo", "cds"],
        default="auto",
        help="ERA5-Land source. auto uses Open-Meteo first and falls back to Copernicus CDS on public API limit.",
    )
    parser.add_argument(
        "--mode",
        choices=["fixed-windows", "full-year"],
        default="fixed-windows",
        help="fixed-windows follows the web dual-source check; full-year is heavier and may exceed ERA5 limits.",
    )
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--cache-dir", type=Path, default=Path("data/cache/three_source_shanghai"))
    parser.add_argument("--processed-dir", type=Path, default=Path("data/processed"))
    parser.add_argument("--summary-dir", type=Path, default=Path("data/summary"))
    parser.add_argument("--report-path", type=Path, default=Path("docs/shanghai_three_source_temperature_bias_2021_2025.md"))
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--sleep", type=float, default=1.0)
    return parser.parse_args()


def cache_path(cache_dir: Path, url: str, suffix: str) -> Path:
    digest = hashlib.md5(url.encode("utf-8")).hexdigest()
    return cache_dir / f"{digest}.{suffix}"


def fetch_bytes(url: str, cache_dir: Path, refresh: bool, retries: int, sleep: float) -> bytes:
    cache_dir.mkdir(parents=True, exist_ok=True)
    suffix = "gz" if url.endswith(".gz") else "json"
    path = cache_path(cache_dir, url, suffix)
    if path.exists() and path.stat().st_size > 0 and not refresh:
        return path.read_bytes()

    request = urllib.request.Request(url, headers={"User-Agent": "codex-shanghai-three-source-check/1.0"})
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                payload = response.read()
            path.write_bytes(payload)
            return payload
        except urllib.error.HTTPError as exc:
            last_error = exc
            if attempt < retries:
                retry_after = exc.headers.get("Retry-After")
                if exc.code == 429:
                    wait_seconds = int(retry_after) if retry_after and retry_after.isdigit() else max(30, sleep * attempt)
                else:
                    wait_seconds = sleep * attempt
                print(f"  retry {attempt}/{retries} after HTTP {exc.code}, sleep {wait_seconds:.0f}s", flush=True)
                time.sleep(wait_seconds)
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
            if attempt < retries:
                wait_seconds = sleep * attempt
                print(f"  retry {attempt}/{retries}, sleep {wait_seconds:.0f}s", flush=True)
                time.sleep(wait_seconds)
    raise RuntimeError(f"请求失败: {url}\n{last_error}")


def fetch_json(url: str, cache_dir: Path, refresh: bool, retries: int, sleep: float) -> dict:
    payload = fetch_bytes(url, cache_dir, refresh, retries, sleep)
    data = json.loads(payload.decode("utf-8"))
    if isinstance(data, dict) and data.get("error"):
        raise RuntimeError(f"{url}\n{data.get('reason') or data.get('error')}")
    return data


def build_nasa_url(latitude: float, longitude: float, year: int) -> str:
    params = {
        "parameters": "T2M",
        "community": "AG",
        "latitude": f"{latitude:.4f}",
        "longitude": f"{longitude:.4f}",
        "start": f"{year}0101",
        "end": f"{year}1231",
        "format": "JSON",
        "time-standard": "UTC",
        "header": "true",
    }
    return NASA_API + "?" + urllib.parse.urlencode(params)


def build_era5_url(latitude: float, longitude: float, year: int) -> str:
    params = {
        "latitude": f"{latitude:.4f}",
        "longitude": f"{longitude:.4f}",
        "start_date": f"{year}-01-01",
        "end_date": f"{year}-12-31",
        "hourly": "temperature_2m",
        "temperature_unit": "celsius",
        "timezone": "UTC",
        "models": "era5_land",
    }
    return OPEN_METEO_API + "?" + urllib.parse.urlencode(params)


def read_nasa(latitude: float, longitude: float, years: Iterable[int], args: argparse.Namespace) -> dict[datetime, float]:
    values: dict[datetime, float] = {}
    for year in years:
        print(f"fetch NASA {year}", flush=True)
        data = fetch_json(build_nasa_url(latitude, longitude, year), args.cache_dir, args.refresh, args.retries, args.sleep)
        fill_value = float(data.get("header", {}).get("fill_value", FILL_VALUE))
        parameter = data.get("properties", {}).get("parameter", {}).get("T2M", {})
        for key, raw_value in parameter.items():
            if raw_value is None:
                continue
            value = float(raw_value)
            if value <= fill_value:
                continue
            values[datetime.strptime(key, "%Y%m%d%H")] = value
    return values


def read_era5_open_meteo(latitude: float, longitude: float, years: Iterable[int], args: argparse.Namespace) -> dict[datetime, float]:
    values: dict[datetime, float] = {}
    for year in years:
        print(f"fetch ERA5-Land {year}", flush=True)
        data = fetch_json(build_era5_url(latitude, longitude, year), args.cache_dir, args.refresh, args.retries, args.sleep)
        hourly = data.get("hourly", {})
        for time_key, raw_value in zip(hourly.get("time", []), hourly.get("temperature_2m", [])):
            if raw_value is None:
                continue
            values[datetime.strptime(time_key, "%Y-%m-%dT%H:%M")] = float(raw_value)
    return values


def cds_cache_path(cache_dir: Path, latitude: float, longitude: float, year: int, mode: str, window: str = "") -> Path:
    cache_dir.mkdir(parents=True, exist_ok=True)
    window_part = f"_{window}" if window else ""
    return cache_dir / f"era5_land_cds_t2m_{mode}_{year}{window_part}_{latitude:.4f}_{longitude:.4f}.nc"


def retrieve_cds_era5_land(
    latitude: float,
    longitude: float,
    year: int,
    path: Path,
    mode: str,
    month_override: str | None = None,
) -> None:
    import cdsapi

    if mode == "fixed-windows":
        months = [month_override] if month_override else ["01", "05", "10"]
        days = [f"{day:02d}" for day in range(1, 8)]
    else:
        months = [f"{month:02d}" for month in range(1, 13)]
        days = [f"{day:02d}" for day in range(1, 32)]
    times = [f"{hour:02d}:00" for hour in range(24)]
    # ERA5-Land native grid is 0.1 degree. A tight 0.2 degree box keeps the
    # request small while allowing nearest-grid extraction after download.
    north = latitude + 0.1
    south = latitude - 0.1
    west = longitude - 0.1
    east = longitude + 0.1
    request = {
        "variable": ["2m_temperature"],
        "year": str(year),
        "month": months,
        "day": days,
        "time": times,
        "data_format": "netcdf",
        "download_format": "unarchived",
        "area": [round(north, 3), round(west, 3), round(south, 3), round(east, 3)],
    }
    tmp_path = path.with_suffix(".tmp.nc")
    if tmp_path.exists():
        tmp_path.unlink()
    cdsapi.Client(quiet=True).retrieve("reanalysis-era5-land", request, str(tmp_path))
    tmp_path.replace(path)


def extract_cds_era5_land(path: Path, latitude: float, longitude: float) -> dict[datetime, float]:
    from netCDF4 import Dataset, num2date

    values: dict[datetime, float] = {}
    with Dataset(path) as ds:
        latitudes = list(ds.variables["latitude"][:])
        longitudes = list(ds.variables["longitude"][:])
        lat_index = min(range(len(latitudes)), key=lambda index: abs(float(latitudes[index]) - latitude))
        lon_index = min(range(len(longitudes)), key=lambda index: abs(float(longitudes[index]) - longitude))
        time_var = ds.variables["valid_time"]
        decoded_times = num2date(time_var[:], units=time_var.units, only_use_cftime_datetimes=False)
        t2m = ds.variables["t2m"][:, lat_index, lon_index]
        for dt, kelvin in zip(decoded_times, t2m):
            if hasattr(dt, "replace"):
                native_dt = datetime(dt.year, dt.month, dt.day, dt.hour)
            else:
                native_dt = datetime.utcfromtimestamp(float(dt))
            values[native_dt] = round(float(kelvin) - 273.15, 3)
    return values


def read_era5_cds(latitude: float, longitude: float, years: Iterable[int], args: argparse.Namespace) -> dict[datetime, float]:
    values: dict[datetime, float] = {}
    for year in years:
        print(f"fetch ERA5-Land CDS {year}", flush=True)
        combined_path = cds_cache_path(args.cache_dir, latitude, longitude, year, args.mode)
        if combined_path.exists() and combined_path.stat().st_size > 0 and not args.refresh:
            values.update(extract_cds_era5_land(combined_path, latitude, longitude))
            continue
        if args.mode == "fixed-windows":
            for label, month, _end in WINDOWS:
                print(f"  CDS window {year}-{month}", flush=True)
                path = cds_cache_path(args.cache_dir, latitude, longitude, year, args.mode, label)
                if not path.exists() or path.stat().st_size == 0 or args.refresh:
                    retrieve_cds_era5_land(latitude, longitude, year, path, args.mode, month_override=month[:2])
                values.update(extract_cds_era5_land(path, latitude, longitude))
        else:
            path = combined_path
            if not path.exists() or path.stat().st_size == 0 or args.refresh:
                retrieve_cds_era5_land(latitude, longitude, year, path, args.mode)
            values.update(extract_cds_era5_land(path, latitude, longitude))
    return values


def read_era5(latitude: float, longitude: float, years: Iterable[int], args: argparse.Namespace) -> tuple[dict[datetime, float], str, str]:
    if args.era5_provider == "open-meteo":
        return read_era5_open_meteo(latitude, longitude, years, args), "Open-Meteo", ""
    if args.era5_provider == "cds":
        return read_era5_cds(latitude, longitude, years, args), "Copernicus CDS", ""

    try:
        return read_era5_open_meteo(latitude, longitude, years, args), "Open-Meteo", ""
    except RuntimeError as exc:
        message = str(exc)
        if "429" not in message and "Daily API request limit exceeded" not in message:
            raise
        print("Open-Meteo limited; fallback to Copernicus CDS", flush=True)
        return read_era5_cds(latitude, longitude, years, args), "Copernicus CDS", message


def read_meteostat_noaa(station: str, years: Iterable[int], args: argparse.Namespace) -> tuple[dict[datetime, float], dict[datetime, str]]:
    values: dict[datetime, float] = {}
    source_by_dt: dict[datetime, str] = {}
    for year in years:
        print(f"fetch NOAA station mirror {station} {year}", flush=True)
        url = METEOSTAT_HOURLY_BULK.format(year=year, station=station)
        payload = fetch_bytes(url, args.cache_dir, args.refresh, args.retries, args.sleep)
        text = gzip.decompress(payload).decode("utf-8")
        reader = csv.DictReader(text.splitlines())
        for row in reader:
            raw_temp = (row.get("temp") or "").strip()
            if not raw_temp:
                continue
            source = (row.get("temp_source") or "").strip() or "unknown"
            dt = datetime(
                int(row["year"]),
                int(row["month"]),
                int(row["day"]),
                int(row["hour"]),
            )
            values[dt] = float(raw_temp)
            source_by_dt[dt] = source
    return values, source_by_dt


def percentile(values: list[float], percent: float) -> float:
    if not values:
        return float("nan")
    ordered = sorted(values)
    k = (len(ordered) - 1) * percent / 100
    lower = math.floor(k)
    upper = math.ceil(k)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] * (upper - k) + ordered[upper] * (k - lower)


def mean(values: list[float]) -> float:
    return statistics.mean(values) if values else float("nan")


def format_float(value: float | int | str, digits: int = 3) -> str:
    if value == "":
        return ""
    numeric = float(value)
    if math.isnan(numeric):
        return ""
    return f"{numeric:.{digits}f}"


def all_hours(start_year: int, end_year: int, mode: str) -> list[datetime]:
    start = datetime(start_year, 1, 1)
    end = datetime(end_year + 1, 1, 1)
    hours: list[datetime] = []
    current = start
    while current < end:
        if mode == "full-year" or window_label(current):
            hours.append(current)
        current += timedelta(hours=1)
    return hours


def local_date(dt_utc: datetime) -> str:
    return (dt_utc + timedelta(hours=8)).strftime("%Y-%m-%d")


def local_hour(dt_utc: datetime) -> str:
    return (dt_utc + timedelta(hours=8)).strftime("%H")


def window_label(dt_utc: datetime) -> str:
    mmdd = dt_utc.strftime("%m-%d")
    for label, start_mmdd, end_mmdd in WINDOWS:
        if start_mmdd <= mmdd <= end_mmdd:
            return f"{dt_utc.year}_{label}"
    return ""


def build_aligned_rows(
    hours: list[datetime],
    nasa: dict[datetime, float],
    era5: dict[datetime, float],
    noaa: dict[datetime, float],
    noaa_source_by_dt: dict[datetime, str],
) -> list[dict]:
    rows: list[dict] = []
    for dt in hours:
        nasa_value = nasa.get(dt)
        era5_value = era5.get(dt)
        noaa_value = noaa.get(dt)
        rows.append(
            {
                "datetime_utc": dt.strftime("%Y-%m-%d %H:00"),
                "date_local_shanghai": local_date(dt),
                "hour_local_shanghai": local_hour(dt),
                "fixed_window": window_label(dt),
                "nasa_power_t2m_c": "" if nasa_value is None else round(nasa_value, 3),
                "era5_land_t2m_c": "" if era5_value is None else round(era5_value, 3),
                "noaa_station_t2m_c": "" if noaa_value is None else round(noaa_value, 3),
                "noaa_temp_source": "" if noaa_value is None else noaa_source_by_dt.get(dt, "unknown"),
                "diff_era5_minus_nasa_c": ""
                if nasa_value is None or era5_value is None
                else round(era5_value - nasa_value, 3),
                "diff_noaa_minus_nasa_c": ""
                if nasa_value is None or noaa_value is None
                else round(noaa_value - nasa_value, 3),
                "diff_noaa_minus_era5_c": ""
                if era5_value is None or noaa_value is None
                else round(noaa_value - era5_value, 3),
            }
        )
    return rows


def source_summary(rows: list[dict], total_hours: int, era5_provider_used: str) -> list[dict]:
    era5_method = (
        "Copernicus CDS / reanalysis-era5-land / 2m_temperature / UTC"
        if era5_provider_used == "Copernicus CDS"
        else "Open-Meteo Historical API / era5_land / temperature_2m / UTC"
    )
    configs = [
        ("NASA POWER", "nasa_power_t2m_c", "NASA POWER Hourly API / T2M / UTC"),
        ("ERA5-Land", "era5_land_t2m_c", era5_method),
        ("NOAA station", "noaa_station_t2m_c", "Meteostat bulk mirror / WMO 58367 / temp_source mostly ISD-Lite"),
    ]
    summaries: list[dict] = []
    for source, column, method in configs:
        values = [float(row[column]) for row in rows if row[column] != ""]
        summaries.append(
            {
                "source": source,
                "method": method,
                "valid_hours": len(values),
                "missing_hours": total_hours - len(values),
                "min_c": round(min(values), 3) if values else "",
                "mean_c": round(mean(values), 3) if values else "",
                "max_c": round(max(values), 3) if values else "",
                "p95_c": round(percentile(values, 95), 3) if values else "",
                "p99_c": round(percentile(values, 99), 3) if values else "",
                "hours_ge_35c": sum(1 for value in values if value >= 35),
                "ratio_ge_35c": round(sum(1 for value in values if value >= 35) / len(values), 6) if values else "",
                "hours_ge_40c": sum(1 for value in values if value >= 40),
                "ratio_ge_40c": round(sum(1 for value in values if value >= 40) / len(values), 6) if values else "",
            }
        )
    return summaries


def status_from_thresholds(mean_bias_abs: float, max_window_bias_abs: float, point_p95_abs: float, missing_hours: int) -> tuple[str, str]:
    reasons: list[str] = []
    if missing_hours:
        reasons.append(f"缺测 {missing_hours} 小时")
    if mean_bias_abs > 1.5:
        reasons.append(f"总体均值偏差 {mean_bias_abs:.2f}°C > 1.50°C")
    if max_window_bias_abs > 4.0:
        reasons.append(f"最大固定窗口均值偏差 {max_window_bias_abs:.2f}°C > 4.00°C")
    if point_p95_abs > 6.0:
        reasons.append(f"单点绝对偏差 P95 {point_p95_abs:.2f}°C > 6.00°C")
    if reasons:
        return "需第三/第四源投票", "；".join(reasons)
    if max_window_bias_abs > 3.0:
        return "基本一致，窗口需标注", f"最大固定窗口均值偏差 {max_window_bias_abs:.2f}°C 位于 3-4°C 标注区间"
    return "一致", "总体均值、固定窗口和单点 P95 均未触发阈值"


def pair_summary(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    pair_configs = [
        ("ERA5-Land - NASA", "diff_era5_minus_nasa_c", "nasa_power_t2m_c"),
        ("NOAA station - NASA", "diff_noaa_minus_nasa_c", "nasa_power_t2m_c"),
        ("NOAA station - ERA5-Land", "diff_noaa_minus_era5_c", "era5_land_t2m_c"),
    ]
    summaries: list[dict] = []
    window_rows: list[dict] = []
    for pair, diff_col, ref_col in pair_configs:
        comparable = [row for row in rows if row[diff_col] != ""]
        diffs = [float(row[diff_col]) for row in comparable]
        abs_diffs = [abs(value) for value in diffs]
        ref_values = [float(row[ref_col]) for row in comparable if row[ref_col] != ""]
        ref_p95 = percentile(ref_values, 95)
        ref_p99 = percentile(ref_values, 99)
        p95_band = [
            float(row[diff_col])
            for row in comparable
            if row[ref_col] != "" and ref_p95 <= float(row[ref_col]) < ref_p99
        ]
        tail = [
            float(row[diff_col])
            for row in comparable
            if row[ref_col] != "" and float(row[ref_col]) >= ref_p99
        ]

        max_window_bias_abs = 0.0
        for label in sorted({row["fixed_window"] for row in comparable if row["fixed_window"]}):
            label_rows = [row for row in comparable if row["fixed_window"] == label]
            label_diffs = [float(row[diff_col]) for row in label_rows]
            label_bias = mean(label_diffs)
            max_window_bias_abs = max(max_window_bias_abs, abs(label_bias))
            window_rows.append(
                {
                    "pair": pair,
                    "window": label,
                    "hours": len(label_diffs),
                    "mean_bias_c": round(label_bias, 3),
                    "mean_abs_diff_c": round(mean([abs(value) for value in label_diffs]), 3),
                    "p95_abs_diff_c": round(percentile([abs(value) for value in label_diffs], 95), 3),
                }
            )

        mean_bias_value = mean(diffs)
        p95_abs_value = percentile(abs_diffs, 95)
        missing_hours = len(rows) - len(comparable)
        status, reason = status_from_thresholds(
            abs(mean_bias_value),
            max_window_bias_abs,
            p95_abs_value,
            missing_hours,
        )
        summaries.append(
            {
                "pair": pair,
                "compared_hours": len(comparable),
                "missing_or_unmatched_hours": missing_hours,
                "mean_bias_c": round(mean_bias_value, 3),
                "mean_abs_diff_c": round(mean(abs_diffs), 3),
                "median_bias_c": round(percentile(diffs, 50), 3),
                "p95_abs_diff_c": round(p95_abs_value, 3),
                "max_abs_diff_c": round(max(abs_diffs), 3),
                "reference_p95_c": round(ref_p95, 3),
                "reference_p99_c": round(ref_p99, 3),
                "p95_p99_mean_bias_c": round(mean(p95_band), 3) if p95_band else "",
                "p99_tail_mean_bias_c": round(mean(tail), 3) if tail else "",
                "max_fixed_window_mean_bias_abs_c": round(max_window_bias_abs, 3),
                "status": status,
                "reason": reason,
            }
        )
    return summaries, window_rows


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        return
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def write_report(path: Path, payload: dict) -> None:
    lines = [
        "# 上海三源小时气温偏差检查（2021-2025）",
        "",
        "## 结论先行",
        "",
    ]
    for row in payload["pair_summary"]:
        tendency = "偏高" if float(row["mean_bias_c"]) > 0 else "偏低"
        lines.append(
            f"- `{row['pair']}`：均值偏差 `{row['mean_bias_c']:.2f}°C`，相当于前者相对后者整体{tendency}；状态 `{row['status']}`。"
        )

    lines.extend(
        [
            "",
            "## 源级统计",
            "",
            "| 数据源 | 有效小时 | 均值 | 最低 | 最高 | P95 | P99 | >=35°C占比 | >=40°C占比 |",
            "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
        ]
    )
    for row in payload["source_summary"]:
        lines.append(
            "| {source} | {hours} | {mean} | {minv} | {maxv} | {p95} | {p99} | {r35:.2%} | {r40:.2%} |".format(
                source=row["source"],
                hours=row["valid_hours"],
                mean=float(row["mean_c"]),
                minv=float(row["min_c"]),
                maxv=float(row["max_c"]),
                p95=float(row["p95_c"]),
                p99=float(row["p99_c"]),
                r35=float(row["ratio_ge_35c"]),
                r40=float(row["ratio_ge_40c"]),
            )
        )

    lines.extend(
        [
            "",
            "## 两两偏差",
            "",
            "| 对比 | 小时数 | 均值偏差 | 平均绝对偏差 | 单点P95绝对偏差 | P99尾部偏差 | 最大固定窗口均值偏差 | 状态 |",
            "|---|---:|---:|---:|---:|---:|---:|---|",
        ]
    )
    for row in payload["pair_summary"]:
        tail = row["p99_tail_mean_bias_c"]
        tail_text = "" if tail == "" else f"{float(tail):.2f}"
        lines.append(
            "| {pair} | {hours} | {bias:.2f} | {mad:.2f} | {p95:.2f} | {tail} | {window:.2f} | {status} |".format(
                pair=row["pair"],
                hours=row["compared_hours"],
                bias=float(row["mean_bias_c"]),
                mad=float(row["mean_abs_diff_c"]),
                p95=float(row["p95_abs_diff_c"]),
                tail=tail_text,
                window=float(row["max_fixed_window_mean_bias_abs_c"]),
                status=row["status"],
            )
        )

    lines.extend(
        [
            "",
            "## 口径",
            "",
            f"- 地点：上海市中心点 `{payload['latitude']}, {payload['longitude']}`；NOAA 站点用上海虹桥 WMO `{payload['noaa_station']}`。",
            f"- 时间：`2021-2025`，本次比较模式为 `{payload['comparison_mode']}`；固定窗口按 UTC 日期 `01-01~01-07`、`05-01~05-07`、`10-01~10-07` 识别。",
            "- NASA：POWER Hourly API，变量 `T2M`，本次用 `time-standard=UTC`，避免 LST/UTC 换算误差。",
            f"- ERA5：本次实际使用 `{payload['era5_provider_used']}`。优先 Open-Meteo Historical Weather API 的 `era5_land / temperature_2m`；如果公共接口限流，则用 Copernicus CDS `reanalysis-era5-land / 2m_temperature` 兜底。",
            "- NOAA：Meteostat 年度 bulk 镜像，站点 `58367 / Shanghai Hongqiao`；本次温度来源计数见下方，`isd_lite` 可视为 NOAA ISD-Lite 站点观测口径。NCEI 官方直连在本机多次超时，因此本轮没有直接从 NCEI 下载。",
            "- 判定：沿用网页双源一致阈值，总体均值偏差 `<=1.5°C`，最大固定窗口均值偏差 `<=3°C` 为一致，`3-4°C` 需标注，`>4°C` 或单点绝对偏差 P95 `>6°C` 触发第三/第四源投票。",
            "",
            "## NOAA 温度来源计数",
            "",
            "| temp_source | 小时数 |",
            "|---|---:|",
        ]
    )
    if payload.get("era5_fallback_reason"):
        lines.insert(
            -4,
            "本次 Open-Meteo 公共接口触发限流，已自动改用 Copernicus CDS；限流原因为：`Daily API request limit exceeded`。",
        )
        lines.insert(-4, "")
    for source, count in payload["noaa_temp_source_counts"].items():
        lines.append(f"| `{source}` | {count} |")

    lines.extend(
        [
            "",
            "## 倾向解释",
            "",
            "- NASA POWER 与 ERA5-Land 都是网格/再分析点位，适合做城市点位环境暴露估计；两者如果均值和窗口偏差都小，说明主数据口径稳定。",
            "- NOAA/ISD-Lite 是上海虹桥站点观测，代表机场站局地环境。它更接近真实站点仪器，但不等同于市中心网格，也会受站点位置、城市热岛、观测制度和缺测补齐影响。",
            "- 如果 NOAA 与两个网格源系统性偏高或偏低，优先解释为“站点代表性差异”，不能直接说某个源错。",
            "",
            "## 来源链接",
            "",
            "- NASA POWER API：https://power.larc.nasa.gov/api/pages/",
            "- Copernicus ERA5-Land：https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land",
            "- Meteostat bulk data：https://dev.meteostat.net/data",
            "- NOAA ISD-Lite technical document：https://www.ncei.noaa.gov/pub/data/noaa/isd-lite/isd-lite-technical-document.pdf",
            "",
            "## 输出文件",
            "",
            f"- 小时对齐明细：`{payload['aligned_csv']}`",
            f"- 源级统计：`{payload['source_summary_csv']}`",
            f"- 两两偏差：`{payload['pair_summary_csv']}`",
            f"- 固定窗口偏差：`{payload['window_summary_csv']}`",
            f"- JSON 汇总：`{payload['json_summary']}`",
        ]
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    years = list(range(args.start_year, args.end_year + 1))
    hours = all_hours(args.start_year, args.end_year, args.mode)

    nasa = read_nasa(args.latitude, args.longitude, years, args)
    era5, era5_provider_used, era5_fallback_reason = read_era5(args.latitude, args.longitude, years, args)
    noaa, noaa_source_by_dt = read_meteostat_noaa(args.noaa_station, years, args)

    rows = build_aligned_rows(hours, nasa, era5, noaa, noaa_source_by_dt)
    sources = source_summary(rows, len(hours), era5_provider_used)
    pairs, windows = pair_summary(rows)

    suffix = f"{args.start_year}_{args.end_year}"
    aligned_csv = args.processed_dir / f"shanghai_three_source_hourly_{suffix}_utc.csv"
    source_summary_csv = args.summary_dir / f"shanghai_three_source_source_summary_{suffix}.csv"
    pair_summary_csv = args.summary_dir / f"shanghai_three_source_pair_summary_{suffix}.csv"
    window_summary_csv = args.summary_dir / f"shanghai_three_source_fixed_window_summary_{suffix}.csv"
    json_summary = args.summary_dir / f"shanghai_three_source_summary_{suffix}.json"

    write_csv(aligned_csv, rows)
    write_csv(source_summary_csv, sources)
    write_csv(pair_summary_csv, pairs)
    write_csv(window_summary_csv, windows)

    payload = {
        "city_id": DEFAULT_CITY_ID,
        "city_zh": DEFAULT_CITY_ZH,
        "latitude": args.latitude,
        "longitude": args.longitude,
        "start_year": args.start_year,
        "end_year": args.end_year,
        "time_standard": "UTC",
        "comparison_mode": args.mode,
        "window_time_basis": "UTC",
        "noaa_station": args.noaa_station,
        "noaa_station_name": DEFAULT_NOAA_STATION_NAME,
        "nasa_endpoint": NASA_API,
        "era5_endpoint": OPEN_METEO_API,
        "era5_provider_requested": args.era5_provider,
        "era5_provider_used": era5_provider_used,
        "era5_fallback_reason": era5_fallback_reason,
        "meteostat_hourly_bulk_template": METEOSTAT_HOURLY_BULK,
        "noaa_temp_source_counts": dict(Counter(row["noaa_temp_source"] for row in rows if row["noaa_temp_source"])),
        "source_summary": sources,
        "pair_summary": pairs,
        "window_summary": windows,
        "aligned_csv": str(aligned_csv),
        "source_summary_csv": str(source_summary_csv),
        "pair_summary_csv": str(pair_summary_csv),
        "window_summary_csv": str(window_summary_csv),
        "json_summary": str(json_summary),
        "report_path": str(args.report_path),
    }
    args.summary_dir.mkdir(parents=True, exist_ok=True)
    json_summary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_report(args.report_path, payload)

    print(f"wrote {aligned_csv}")
    print(f"wrote {source_summary_csv}")
    print(f"wrote {pair_summary_csv}")
    print(f"wrote {window_summary_csv}")
    print(f"wrote {json_summary}")
    print(f"wrote {args.report_path}")
    for row in pairs:
        print(f"{row['pair']}: mean_bias={row['mean_bias_c']} status={row['status']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
