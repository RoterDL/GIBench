import { initHumanVsModel } from "./human_vs_model.js";
import { initI18n, t, setStandards, getLang, onLanguageChange } from "./i18n.js";

function initTabs() {
  const buttons = document.querySelectorAll(".tab-button");
  const panels = document.querySelectorAll(".tab-panel");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      buttons.forEach((b) => b.classList.remove("is-active"));
      panels.forEach((p) => p.classList.remove("is-active"));
      btn.classList.add("is-active");
      const target = document.getElementById(`tab-${tab}`);
      if (target) target.classList.add("is-active");
    });
  });
}

function setHeroStatValue(id, value, refKey) {
  const el = document.getElementById(id);
  if (!el) return;
  const valid = value !== undefined && value !== null && !(typeof value === "number" && Number.isNaN(value));
  if (valid) {
    el.textContent = value;
    el.removeAttribute("title");
  } else {
    el.textContent = "N/A";
    if (refKey) {
      el.title = `请在 assets/data/gibench_standards.json 填写 ${refKey}`;
    }
  }
}

function updateHeroStats(standards = {}) {
  const diseaseCategories = standards.disease_categories || {};
  const diseaseCount = Object.values(diseaseCategories).reduce((sum, diseases) => {
    return sum + Object.keys(diseases || {}).length;
  }, 0);
  setHeroStatValue("stat-disease-value", diseaseCount || null, "disease_categories");

  const modelCategories = standards.model_categories || {};
  const modelSet = new Set();
  Object.values(modelCategories).forEach((list) => {
    (list || []).forEach((name) => modelSet.add(name));
  });
  setHeroStatValue("stat-model-value", modelSet.size || null, "model_categories");

  // 评估主体固定为 1 LLM
  setHeroStatValue("stat-eval-value", "1");

  const datasetOverview = standards.dataset_overview || {};
  setHeroStatValue("stat-image-value", datasetOverview.image_question_count, "dataset_overview.image_question_count");
}

