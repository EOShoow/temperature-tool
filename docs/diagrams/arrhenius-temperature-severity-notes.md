# Arrhenius 高温严苛度图示说明

## 文件

- `arrhenius-temperature-severity.dsl`：结构源，记录核心实体与关系。
- `arrhenius-temperature-severity.excalidraw`：展示源，用于人工查看和二次编辑。
- `../../scripts/build_arrhenius_diagram_excalidraw.py`：生成 EXDR 的脚本，便于后续批量调整文案和布局。

## SDSL 与 EXDR 对应

| SDSL 元素 | EXDR 元素 | 说明 |
|---|---|---|
| `arrhenius_model` | `box_arrhenius_model` | 理论输入：Arrhenius / 10°C rule |
| `nasa_power` | `box_nasa_power` | 数据输入：NASA POWER 小时级 `T2M` |
| `severity_calc` | `box_severity_calc` | 计算节点：小时级指数损伤与等效温度 |
| `kuwait_city` | `box_kuwait_baseline` | 基准点：科威特市 |
| `jizan` / `port_sudan` | `box_persistent_heat_group` | 展示分组：全年持续热暴露 |
| `ahvaz` / `jacobabad` / `basra` | `box_hot_tail_group` | 展示分组：极端高温尾部 |
| `report` | `box_decision_output` | 结论输出：报告主判断 |

## 对齐检查

1. 核心 EXDR 框均对应 SDSL 元素，或为基于 SDSL 元素的明确展示分组。
2. 核心 EXDR 箭头均对应 SDSL 关系，或表达从计算到分组结论的文档化推断。
3. `hot_tail_group` 与 `persistent_heat_group` 是展示分组，不是额外事实源。
4. 当前只提交源文件 `.dsl` 和 `.excalidraw`；未把导出 `.svg` / `.png` 当成长期编辑源。
5. 中文标题和正文均拆成独立 text 元素，文本框留有宽度和高度余量。

