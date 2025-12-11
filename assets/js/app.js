import { initLeaderboard } from "./leaderboard.js";
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

  // 评估主体固定为 3+1（3 名医生 + 1 LLM）
  setHeroStatValue("stat-eval-value", "3 + 1");

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
    initLeaderboard(data, { getLang, onLanguageChange, t, standards });
    initHumanVsModel(data.human_vs_model || {}, { getLang, onLanguageChange, t, standards });
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
