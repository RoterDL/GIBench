const UI_TEXTS = {
  "hero-title": { zh: "GIBench 模型榜", en: "GIBench Leaderboard" },
  "hero-desc": {
    zh: "多模态消化内镜 VQA 基准：Q1 解剖定位、Q2 病变定位、Q3 诊断、Q4 看图说话 与 Q5 后续建议，支持模型间与人机对比两种视图。",
    en: "Multimodal endoscopy VQA benchmark: Q1 anatomical localization, Q2 lesion localization, Q3 diagnosis, Q4 findings, and Q5 recommendations, supporting model leaderboard and human vs model views.",
  },
  "stat-disease-label": { zh: "病变类型", en: "Disease Types" },
  "stat-disease-sub": { zh: "食管 / 胃 / 结直肠", en: "Esophagus / Stomach / Colorectum" },
  "stat-image-label": { zh: "图像与题目", en: "Images & Questions" },
  "stat-image-sub": { zh: "20类病变，Q1–Q5 评估", en: "20 types of lesions, Q1–Q5 tasks" },
  "stat-eval-label": { zh: "Likert评估主体", en: "Likert Evaluators" },
  "stat-eval-sub": { zh: "3 名专科医生 + LLM 裁判", en: "3 specialists + LLM judge" },
  "stat-model-label": { zh: "模型数量", en: "Models" },
  "stat-model-sub": { zh: "MLLMs 商业 / 医疗开源 / 开源", en: "MLLMs Commercial / Medical Open Source / Open Source" },
  "tab-label-model": { zh: "模型榜", en: "Model Leaderboard" },
  "tab-label-human": { zh: "人机对比", en: "Human vs Model" },
  "label-tasks": { zh: "任务", en: "Tasks" },
  "task-pill-q1": { zh: "Q1 解剖定位", en: "Q1 anatomical localization" },
  "task-pill-q2": { zh: "Q2 病变定位", en: "Q2 lesion localization" },
  "task-pill-q3": { zh: "Q3 诊断选择", en: "Q3 diagnosis" },
  "label-sort": { zh: "排序（前端示意）", en: "Sorting (UI only)" },
  "sort-opt-q1": { zh: "Q1 解剖定位-F1", en: "Q1 anatomical localization-F1" },
  "sort-opt-q2": { zh: "Q2 病变定位-mIoU", en: "Q2 lesion localization-mIoU" },
  "sort-opt-q3": { zh: "Q3 诊断-F1", en: "Q3 diagnosis-F1" },
  "table-col-model": { zh: "模型", en: "Model" },
  "card-title-ranking": { zh: "模型整体排名", en: "Model Overall Ranking" },
  "card-subtitle-ranking": {
    zh: "使用 Q1/Q2/Q3 指标生成的示意排序，具体加权方式请参考论文和文档。",
    en: "Illustrative ordering using Q1/Q2/Q3 metrics; see paper/docs for weighting details.",
  },
  "card-title-summary": { zh: "当前模型概览", en: "Current Model Summary" },
  "card-title-detail": { zh: "按病变 / 区域细节", en: "Per-disease / region details" },
  "card-subtitle-detail": {
    zh: "选择子任务与病变，对比所有模型在对应指标下的表现。",
    en: "Select a task and lesion to compare all models on the corresponding metric.",
  },
  "label-disease-select": { zh: "病变选择", en: "Lesion" },
  "subtab-q1": { zh: "Q1 解剖定位-F1", en: "Q1 anatomical localization-F1" },
  "subtab-q2": { zh: "Q2 病变定位-mIoU", en: "Q2 lesion localization-mIoU" },
  "subtab-q3": { zh: "Q3 诊断-F1", en: "Q3 diagnosis-F1" },
  "label-scope": { zh: "范围", en: "Scope" },
  "scope-q1q3": { zh: "Q1/Q2/Q3 选择题与定位", en: "Q1/Q2/Q3 multiple-choice & localization" },
  "scope-q4q5": { zh: "Q4/Q5 简答题", en: "Q4/Q5 free-form" },
  "label-note": { zh: "说明", en: "Notes" },
  "note-human-main": {
    zh: "仅展示总体层面的人机差异，可在论文/补充材料中查看更细粒度分析。",
    en: "Shows only overall human-model gaps; see paper/supplement for finer-grained analysis.",
  },
  "hvm-q1q3-title": { zh: "Q1/Q3 选择题（Macro‑F1）", en: "Q1/Q3 multiple-choice (Macro‑F1)" },
  "hvm-q1q3-doctor-label": { zh: "医生（平均）", en: "Doctors (mean)" },
  "hvm-q1q3-model-label": { zh: "最佳模型", en: "Best model" },
  "hvm-q1q3-note": { zh: "基于宏平均 F1（总体）。", en: "Based on macro-average F1 (overall)." },
  "hvm-q2-title": { zh: "Q2 病变定位（mIoU）", en: "Q2 lesion localization (mIoU)" },
  "hvm-q2-doctor-label": { zh: "医生（平均）", en: "Doctors (mean)" },
  "hvm-q2-model-label": { zh: "最佳模型", en: "Best model" },
  "hvm-q2-note": { zh: "基于总体 mIoU。", en: "Based on overall mIoU." },
  "hvm-q4q5-title": { zh: "Q4/Q5 简答题（Likert 总分）", en: "Q4/Q5 free-form (Likert total)" },
  "hvm-q4q5-doctor-label": { zh: "医生（平均）", en: "Doctors (mean)" },
  "hvm-q4q5-model-label": { zh: "最佳模型", en: "Best model" },
  "hvm-q4q5-note": {
    zh: "基于“看图说话 / 后续建议”两类问题的 Likert 总分。",
    en: "Based on Likert total for findings & recommendations.",
  },
  "case-title": { zh: "小样本人机案例走查（结构占位）", en: "Sample human-model cases (placeholder)" },
  "case-subtitle": {
    zh: "当前版本仅提供总体指标，可在后续版本中将此区替换为具体病例级可视化。",
    en: "Current version shows only aggregate metrics; future versions can place case-level visualizations here.",
  },
  "case-placeholder": {
    zh: "这里预留给病例级对比展示（病变图像 + 医生答案 + 模型答案 + LLM 裁判评分）。当前阶段不做实现，仅保留结构占位，保证整体页面布局完整。",
    en: "Placeholder for case-level comparison (images + doctor answers + model answers + LLM scoring). Not implemented yet; layout placeholder only.",
  },
  "footer-method": {
    zh: "方法概要：Q1/Q3 使用宏平均 F1，Q2 使用总体 mIoU 及按病变 IoU，Q4/Q5 使用 5 维 Likert 与 LLM 裁判综合评分；人机对比基于统一抽样的病例子集。",
    en: "Method summary: Q1/Q3 use macro-average F1; Q2 uses overall mIoU and per-disease IoU; Q4/Q5 use 5-dim Likert with LLM judging; human vs model uses a unified sampled case set.",
  },
  "footer-data": { zh: "数据与代码：", en: "Data & code:" },
};

