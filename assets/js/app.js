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
    if (statusEl) {
      statusEl.textContent = t("load.success");
    }
    setStandards(data.standards || {});
    initLeaderboard(data, { getLang, onLanguageChange, t, standards: data.standards || {} });
    initHumanVsModel(data.human_vs_model || {}, { getLang, onLanguageChange, t, standards: data.standards || {} });
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
