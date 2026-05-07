# 苏丹港与沙特吉赞小时级气温导出

本项目用于从 NASA POWER Hourly API 导出城市点位的近 10 年逐日逐小时平均气温。

## 数据口径

- 数据源：NASA POWER Hourly API
- Endpoint：`https://power.larc.nasa.gov/api/temporal/hourly/point`
- 参数：`T2M`
- 含义：2 米气温，小时平均值，单位 `deg C`
- 时间标准：默认 `LST`，即当地太阳时；如需统一时区可改用 `UTC`
- 年份范围：默认 `2016-2025`，即截至 2026 年 5 月可用的最近 10 个完整自然年

## 城市点位

| city_id | 城市 | 国家 | 纬度 | 经度 |
|---|---|---|---:|---:|
| `port_sudan` | 苏丹港 | 苏丹 | 19.6158 | 37.2164 |
| `jizan_saudi` | 吉赞 | 沙特阿拉伯 | 16.8892 | 42.5511 |

## 使用

```bash
python3 scripts/export_nasa_power_hourly_t2m.py
```

默认输出：

- `outputs/苏丹港_吉赞_NASA_POWER小时气温_2016_2025.xlsx`
- `data/processed/port_sudan_t2m_hourly_2016_2025_lst.csv`
- `data/processed/jizan_saudi_t2m_hourly_2016_2025_lst.csv`
- `data/processed/nasa_power_t2m_hourly_2016_2025_port_sudan_jizan_lst.csv`
- `data/processed/nasa_power_t2m_by_date_hour_2016_2025_port_sudan_jizan_lst.csv`
- `data/summary/nasa_power_t2m_export_summary_2016_2025_lst.json`

## 字段说明

长表 CSV 字段：

- `city_id`：城市标识
- `city_zh` / `city_en`：城市中文名 / 英文名
- `country_zh` / `country_en`：国家中文名 / 英文名
- `latitude` / `longitude`：请求 NASA POWER 的点位坐标
- `date`：日期
- `hour_lst`：当地太阳时小时，`00-23`
- `datetime_lst`：当地太阳时日期小时
- `t2m_c`：2 米气温小时平均值，单位摄氏度
- `source` / `parameter` / `time_standard`：数据源与口径

宽表 CSV 以 `date + hour_lst` 为行，把两个城市的 `t2m_c` 对齐，适合 Excel 直接比较。

## 生成 Excel

```bash
/Users/eoshow/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/build_temperature_excel.mjs
```

Excel 包含：

- `摘要`
- `宽表_两城市对齐`
- `苏丹港_长表`
- `吉赞_长表`
