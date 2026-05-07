#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 Arrhenius 高温严苛度证据链 Excalidraw 源文件。"""

from __future__ import annotations

import json
from pathlib import Path


OUT = Path("docs/diagrams/arrhenius-temperature-severity.excalidraw")


def rect(element_id: str, x: int, y: int, w: int, h: int, stroke: str, fill: str) -> dict:
    return {
        "id": element_id,
        "type": "rectangle",
        "x": x,
        "y": y,
        "width": w,
        "height": h,
        "angle": 0,
        "strokeColor": stroke,
        "backgroundColor": fill,
        "fillStyle": "solid",
        "strokeWidth": 2,
        "strokeStyle": "solid",
        "roughness": 0,
        "opacity": 100,
        "groupIds": [],
        "frameId": None,
        "roundness": {"type": 3},
        "seed": abs(hash(element_id)) % 1000000,
        "version": 1,
        "versionNonce": abs(hash(element_id + "n")) % 1000000,
        "isDeleted": False,
        "boundElements": None,
        "updated": 1,
        "link": None,
        "locked": False,
    }


def text(element_id: str, x: int, y: int, w: int, h: int, value: str, size: int = 24, color: str = "#111827") -> dict:
    return {
        "id": element_id,
        "type": "text",
        "x": x,
        "y": y,
        "width": w,
        "height": h,
        "angle": 0,
        "strokeColor": color,
        "backgroundColor": "transparent",
        "fillStyle": "solid",
        "strokeWidth": 1,
        "strokeStyle": "solid",
        "roughness": 0,
        "opacity": 100,
        "groupIds": [],
        "frameId": None,
        "roundness": None,
        "seed": abs(hash(element_id)) % 1000000,
        "version": 1,
        "versionNonce": abs(hash(element_id + "n")) % 1000000,
        "isDeleted": False,
        "boundElements": None,
        "updated": 1,
        "link": None,
        "locked": False,
        "fontSize": size,
        "fontFamily": 1,
        "text": value,
        "textAlign": "left",
        "verticalAlign": "top",
        "containerId": None,
        "originalText": value,
        "lineHeight": 1.25,
        "baseline": h - 8,
    }


def arrow(element_id: str, x: int, y: int, points: list[list[int]], color: str = "#374151") -> dict:
    return {
        "id": element_id,
        "type": "arrow",
        "x": x,
        "y": y,
        "width": max(p[0] for p in points) - min(p[0] for p in points),
        "height": max(p[1] for p in points) - min(p[1] for p in points),
        "angle": 0,
        "strokeColor": color,
        "backgroundColor": "transparent",
        "fillStyle": "solid",
        "strokeWidth": 3,
        "strokeStyle": "solid",
        "roughness": 0,
        "opacity": 100,
        "groupIds": [],
        "frameId": None,
        "roundness": {"type": 2},
        "seed": abs(hash(element_id)) % 1000000,
        "version": 1,
        "versionNonce": abs(hash(element_id + "n")) % 1000000,
        "isDeleted": False,
        "boundElements": None,
        "updated": 1,
        "link": None,
        "locked": False,
        "points": points,
        "lastCommittedPoint": None,
        "startBinding": None,
        "endBinding": None,
        "startArrowhead": None,
        "endArrowhead": "arrow",
    }


def card(elements: list[dict], card_id: str, x: int, y: int, w: int, h: int, title: str, body: str, fill: str, stroke: str = "#111827") -> None:
    elements.append(rect(f"box_{card_id}", x, y, w, h, stroke, fill))
    elements.append(text(f"text_{card_id}_title", x + 18, y + 14, w - 36, 34, title, 26))
    elements.append(text(f"text_{card_id}_body", x + 18, y + 56, w - 36, h - 70, body, 20))


