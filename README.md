# GIBench

**GIBench** (Gastrointestinal Benchmark) is an interactive leaderboard platform for evaluating large vision-language models (LVLMs) on gastrointestinal endoscopy visual question answering (VQA) tasks.

[中文文档](README_CN.md)

## Overview

GIBench benchmarks **12 AI models** against **6 physicians** across **5 clinical evaluation dimensions**, covering **20 lesion types** and **947 images** from three anatomical regions: esophagus, stomach, and colorectum.

### Evaluation Tasks

| Task | Description | Metric |
|------|-------------|--------|
| **Q1** | Anatomical Localization | F1 Score |
| **Q2** | Lesion Localization | mIoU |
| **Q3** | Diagnosis | F1 Score |
| **Q4** | Clinical Findings | Likert Score |
| **Q5** | Recommendations | Likert Score |

### Models Evaluated

- **Closed-source**: Claude-3.5-Sonnet, Gemini-2.0-Flash, Gemini-2.5-Pro, GPT-4o, GPT-4.1
- **Medical Open-source**: medgemma-27b-it, HuatuoGPT-Vision-34B, Lingshu-32B
- **General Open-source**: ERNIE-4.5-VL-28B, GLM-4.5V-9B, Qwen2.5-VL-32B, Qwen2.5-VL-72B

### Physician Participants

- **Junior Physicians**: 3 participants
- **Trainee Physicians**: 3 participants

## Features

- **Dual View Modes**: Model Leaderboard & Human vs. Model Comparison
- **Bilingual Support**: English and Chinese interface
- **Interactive Visualizations**: Bar charts with error bars, participant info panels
- **Lesion-level Analysis**: Performance breakdown by 20 lesion types across 3 regions
- **Statistical Rigor**: Standard error calculations for all metrics

## Project Structure

```
GIBench/
├── index.html                          # Main page
├── generate_gibench_leaderboard.py     # Data generation script
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

Simply open `index.html` in a modern web browser. No server required.

### Regenerate Data

```bash
python generate_gibench_leaderboard.py
```

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6 Modules)
- **Backend**: Python (data preprocessing)
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
