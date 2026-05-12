# 双源一致证据层设计

## 目标

把 NASA POWER 主数据和 ERA5-Land 抽样校验融合成一个可迁移工程口径：

- NASA POWER 仍是网页工具和 Excel 工作簿的主数据源。
- ERA5-Land 只作为可选质量证据层，不阻塞普通温度拉取。
- 双源一致结论进入 Excel 摘要、运行记录和单独的 `双源一致校验` sheet。

## 工程分层

| 层级 | 组件 | 职责 |
|---|---|---|
| 主数据层 | `web/index.html` + `web/app.js` | 按经纬度拉 NASA POWER Hourly `T2M`，计算超温占比，导出 Excel。 |
| 校验层 | `scripts/era5_lightweight_sample_check.py` | 读取已有 NASA 长表，抽样请求 Open-Meteo ERA5-Land，输出 JSON/CSV/报告。 |
| 融合层 | 网页“双源一致证据”上传入口 | 读取校验 JSON/CSV，按 `site_id/city_id` 合并到摘要和 Excel。 |

## 状态口径

| 状态 | 含义 | Excel 中的使用 |
|---|---|---|
| `双源一致` | 抽样均值和高温尾部均低于工程阈值。 | 可作为该城市 NASA POWER 结果的质量支撑。 |
| `双源基本一致，高温尾部需标注` | 均值通过，但高温尾部偏差进入标注区间。 | 结论可用，但报告高温尾部时应注明 ERA5 差异。 |
| `需第三/第四源投票` | 均值、高温尾部、缺测或单点 P95 触发阈值。 | 不直接否定 NASA POWER，但该城市需引入 NOAA ISD / MERRA-2 等追加核验。 |
| `未导入` | 本次网页导出未提供双源校验文件。 | 只能说明未做双源一致校验，不能表述为已一致。 |

## 使用流程

1. 用网页工具导出 NASA 工作簿，或用脚本生成 NASA 长表。
2. 运行 ERA5-Land 抽样校验：

```bash
python3 scripts/era5_lightweight_sample_check.py --cities jizan_saudi,kuwait_city,ahvaz
```

3. 在网页“双源一致证据”处上传 `data/summary/era5_lightweight_sample_check_summary.json`。
4. 重新点击“开始拉取”，再下载 Excel。
5. Excel 中查看：
   - `摘要`：每个点位的 `双源状态` 和 `双源备注`。
   - `双源一致校验`：ERA5 抽样校验城市级结果。
   - `运行记录`：双源证据文件、模型、抽样参数和阈值。

## 边界

- 双源一致是抽样校验，不是 ERA5 全量复算。
- ERA5-Land 与 NASA POWER 存在网格、地形、时间标准和再分析模型差异，单点小时偏差不能直接作为否定依据。
- 网页不主动批量请求 ERA5，避免浏览器端耗时过长、公共 API 压力过大和分享使用时的不稳定。
