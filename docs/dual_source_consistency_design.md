# 双源一致证据层设计

## 目标

把 NASA POWER 主数据和 ERA5-Land 抽样校验融合成一个可迁移工程口径：

- NASA POWER 仍是网页工具和 Excel 工作簿的主数据源。
- ERA5-Land 作为默认开启的自动质量证据层；用户也可关闭自动校验或导入已有证据兜底。
- 双源一致结论进入 Excel 摘要、运行记录和单独的 `双源一致校验` sheet。

## 工程分层

| 层级 | 组件 | 职责 |
|---|---|---|
| 主数据层 | `web/index.html` + `web/app.js` | 按经纬度拉 NASA POWER Hourly `T2M`，计算超温占比，导出 Excel。 |
| 校验层 | 网页自动校验 + `scripts/era5_lightweight_sample_check.py` | 网页默认自动抽样请求 Open-Meteo ERA5-Land；脚本用于离线批量报告。 |
| 融合层 | 网页“双源一致证据”区域 | 自动结果优先；导入校验 JSON/CSV 作为兜底，按 `site_id/city_id` 合并到摘要和 Excel。 |

## 状态口径

| 状态 | 含义 | Excel 中的使用 |
|---|---|---|
| `双源一致` | 抽样均值和高温尾部均低于工程阈值。 | 可作为该城市 NASA POWER 结果的质量支撑。 |
| `双源基本一致，高温尾部需标注` | 均值通过，但高温尾部偏差进入标注区间。 | 结论可用，但报告高温尾部时应注明 ERA5 差异。 |
| `需第三/第四源投票` | 均值、高温尾部、缺测、ERA5 请求失败或单点 P95 触发阈值。 | 不直接否定 NASA POWER，但该城市需引入 NOAA ISD / MERRA-2 等追加核验；查看 `超限项` 和 `超限说明`。 |
| `未导入` | 自动校验关闭且未导入校验文件。 | 只能说明未做双源一致校验，不能表述为已一致。 |

## 使用流程

1. 默认流程：在网页保持“自动双源校验”开启，点击“开始拉取”。
2. 网页先请求 NASA POWER，再按每城 `100` 个样本自动请求 ERA5-Land 年度数据。
3. Excel 中查看：
   - `摘要`：每个点位的 `双源状态`、`超限项`、`超限说明` 和 `双源备注`。
   - `双源一致校验`：城市级规则触发结果。
   - `双源抽样明细`：自动抽样点的 NASA/ERA5 差值。
   - `运行记录`：双源模型、抽样参数和阈值。
4. 离线兜底：如果浏览器端 ERA5 请求失败，运行 ERA5-Land 抽样校验脚本：

```bash
python3 scripts/era5_lightweight_sample_check.py --cities jizan_saudi,kuwait_city,ahvaz
```

5. 在网页“双源一致证据”处导入 `data/summary/era5_lightweight_sample_check_summary.json`，作为已有校验证据兜底。

## 边界

- 双源一致是抽样校验，不是 ERA5 全量复算。
- ERA5-Land 与 NASA POWER 存在网格、地形、时间标准和再分析模型差异，单点小时偏差不能直接作为否定依据。
- 网页自动校验会请求 Open-Meteo 公共 API；大批量点位和多年范围会变慢，已有年度响应会缓存在 IndexedDB。
