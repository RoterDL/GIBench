# GIBench

**GIBench**（胃肠道基准）是一个交互式排行榜平台，用于评估大型视觉语言模型（LVLM）在胃肠道内镜视觉问答（VQA）任务中的表现。

[English Documentation](README.md)

## 概述

GIBench 在 **5 个临床评估维度** 上对比 **12 个 AI 模型** 与 **6 名医生** 的性能，覆盖食管、胃、结直肠三个解剖区域的 **20 种病变类型** 和 **947 张图像**。

### 评估任务

| 任务         | 描述     | 指标        |
| ------------ | -------- | ----------- |
| **Q1** | 解剖定位 | F1 分数     |
| **Q2** | 病变定位 | mIoU        |
| **Q3** | 诊断     | F1 分数     |
| **Q4** | 临床发现 | Likert 评分 |
| **Q5** | 后续建议 | Likert 评分 |

### 评估模型

- **闭源模型**: claude-sonnet-4-5, gemini-2.5-pro, gemini-3-pro, gpt-4o, gpt-5
- **医学开源模型**: medgemma-27b-it, HuatuoGPT-Vision-34B, Lingshu-32B
- **通用开源模型**: ERNIE-4.5-Turbo-VL-32K, GLM-4.5V, Qwen2.5-VL-72B-Instruct, qwen3-vl-plus

### 参与医生

- **初级医生**: 3 名
- **实习医生**: 3 名

## 功能特性

- **人机对比分析**: 初级临床医生与AI模型的全面性能对比
- **双语切换**: 中英文界面一键切换
- **多指标排序**: 支持按Q1-Q5各指标排序（Macro-F1、mIoU、Likert评分）
- **按病变细分**: Q1-Q5各任务按病变类型的详细分析
- **交互式排行榜**: 表格展示所有参与者的评估指标
- **统计概览**: 展示病变类型、图像数量、参与者数量等关键指标

## 项目结构

```
GIBench/
├── index.html                          # 主页面
├── assets/
│   ├── css/
│   │   └── gibench.css                 # 样式表
│   ├── js/
│   │   ├── app.js                      # 主应用
│   │   ├── leaderboard.js              # 排行榜逻辑
│   │   ├── human_vs_model.js           # 人机对比逻辑
│   │   └── i18n.js                     # 国际化
│   └── data/
│       ├── leaderboard.json            # 排名数据
│       └── gibench_standards.json      # 标准定义
```

## 使用方法

### 查看排行榜

访问 [https://roterdl.github.io/GIBench/](https://roterdl.github.io/GIBench/)

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6 模块)
- **数据格式**: JSON

## 许可证

本项目仅供研究使用。

## 引用

如果您在研究中使用了 GIBench，请引用：

```bibtex
@misc{gibench2025,
  title={GIBench: A Benchmark for Gastrointestinal Endoscopy Visual Question Answering},
  year={2025}
}
```
