# 地球城市小时级气温导出

本项目用于从 NASA POWER Hourly API 导出城市点位的近 10 年逐日逐小时平均气温。

## 静态网页工具

第一版可迁移工具位于 `web/`，无需 Docker、无需后端、无需安装依赖。

使用方式：

1. 打开 `web/index.html`。
2. 粘贴或上传坐标 CSV，字段为 `site_id,name,latitude,longitude,country`。
3. 设置年份、时间标准和超温阈值，默认 `2016-2025 / LST / 40°C`。
4. 点击“开始拉取”，完成后下载一个 Excel 工作簿。

网页会直接请求 NASA POWER API，并使用浏览器 IndexedDB 缓存。缓存只保存在当前浏览器；换电脑、换浏览器或清空站点数据后不会自动迁移。

如果只知道城市名，可以先在“按城市名添加点位”里查询。工具会先查内置城市表；未命中时调用 OpenStreetMap Nominatim 展示候选，经用户确认后追加到 CSV。该功能只在点击查询时访问公共地理编码服务，不做自动联想或批量地名解析。

如果只知道国家名称，可以用“按国家列出城市”。工具会结合内置城市表和 OpenStreetMap Overpass 返回大城市、城镇和行政中心候选；人口、省会/行政中心标签取决于 OSM 标注完整度，候选仍需手动确认后加入 CSV。

复制到本地运行时，保留整个 `web/` 文件夹即可；至少需要 `web/index.html`、`web/app.js`、`web/styles.css` 三个文件在同一目录。

Excel 工作簿包含：

- `摘要`：数据口径、缓存命中、超温占比和每个点位统计。
- `宽表_全部点位对齐`：按 `date + hour` 对齐全部点位。
- 每个点位一个 `*_长表`：逐日逐小时气温明细。
- `运行记录`：本次参数、工具版本和点位清单。
- `错误记录`：仅在 NASA 请求失败时生成。

如果直接双击打开时浏览器限制本地能力，也可以在项目目录临时启动静态服务：

```bash
python3 -m http.server 8000
```

然后访问 `http://127.0.0.1:8000/web/`。

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
