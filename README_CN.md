# GIBench

**GIBench**（胃肠道基准）是一个交互式排行榜平台，用于评估大型视觉语言模型（LVLM）在胃肠道内镜视觉问答（VQA）任务中的表现。

[English Documentation](README.md)

## 概述

GIBench 在 **5 个临床评估维度** 上对比 **12 个 AI 模型** 与 **6 名医生** 的性能，覆盖食管、胃、结直肠三个解剖区域的 **20 种病变类型** 和 **947 张图像**。

### 评估任务

| 任务 | 描述 | 指标 |
|------|------|------|
| **Q1** | 解剖定位 | F1 分数 |
| **Q2** | 病变定位 | mIoU |
| **Q3** | 诊断 | F1 分数 |
| **Q4** | 临床发现 | Likert 评分 |
| **Q5** | 后续建议 | Likert 评分 |

### 评估模型

- **闭源模型**: Claude-3.5-Sonnet, Gemini-2.0-Flash, Gemini-2.5-Pro, GPT-4o, GPT-4.1
- **医学开源模型**: medgemma-27b-it, HuatuoGPT-Vision-34B, Lingshu-32B
- **通用开源模型**: ERNIE-4.5-VL-28B, GLM-4.5V-9B, Qwen2.5-VL-32B, Qwen2.5-VL-72B

### 参与医生

- **初级医生**: 3 名
- **实习医生**: 3 名

## 功能特性

- **双视图模式**: 模型排行榜 & 人机对比
- **双语支持**: 中英文界面切换
- **交互式可视化**: 带误差棒的柱状图、参与者信息面板
- **病变级分析**: 按 3 个区域 20 种病变类型的性能细分
- **统计严谨性**: 所有指标均计算标准误差

## 项目结构

```
GIBench/
├── index.html                          # 主页面
├── generate_gibench_leaderboard.py     # 数据生成脚本
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

直接在现代浏览器中打开 `index.html` 即可，无需服务器。

### 重新生成数据

```bash
python generate_gibench_leaderboard.py
```

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6 模块)
- **后端**: Python（数据预处理）
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
