# 上海三源小时气温偏差检查（2021-2025）

## 结论先行

- `ERA5-Land - NASA`：均值偏差 `-0.52°C`，相当于前者相对后者整体偏低；状态 `一致`。
- `NOAA station - NASA`：均值偏差 `0.95°C`，相当于前者相对后者整体偏高；状态 `一致`。
- `NOAA station - ERA5-Land`：均值偏差 `1.47°C`，相当于前者相对后者整体偏高；状态 `一致`。

## 源级统计

| 数据源 | 有效小时 | 均值 | 最低 | 最高 | P95 | P99 | >=35°C占比 | >=40°C占比 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| NASA POWER | 2520 | 16.261 | -7.13 | 35.97 | 28.601 | 32.009 | 0.16% | 0.00% |
| ERA5-Land | 2520 | 15.742 | -8.292 | 32.679 | 27.256 | 29.967 | 0.00% | 0.00% |
| NOAA station | 2520 | 17.215 | -7.0 | 36.0 | 29.0 | 33.0 | 0.40% | 0.00% |

## 两两偏差

| 对比 | 小时数 | 均值偏差 | 平均绝对偏差 | 单点P95绝对偏差 | P99尾部偏差 | 最大固定窗口均值偏差 | 状态 |
|---|---:|---:|---:|---:|---:|---:|---|
| ERA5-Land - NASA | 2520 | -0.52 | 1.14 | 3.04 | -2.53 | 1.80 | 一致 |
| NOAA station - NASA | 2520 | 0.95 | 1.49 | 3.50 | 0.64 | 1.87 | 一致 |
| NOAA station - ERA5-Land | 2520 | 1.47 | 1.67 | 3.67 | 2.47 | 2.43 | 一致 |

## 口径

- 地点：上海市中心点 `31.2304, 121.4737`；NOAA 站点用上海虹桥 WMO `58367`。
- 时间：`2021-2025`，本次比较模式为 `fixed-windows`；固定窗口按 UTC 日期 `01-01~01-07`、`05-01~05-07`、`10-01~10-07` 识别。
- NASA：POWER Hourly API，变量 `T2M`，本次用 `time-standard=UTC`，避免 LST/UTC 换算误差。
- ERA5：本次实际使用 `Copernicus CDS`。优先 Open-Meteo Historical Weather API 的 `era5_land / temperature_2m`；如果公共接口限流，则用 Copernicus CDS `reanalysis-era5-land / 2m_temperature` 兜底。
- NOAA：Meteostat 年度 bulk 镜像，站点 `58367 / Shanghai Hongqiao`；本次温度来源计数见下方，`isd_lite` 可视为 NOAA ISD-Lite 站点观测口径。NCEI 官方直连在本机多次超时，因此本轮没有直接从 NCEI 下载。
- 判定：沿用网页双源一致阈值，总体均值偏差 `<=1.5°C`，最大固定窗口均值偏差 `<=3°C` 为一致，`3-4°C` 需标注，`>4°C` 或单点绝对偏差 P95 `>6°C` 触发第三/第四源投票。

## NOAA 温度来源计数

| temp_source | 小时数 |
|---|---:|
| `isd_lite` | 2320 |
| `metar` | 199 |
| `dwd_mosmix` | 1 |

## 倾向解释

- NASA POWER 与 ERA5-Land 都是网格/再分析点位，适合做城市点位环境暴露估计；两者如果均值和窗口偏差都小，说明主数据口径稳定。
- NOAA/ISD-Lite 是上海虹桥站点观测，代表机场站局地环境。它更接近真实站点仪器，但不等同于市中心网格，也会受站点位置、城市热岛、观测制度和缺测补齐影响。
- 如果 NOAA 与两个网格源系统性偏高或偏低，优先解释为“站点代表性差异”，不能直接说某个源错。

## 来源链接

- NASA POWER API：https://power.larc.nasa.gov/api/pages/
- Copernicus ERA5-Land：https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land
- Meteostat bulk data：https://dev.meteostat.net/data
- NOAA ISD-Lite technical document：https://www.ncei.noaa.gov/pub/data/noaa/isd-lite/isd-lite-technical-document.pdf

## 输出文件

- 小时对齐明细：`data/processed/shanghai_three_source_hourly_2021_2025_utc.csv`
- 源级统计：`data/summary/shanghai_three_source_source_summary_2021_2025.csv`
- 两两偏差：`data/summary/shanghai_three_source_pair_summary_2021_2025.csv`
- 固定窗口偏差：`data/summary/shanghai_three_source_fixed_window_summary_2021_2025.csv`
- JSON 汇总：`data/summary/shanghai_three_source_summary_2021_2025.json`
