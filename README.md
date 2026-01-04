# GIBench

**GIBench** (Gastrointestinal Benchmark) is an interactive leaderboard platform for evaluating large vision-language models (LVLMs) on gastrointestinal endoscopy visual question answering (VQA) tasks.

[中文文档](README_CN.md)

## Overview

GIBench benchmarks **12 AI models** against **6 physicians** across **5 clinical evaluation dimensions**, covering **20 lesion types** and **947 images** from three anatomical regions: esophagus, stomach, and colorectum.

### Evaluation Tasks

| Task         | Description             | Metric       |
| ------------ | ----------------------- | ------------ |
| **Q1** | Anatomical Localization | F1 Score     |
| **Q2** | Lesion Localization     | mIoU         |
| **Q3** | Diagnosis               | F1 Score     |
| **Q4** | Clinical Findings       | Likert Score |
| **Q5** | Recommendations         | Likert Score |

### Models Evaluated

- **Closed-source**: claude-sonnet-4-5, gemini-2.5-pro, gemini-3-pro, gpt-4o, gpt-5
- **Medical Open-source**: medgemma-27b-it, HuatuoGPT-Vision-34B, Lingshu-32B
- **General Open-source**: ERNIE-4.5-Turbo-VL-32K, GLM-4.5V, Qwen2.5-VL-72B-Instruct, qwen3-vl-plus

### Physician Participants

- **Junior Physicians**: 3 participants
- **Trainee Physicians**: 3 participants

## Features

- **Human-Model Comparison**: Comprehensive performance comparison between junior clinicians and AI models
- **Bilingual Interface**: One-click switch between Chinese and English
- **Multi-metric Sorting**: Sort by Q1-Q5 metrics (Macro-F1, mIoU, Likert scores)
- **Per-lesion Analysis**: Detailed breakdown by lesion type for each evaluation task (Q1-Q5)
- **Interactive Leaderboard**: Tabular display of all participants with evaluation metrics
- **Statistics Overview**: Key metrics including lesion types, image count, and participant numbers

## Project Structure

```
GIBench/
├── index.html                          # Main page
├── assets/
│   ├── css/
│   │   └── gibench.css                 # Stylesheet
│   ├── js/
│   │   ├── app.js                      # Main application
│   │   ├── leaderboard.js              # Leaderboard logic
│   │   ├── human_vs_model.js           # Human vs. Model comparison
│   │   └── i18n.js                     # Internationalization
│   └── data/
│       ├── leaderboard.json            # Ranking data
│       └── gibench_standards.json      # Standard definitions
```

## Usage

### View the Leaderboard

Visit [https://roterdl.github.io/GIBench/](https://roterdl.github.io/GIBench/)

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6 Modules)
- **Data Format**: JSON

## License

This project is for research purposes.

## Citation

If you use GIBench in your research, please cite:

```bibtex
@misc{gibench2025,
  title={GIBench: A Benchmark for Gastrointestinal Endoscopy Visual Question Answering},
  year={2025}
}
```