const MESSAGES = {
  "load.waiting": {
    zh: "等待加载 gibench_leaderboard.json…",
    en: "Waiting to load gibench_leaderboard.json…",
  },
  "load.loading": {
    zh: "正在加载 gibench_leaderboard.json…",
    en: "Loading gibench_leaderboard.json…",
  },
  "load.success": { zh: "数据加载完成。", en: "Data loaded." },
  "load.error": {
    zh: "加载 gibench_leaderboard.json 失败，请检查路径或在本地通过 HTTP 访问。",
    en: "Failed to load gibench_leaderboard.json. Please check the path or access via local HTTP.",
  },
  "no-model-selected": { zh: "尚未选择模型。", en: "No model selected." },
  "no-q1-data": { zh: "当前模型无 Q1 按病变结果。", en: "No Q1 per-disease results for this model." },
  "no-q2-data": { zh: "当前模型无 Q2 按病变结果。", en: "No Q2 per-disease results for this model." },
  "no-q3-data": { zh: "当前模型无 Q3 按区域结果。", en: "No Q3 per-region results for this model." },
  "detail-no-data": { zh: "当前选择下暂无模型数据。", en: "No model data for this selection." },
  "detail-no-option": { zh: "暂无可选病变。", en: "No available lesions." },
  "detail-current-selection": { zh: "当前选择", en: "Current selection" },
  "human-q1q3-missing": {
    zh: "当前数据集中未找到 Q1/Q3 人机对比结果。",
    en: "No Q1/Q3 human vs model results found in the dataset.",
  },
  "human-q2-missing": {
    zh: "当前数据集中未找到 Q2 人机对比结果。",
    en: "No Q2 human vs model results found in the dataset.",
  },
  "human-q4q5-missing": {
    zh: "当前数据集中未找到 Q4/Q5 Likert 人机对比结果。",
    en: "No Q4/Q5 Likert human vs model results found in the dataset.",
  },
  "metric.q1": { zh: "Macro‑F1", en: "Macro‑F1" },
  "metric.q2": { zh: "mIoU", en: "mIoU" },
  "metric.q3": { zh: "Macro‑F1", en: "Macro‑F1" },
};

let currentLang = "zh";
let currentStandards = {};
const listeners = [];

function applyTranslations() {
  Object.entries(UI_TEXTS).forEach(([id, texts]) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = texts[currentLang] || texts.zh || "";
    }
  });
  const toggle = document.getElementById("lang-toggle");
  if (toggle) {
    toggle.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.lang === currentLang);
    });
  }
}

export function t(key) {
  const table = MESSAGES[key] || UI_TEXTS[key];
  if (table) {
    return table[currentLang] || table.zh || key;
  }
  return key;
}

export function getLang() {
  return currentLang;
}

export function setLanguage(lang) {
  const next = lang === "en" ? "en" : "zh";
  if (next === currentLang) return;
  currentLang = next;
  applyTranslations();
  listeners.forEach((fn) => {
    try {
      fn(currentLang);
    } catch (e) {
      console.error("Language change listener failed", e);
    }
  });
}

export function onLanguageChange(fn) {
  if (typeof fn === "function") {
    listeners.push(fn);
  }
}

export function setStandards(standards) {
  currentStandards = standards || {};
}

export function getStandards() {
  return currentStandards || {};
}

export function initI18n(standards = {}) {
  currentStandards = standards || {};
  applyTranslations();
  const toggle = document.getElementById("lang-toggle");
  if (toggle) {
    toggle.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".lang-btn");
      if (!btn || !btn.dataset.lang) return;
      setLanguage(btn.dataset.lang);
    });
  }
}