async function loadData() {
  const statusEl = document.getElementById("load-status");
  if (statusEl) {
    statusEl.textContent = t("load.loading");
  }
  try {
    const resp = await fetch("gibench_leaderboard.json", {
      cache: "no-cache",
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const data = await resp.json();
    let standards = data.standards || {};
    if (!standards.dataset_overview) {
      try {
        const stdResp = await fetch("assets/data/gibench_standards.json", { cache: "no-cache" });
        if (stdResp.ok) {
          const stdData = await stdResp.json();
          standards = { ...stdData, ...standards };
        }
      } catch (e) {
        console.warn("fallback standards fetch failed", e);
      }
    }
    if (statusEl) {
      statusEl.textContent = t("load.success");
    }
    setStandards(standards);
    updateHeroStats(standards);
    const humanVsModelData = adaptHumanVsModel(data.human_vs_model || {}, standards);
    initHumanVsModel(humanVsModelData, { getLang, onLanguageChange, t, standards });
  } catch (err) {
    console.error("加载 gibench_leaderboard.json 失败：", err);
    if (statusEl) {
      statusEl.textContent = t("load.error");
      statusEl.classList.add("status-error");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initI18n();
  const statusEl = document.getElementById("load-status");
  if (statusEl) {
    statusEl.textContent = t("load.waiting");
  }
  loadData();
});

function adaptHumanVsModel(raw = {}, standards = {}) {
  const num = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : null);
  const setMap = (map, disease, name, value) => {
    if (!disease || value == null) return;
    if (!map[disease]) map[disease] = {};
    map[disease][name] = value;
  };
  const avg = (arr) => {
    const vals = (arr || []).filter((v) => typeof v === "number" && !Number.isNaN(v));
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const diseasesByRegion = {
    esophagus: Object.keys(standards?.disease_categories?.Esophagus || {}),
    stomach: Object.keys(standards?.disease_categories?.Stomach || {}),
    colo: Object.keys(standards?.disease_categories?.Colorectum || {}),
  };

  const macroAvg = {};
  const anatomicalMap = {};
  const diagnosisMap = {};
  const participantsQ2 = {};

  const ensureMacro = (name) => {
    if (!macroAvg[name]) macroAvg[name] = {};
    return macroAvg[name];
  };

  Object.entries(raw.q1_anatomical_robustness?.models || {}).forEach(([name, info]) => {
    const entry = ensureMacro(name);
    const q1 = num(info?.overall?.f1_mean);
    if (q1 != null) entry.anatomical = q1;
    (info?.per_disease || []).forEach((d) => {
      const val = num(d.f1_score);
      const std = num(d.f1_std_error ?? d.std_error);
      if (val != null) {
        setMap(anatomicalMap, d.disease_cn || d.disease || d.disease_en, name, { value: val, std });
      }
    });
  });

  Object.entries(raw.q1_anatomical_robustness?.physicians || {}).forEach(([name, info]) => {
    const entry = ensureMacro(name);
    const q1 =
      num(info?.macro_avg_f1?.["解剖定位"]) ??
      num(info?.macro_avg_f1?.anatomical) ??
      num(info?.macro_avg_f1?.overall);
    if (q1 != null) entry.anatomical = q1;
    const stdMap = info?.per_disease_std_error || {};
    Object.entries(info?.per_disease_f1 || {}).forEach(([disease, score]) => {
      const val = num(score);
      const stdVal = num(stdMap[disease]);
      if (val != null) setMap(anatomicalMap, disease, name, { value: val, std: stdVal });
    });
  });

  Object.entries(raw.q3_diagnosis_regional_robustness?.models || {}).forEach(([name, info]) => {
    const entry = ensureMacro(name);
    const q3 = num(info?.overall?.f1_mean);
    if (q3 != null) entry.diagnosis = q3;
    (info?.regions || []).forEach((region) => {
      const diseaseList = diseasesByRegion[region.region_key] || [];
      (region?.per_disease || []).forEach((rec, idx) => {
        const diseaseName = diseaseList[idx] || rec.disease_cn || rec.disease_type || rec.disease_en;
        const val = num(rec.f1_score);
        const std = num(rec.f1_std_error ?? region?.f1_std_error);
        if (val != null) setMap(diagnosisMap, diseaseName, name, { value: val, std });
      });
    });
  });

  Object.entries(raw.q3_diagnosis_regional_robustness?.physicians || {}).forEach(([name, info]) => {
    const entry = ensureMacro(name);
    const q3 =
      num(info?.macro_avg_f1?.["诊断"]) ??
      num(info?.macro_avg_f1?.diagnosis) ??
      num(info?.macro_avg_f1?.overall);
    if (q3 != null) entry.diagnosis = q3;
    const stdMap = info?.per_disease_std_error || {};
    Object.entries(info?.per_disease_f1 || {}).forEach(([disease, score]) => {
      const val = num(score);
      const stdVal = num(stdMap[disease]);
      if (val != null) setMap(diagnosisMap, disease, name, { value: val, std: stdVal });
    });
  });

  Object.entries(raw.q2_spatial_localization?.models || {}).forEach(([name, info]) => {
    const participant = {
      type: info?.type || "AI模型",
      metrics: {
        overall: { mean_iou: num(info?.overall?.miou ?? info?.overall?.mean_iou ?? info?.overall?.meanIoU) },
        by_disease: {},
      },
    };
    (info?.per_disease || []).forEach((d) => {
      const diseaseName = d.disease_cn || d.disease_type || d.disease_en || d.disease;
      participant.metrics.by_disease[diseaseName] = {
        mean_iou: num(d.overall_avg_iou ?? d.mean_iou ?? d.miou),
        std: num(d.mean_iou_std_error ?? d.overall_avg_iou_std_error ?? d.std_error ?? d.miou_std_error),
      };
    });
    participantsQ2[name] = participant;
  });

  Object.entries(raw.q2_spatial_localization?.physicians || {}).forEach(([name, info]) => {
    const participant = {
      type: info?.type || "人类专家",
      metrics: {
        overall: { mean_iou: num(info?.overall?.mean_iou ?? info?.overall?.miou ?? info?.overall?.meanIoU) },
        by_disease: {},
      },
    };
    Object.entries(info?.by_disease || {}).forEach(([disease, metrics]) => {
      participant.metrics.by_disease[disease] = {
        mean_iou: num(metrics?.mean_iou ?? metrics?.miou ?? metrics?.overall_avg_iou),
        std: num(
          metrics?.mean_iou_std_error ??
            metrics?.std_error ??
            metrics?.miou_std_error ??
            metrics?.overall_avg_iou_std_error,
        ),
      };
    });
    participantsQ2[name] = participant;
  });

  function collectLikert(rawBlock, diseaseMap) {
    const agg = new Map();
    (rawBlock?.diseases || []).forEach((disease) => {
      const diseaseName = disease?.disease_cn || disease?.disease_en || disease?.disease;
      (disease?.participants || []).forEach((p) => {
        const name = p?.name;
        if (!name) return;
        const dims = p.dimensions || {};
        const dimMeans = [];
        const dimStds = [];
        const bucket = agg.get(name) || {
          totalMean: [],
          totalStd: [],
          dim: {
            dimension1: [],
            dimension2: [],
            dimension3: [],
            dimension4: [],
            dimension5: [],
          },
        };
        Object.values(dims).forEach((dim) => {
          const m = num(dim?.mean);
          const s = num(dim?.std);
          if (m != null) {
            dimMeans.push(m);
            const key = `dimension${dim?.order || 1}`;
            if (bucket.dim[key]) bucket.dim[key].push(m);
          }
          if (s != null) {
            dimStds.push(s);
          }
        });
        const meanVal = avg(dimMeans);
        const stdVal = avg(dimStds);
        if (meanVal != null) bucket.totalMean.push(meanVal);
        if (stdVal != null) bucket.totalStd.push(stdVal);
        agg.set(name, bucket);
        if (diseaseName && meanVal != null) {
          if (!diseaseMap[diseaseName]) diseaseMap[diseaseName] = {};
          diseaseMap[diseaseName][name] = { mean: meanVal, std: stdVal };
        }
      });
    });
    const stats = {};
    agg.forEach((bucket, name) => {
      stats[name] = {
        total_score: {
          mean: avg(bucket.totalMean),
          std: avg(bucket.totalStd),
        },
        dimensions: {},
      };
      Object.entries(bucket.dim).forEach(([dimKey, arr]) => {
        const v = avg(arr);
        if (v != null) stats[name].dimensions[dimKey] = v;
      });
    });
    return stats;
  }

  const q4DiseaseScores = {};
  const q5DiseaseScores = {};
  const q4Stats = collectLikert(raw.q4_findings_likert || {}, q4DiseaseScores);
  const q5Stats = collectLikert(raw.q5_recommendations_likert || {}, q5DiseaseScores);

  return {
    q1_q3_multiple_choice: {
      macro_avg_f1: macroAvg,
      anatomical_location_disease_f1: anatomicalMap,
      diagnosis_disease_f1: diagnosisMap,
    },
    q2_spatial_localization: { participants: participantsQ2 },
    q4_q5_likert: {
      q4: { basic_statistics: q4Stats },
      q5: { basic_statistics: q5Stats },
      q4_per_disease: q4DiseaseScores,
      q5_per_disease: q5DiseaseScores,
    },
  };
}