def main() -> None:
    elements: list[dict] = []

    elements.append(text("title_arrhenius_temperature_severity", 40, 20, 1280, 48, "Arrhenius 高温严苛度证据链", 34))
    elements.append(text("subtitle_arrhenius_temperature_severity", 42, 72, 1320, 36, "从可靠性理论到 NASA 小时温度，再到科威特、吉赞、苏丹港及更严苛候选点排序", 20, "#4b5563"))

    card(
        elements,
        "arrhenius_model",
        60,
        150,
        310,
        185,
        "理论：Arrhenius / 10°C rule",
        "温度升高会加速失效。\n工程近似：每升高 10°C，寿命约减半。\n用于初筛，不替代具体 Ea 和 Tj 模型。",
        "#fef3c7",
        "#f59e0b",
    )
    card(
        elements,
        "nasa_power",
        60,
        390,
        310,
        165,
        "数据：NASA POWER",
        "Hourly API / T2M\n2016-2025，共 87,672 小时\n时间标准：LST\n输入为 2 米环境气温。",
        "#dbeafe",
        "#2563eb",
    )
    card(
        elements,
        "severity_calc",
        465,
        245,
        360,
        220,
        "计算：小时级指数损伤",
        "damage = mean(2^(T/10))\nT_eq = 10*log2(damage)\n以科威特市为 1.00x 基准。\n高温尾部会被指数放大。",
        "#ede9fe",
        "#7c3aed",
    )

    card(
        elements,
        "hot_tail_group",
        925,
        140,
        430,
        230,
        "更严苛：极端高温尾部",
        "阿瓦士：T_eq 32.18°C / 1.168x\n雅各布阿巴德：31.83°C / 1.140x\n巴士拉：31.49°C / 1.114x\n特点：>=45°C 小时多，P99 高。",
        "#fee2e2",
        "#dc2626",
    )
    card(
        elements,
        "persistent_heat_group",
        925,
        420,
        430,
        230,
        "持续高温：全年热暴露",
        "吉赞：mean 30.93°C / T_eq 31.32°C / 1.101x\n苏丹港：mean 29.43°C / T_eq 29.92°C / 0.999x\n特点：低冷却季，峰值不一定极端。",
        "#dcfce7",
        "#16a34a",
    )
    card(
        elements,
        "kuwait_baseline",
        465,
        535,
        360,
        165,
        "基准：科威特市",
        "mean 26.97°C\nT_eq 29.93°C\nP99 44.09°C\n夏季高温尾部强，但冬季低温拉低全生命周期损伤。",
        "#f3f4f6",
        "#6b7280",
    )
    card(
        elements,
        "decision_output",
        1460,
        250,
        420,
        260,
        "报告结论",
        "科威特市不是最严苛点位。\n吉赞比科威特严苛约 10%，代表全年持续热。\n苏丹港与科威特几乎打平，但机制不同。\n阿瓦士/巴士拉适合做极端尾部压力样本。",
        "#fef9c3",
        "#ca8a04",
    )

    elements.extend(
        [
            arrow("arrow_arrhenius_to_calc", 370, 240, [[0, 0], [95, 70]], "#7c3aed"),
            arrow("arrow_nasa_to_calc", 370, 475, [[0, 0], [95, -70]], "#2563eb"),
            arrow("arrow_calc_to_hot_tail", 825, 320, [[0, 0], [100, -70]], "#dc2626"),
            arrow("arrow_calc_to_persistent_heat", 825, 360, [[0, 0], [100, 170]], "#16a34a"),
            arrow("arrow_kuwait_to_calc", 645, 535, [[0, 0], [0, -70]], "#6b7280"),
            arrow("arrow_hot_tail_to_decision", 1355, 250, [[0, 0], [105, 90]], "#dc2626"),
            arrow("arrow_persistent_to_decision", 1355, 535, [[0, 0], [105, -100]], "#16a34a"),
            arrow("arrow_calc_to_decision", 825, 355, [[0, 0], [635, 25]], "#7c3aed"),
        ]
    )

    elements.append(text("note_boundaries", 60, 750, 1780, 70, "边界：T2M 是环境温度，不是器件结温 Tj；未纳入湿度、盐雾、沙尘、太阳辐照和负载温升。结论适用于候选热城对照，不是全球城市穷举排名。", 22, "#991b1b"))

    payload = {
        "type": "excalidraw",
        "version": 2,
        "source": "https://excalidraw.com",
        "elements": elements,
        "appState": {
            "gridSize": None,
            "viewBackgroundColor": "#ffffff",
            "currentItemFontFamily": 1,
        },
        "files": {},
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()

