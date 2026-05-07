workspace "Arrhenius Temperature Severity Evidence Map" "基于 NASA POWER 小时温度和 Arrhenius 10°C rule 的高温严苛度证据链" {
    model {
        reviewer = person "工程评审者" "需要判断科威特市、吉赞、苏丹港及其他候选热城的电子器件寿命温度严苛度。"

        arrhenius_model = softwareSystem "Arrhenius 温度加速模型" "可靠性理论基础：温度升高会加速失效；10°C 寿命减半是工程简化近似。" {
            tags "Theory"
        }

        nasa_power = softwareSystem "NASA POWER Hourly API" "提供 2016-2025 小时级 T2M 2米气温，time-standard=LST。" {
            tags "Data"
        }

        severity_calc = softwareSystem "小时级指数损伤计算" "damage_index = mean(2^(T2M_C/10)); T_eq = 10*log2(damage_index)。" {
            tags "Calculation"
        }

        report = softwareSystem "Arrhenius 高温严苛度报告" "沉淀理论、口径、候选点排序、工程建议和边界。" {
            tags "Decision"
        }

        ahvaz = softwareSystem "阿瓦士" "T_eq=32.18°C, ratio_vs_kuwait=1.168x, 极端高温尾部最强。" {
            tags "HotTail"
        }
        jacobabad = softwareSystem "雅各布阿巴德" "T_eq=31.83°C, ratio_vs_kuwait=1.140x。" {
            tags "HotTail"
        }
        basra = softwareSystem "巴士拉" "T_eq=31.49°C, ratio_vs_kuwait=1.114x。" {
            tags "HotTail"
        }
        jizan = softwareSystem "吉赞" "mean=30.93°C, T_eq=31.32°C, ratio_vs_kuwait=1.101x；全年持续热。" {
            tags "PersistentHeat"
        }
        kuwait_city = softwareSystem "科威特市" "mean=26.97°C, T_eq=29.93°C, 基准点；夏季高温尾部强。" {
            tags "Baseline"
        }
        port_sudan = softwareSystem "苏丹港" "mean=29.43°C, T_eq=29.92°C, ratio_vs_kuwait=0.999x；持续温热但高温尾部弱。" {
            tags "PersistentHeat"
        }

        reviewer -> report "读取结论和证据"
        arrhenius_model -> severity_calc "定义温度损伤加权"
        nasa_power -> severity_calc "输入逐小时 T2M"
        severity_calc -> report "输出排名、T_eq、相对科威特损伤倍率"

        severity_calc -> ahvaz "识别最高严苛度"
        severity_calc -> jacobabad "识别更严苛候选"
        severity_calc -> basra "识别更严苛候选"
        severity_calc -> jizan "识别全年持续热样本"
        severity_calc -> kuwait_city "作为相对倍率基准"
        severity_calc -> port_sudan "识别与科威特近似打平"
    }

    views {
        systemLandscape "arrhenius-temperature-severity" "Arrhenius 高温严苛度证据链" {
            include *
            autolayout lr
        }

        styles {
            element "Theory" {
                background "#f59e0b"
                color "#111827"
            }
            element "Data" {
                background "#3b82f6"
                color "#ffffff"
            }
            element "Calculation" {
                background "#8b5cf6"
                color "#ffffff"
            }
            element "Decision" {
                background "#fde047"
                color "#111827"
            }
            element "HotTail" {
                background "#ef4444"
                color "#ffffff"
            }
            element "PersistentHeat" {
                background "#22c55e"
                color "#ffffff"
            }
            element "Baseline" {
                background "#6b7280"
                color "#ffffff"
            }
        }
    }
}

