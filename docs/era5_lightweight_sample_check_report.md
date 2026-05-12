# ERA5-Land 轻量抽样校验报告

## 口径

- 目标：基于 NASA POWER 已有长表 CSV 随机打点，用 ERA5-Land 做轻量旁路校验。
- NASA 输入：`data/processed/nasa_power_t2m_hourly_2016_2025_ahvaz_basra_jacobabad_riyadh_mecca_kuwait_city_jizan_saudi_port_sudan_lst.csv`。
- 抽样：每城 `100` 点，固定随机种子 `20260512`；`60%` 全时段随机、`20%` NASA `P95-P99`、`20%` NASA 最高温尾部。
- ERA5 来源：Open-Meteo Historical Weather API 的 `era5_land` 模型，变量 `temperature_2m`，单位摄氏度。
- ERA5 拉取粒度：`year`；默认按抽样点所在 UTC 年份批量缓存，以减少请求次数。
- 时间对齐：NASA 当前为 `LST`；ERA5 为 `UTC`。本脚本按 `UTC = LST - longitude / 15` 近似换算，并取最近整点。
- 判定阈值：抽样均值偏差 `<= 1.50°C`；高温分层均值偏差 `<= 3.00°C` 为双源一致，`3.00-4.00°C` 为标注区间，`> 4.00°C` 触发投票；单点绝对偏差 P95 `> 6.00°C` 才作为硬异常触发投票。

## 城市级结论

| 城市 | 样本 | NASA均值 | ERA5均值 | 均值偏差 | 单点P95绝对偏差 | 高温尾部偏差 | 状态 |
|---|---:|---:|---:|---:|---:|---:|---|
| 阿瓦士 | 100 | 36.71 | 35.82 | -0.89 | 5.58 | -2.51 | 双源一致 |
| 吉赞 | 100 | 33.98 | 32.55 | -1.44 | 4.12 | -2.91 | 双源一致 |
| 科威特市 | 100 | 34.17 | 34.25 | 0.08 | 3.10 | -0.49 | 双源一致 |

## 投票触发

本轮抽样未触发第三、第四源投票。

## 输出文件

- 抽样明细：`data/summary/era5_lightweight_sample_check_samples.csv`
- 城市汇总：`data/summary/era5_lightweight_sample_check_city_summary.csv`
- JSON 汇总：`data/summary/era5_lightweight_sample_check_summary.json`

## 边界

- 这是轻量抽检，不是 ERA5 全量复算。
- 单点小时偏差可能包含 LST/UTC 近似换算、网格代表性、地形下采样和再分析模型差异。
- 结论优先看城市级抽样均值和高温分层趋势，不用单个小时差异直接否定 NASA POWER。
