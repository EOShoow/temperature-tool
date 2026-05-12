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

如果只知道国家名称，可以用“按国家列出城市”。工具会返回已维护国家的内置 Top 经济城市候选，候选仍需手动确认后加入 CSV。这些列表是便于气温拉取的实用候选，不是官方 GDP 精确排名证据；如需严谨 GDP 排名，应外部核验后手工输入坐标。未内置国家请用“按城市名添加点位”逐个查询，或直接手工输入经纬度。

网页默认开启“自动双源校验”：NASA 主数据拉取完成后，浏览器会自动请求 Open-Meteo ERA5-Land `temperature_2m` 的固定三周窗口（每年 `01-01~01-07`、`05-01~05-07`、`10-01~10-07`），并把城市级 `双源一致 / 双源基本一致，高温窗口需标注 / 需第三/第四源投票` 状态合入摘要和 Excel。也可以在“双源一致证据”处导入已有 `era5_lightweight_sample_check_summary.json` 或城市汇总 CSV 作为兜底。

复制到本地运行时，保留整个 `web/` 文件夹即可；至少需要 `web/index.html`、`web/app.js`、`web/styles.css` 三个文件在同一目录。

Excel 工作簿包含：

- `摘要`：数据口径、缓存命中、超温占比和每个点位统计。
- `宽表_全部点位对齐`：按 `date + hour` 对齐全部点位。
- 每个点位一个 `*_长表`：逐日逐小时气温明细。
- `双源一致校验`：自动 ERA5-Land 固定窗口校验或导入已有校验结果时生成。
- `双源抽样明细`：自动校验时生成，记录每个固定窗口小时的 NASA/ERA5 差值。
- `运行记录`：本次参数、工具版本和点位清单。
- `错误记录`：仅在 NASA 请求失败时生成。

如果直接双击打开时浏览器限制本地能力，也可以在项目目录临时启动静态服务：

```bash
python3 -m http.server 8000
```

然后访问 `http://127.0.0.1:8000/web/`。

“按国家列出城市”使用工具内置候选表，不再实时扫描整国城市；因此未维护国家会给出提示，而不会触发 `Load failed`。

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

## ERA5-Land 轻量抽样校验

ERA5-Land 校验是 NASA POWER 主线之外的双源一致证据层。网页端默认按固定三周窗口请求 Open-Meteo Historical Weather API 的 `era5_land` 模型：每年 `01-01~01-07`、`05-01~05-07`、`10-01~10-07`，按窗口短日期范围和多坐标批量请求，避免为少量校验点拉全年小时数据。离线脚本仍保留旧的 `100` 点随机抽样口径，用于离线批量报告。

默认运行：

```bash
python3 scripts/era5_lightweight_sample_check.py
```

先跑 3 城小样本：

```bash
python3 scripts/era5_lightweight_sample_check.py --cities jizan_saudi,kuwait_city,ahvaz
```

输出：

- `data/summary/era5_lightweight_sample_check_samples.csv`：抽样点明细。
- `data/summary/era5_lightweight_sample_check_city_summary.csv`：城市级偏差和状态。
- `data/summary/era5_lightweight_sample_check_summary.json`：机器可读汇总。
- `docs/era5_lightweight_sample_check_report.md`：中文报告。

网页端判定默认使用：固定窗口总体均值偏差 `<= 1.5°C` 视为通过；最大窗口均值偏差 `<= 3°C` 视为双源一致，`3-4°C` 视为“双源基本一致，高温窗口需标注”，`> 4°C` 进入第三、第四源投票；单点绝对偏差 P95 只作为硬异常观察项，`> 6°C` 才触发投票。第三、第四源优先引入 `NOAA ISD / Global Hourly` 和 `MERRA-2`。固定三周窗口是快速一致性证据，不等同于全年高温尾部全覆盖校验。

融合设计见 `docs/dual_source_consistency_design.md`。网页端默认自动请求 ERA5-Land，并在 IndexedDB 中缓存固定窗口响应；公共接口返回 `HTTP 429` 时会限速退避重试。如果自动请求仍失败，可用离线脚本生成校验 JSON 后在网页中导入。
