function safeNumber(value) {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

function formatFloat(value, digits = 3) {
  const v = safeNumber(value);
  if (v === null) return "–";
  return v.toFixed(digits);
}

function displayDiseaseName(item, lang) {
  if (!item) return lang === "en" ? "Unknown" : "未知病变";
  if (lang === "en") {
    return item.disease_en || item.disease || item.disease_type || "Unknown";
  }
  return item.disease_cn || item.disease || item.disease_type || "未知病变";
}

function displayRegionName(region, lang) {
  if (!region) return lang === "en" ? "Unknown region" : "未知区域";
  if (lang === "en") return region.region_name_en || region.region_name || region.region_key || "Region";
  return region.region_name_cn || region.region_name || region.region_key || "区域";
}

function normalizeDiseaseKey(name) {
  return (name || "").toString().trim().toLowerCase();
}

function buildOptionKeySet(option) {
  const keys = new Set();
  [option?.key, option?.disease_cn, option?.disease_en, ...(option?.aliases || [])].forEach((k) => {
    const norm = normalizeDiseaseKey(k);
    if (norm) keys.add(norm);
  });
  return keys;
}

function buildDiseaseOptionsFromStandards(standards) {
  const categories = standards?.disease_categories;
  if (!categories) return [];
  const nameMap = standards?.disease_name_map || {};
  const opts = [];
  Object.entries(categories).forEach(([regionEn, diseases]) => {
    Object.entries(diseases || {}).forEach(([cn, en]) => {
      const meta = nameMap[cn] || {};
      const disease_cn = meta.name_cn || cn;
      const disease_en = meta.name_en || en;
      opts.push({
        key: normalizeDiseaseKey(cn || en || disease_en || disease_cn),
        disease_cn,
        disease_en,
        location_cn: meta.location_cn || regionEn,
        location_en: meta.location_en || regionEn,
        aliases: [cn, en, disease_cn, disease_en].filter(Boolean),
      });
    });
  });
  return opts;
}

function buildQ1Options(models) {
  const map = new Map();
  Object.values(models || {}).forEach((record) => {
    const list = record?.tasks?.q1_anatomical_robustness?.per_disease || [];
    list.forEach((d) => {
      const key = normalizeDiseaseKey(d.disease_cn || d.disease || d.disease_type || d.disease_en);
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          key,
          disease_cn: d.disease_cn || d.disease || d.disease_type,
          disease_en: d.disease_en,
          location_cn: d.location_cn,
          location_en: d.location_en,
        });
      }
    });
  });
  return Array.from(map.values()).sort((a, b) => {
    const locCmp = (a.location_cn || "").localeCompare(b.location_cn || "", "zh-CN");
    if (locCmp !== 0) return locCmp;
    return (a.disease_cn || "").localeCompare(b.disease_cn || "", "zh-CN");
  });
}

function buildQ2Options(models) {
  const map = new Map();
  Object.values(models || {}).forEach((record) => {
    const list = record?.tasks?.q2_spatial_localization?.per_disease || [];
    list.forEach((d) => {
      const key = normalizeDiseaseKey(d.disease_cn || d.disease_type || d.disease || d.disease_en);
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          key,
          disease_cn: d.disease_cn || d.disease_type || d.disease,
          disease_en: d.disease_en,
          location_cn: d.location_cn,
          location_en: d.location_en,
        });
      }
    });
  });
  return Array.from(map.values()).sort((a, b) => {
    const locCmp = (a.location_cn || "").localeCompare(b.location_cn || "", "zh-CN");
    if (locCmp !== 0) return locCmp;
    return (a.disease_cn || "").localeCompare(b.disease_cn || "", "zh-CN");
  });
}

function buildQ3Options(standards) {
  const categories = standards?.disease_categories || {};
  const regionMap = {
    esophagus: "Esophagus",
    stomach: "Stomach",
    colo: "Colorectum",
  };
  const regionCn = {
    Esophagus: "食管",
    Stomach: "胃",
    Colorectum: "结直肠",
  };
  const opts = [];
  Object.entries(regionMap).forEach(([regionKey, stdName]) => {
    const diseases = categories[stdName] || {};
    let idx = 1;
    Object.entries(diseases).forEach(([cn, en]) => {
      opts.push({
        key: `${regionKey}__${idx}`,
        region_key: regionKey,
        disease_index: idx,
        disease_cn: cn,
        disease_en: en,
        location_cn: regionCn[stdName] || stdName,
        location_en: stdName,
      });
      idx += 1;
    });
  });
  return opts;
}

function formatOptionLabel(option, lang) {
  const disease = lang === "en" ? option.disease_en || option.disease_cn || option.key : option.disease_cn || option.disease_en || option.key;
  const location = lang === "en" ? option.location_en : option.location_cn;
  if (location) {
    return `${disease} (${location})`;
  }
  return disease;
}

function collectChartItems(subtab, option, models) {
  if (!option) return [];
  const optionKeys = buildOptionKeySet(option);
  const items = [];
  Object.entries(models || {}).forEach(([modelName, record]) => {
    let value = null;
    if (subtab === "q1") {
      const list = record?.tasks?.q1_anatomical_robustness?.per_disease || [];
      const found = list.find((d) => optionKeys.has(normalizeDiseaseKey(d.disease_cn || d.disease || d.disease_type || d.disease_en)));
      value = safeNumber(found?.f1_score);
    } else if (subtab === "q2") {
      const list = record?.tasks?.q2_spatial_localization?.per_disease || [];
      const found = list.find((d) => optionKeys.has(normalizeDiseaseKey(d.disease_cn || d.disease_type || d.disease || d.disease_en)));
      value = safeNumber(found?.overall_avg_iou);
    } else if (subtab === "q3") {
      const regions = record?.tasks?.q3_diagnosis_regional_robustness?.regions || [];
      const region = regions.find((r) => r.region_key === option.region_key);
      if (region && Array.isArray(region.per_disease)) {
        const idx = option.disease_index - 1;
        const entry = region.per_disease[idx];
        value = safeNumber(entry?.f1_score);
      }
    }
    if (value !== null) {
      items.push({ model: modelName, value });
    }
  });
  items.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  return items;
}

function renderBarChart(chartEl, items, t) {
  chartEl.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "detail-empty";
    empty.textContent = t("detail-no-data");
    chartEl.appendChild(empty);
    return;
  }
  const clamp01 = (val) => {
    if (typeof val !== "number" || Number.isNaN(val)) return 0;
    return Math.max(0, Math.min(val, 1));
  };
  items.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "bar-row";

    const label = document.createElement("div");
    label.className = "bar-label";
    label.textContent = item.model;

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${clamp01(item.value) * 100}%`;
    if (idx === 0) {
      fill.classList.add("bar-fill--primary", "bar-fill--top");
    } else {
      fill.classList.add("bar-fill--muted");
    }
    track.appendChild(fill);

    const valueEl = document.createElement("div");
    valueEl.className = "bar-value";
    valueEl.textContent = formatFloat(item.value);

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(valueEl);
    chartEl.appendChild(row);
  });
}

function initDetailCard(models, standards, { t, getLang, onLanguageChange }) {
  const selectEl = document.getElementById("detail-select");
  const chartEl = document.getElementById("detail-chart");
  const tipEl = document.getElementById("detail-selected-tip");
  const subtabButtons = document.querySelectorAll(".subtab-btn");
  if (!selectEl || !chartEl || !subtabButtons.length) return;

  const optionsByTab = {
    q1: [],
    q2: [],
    q3: buildQ3Options(standards),
  };
  const standardDiseaseOptions = buildDiseaseOptionsFromStandards(standards);
  if (standardDiseaseOptions.length) {
    optionsByTab.q1 = standardDiseaseOptions;
    optionsByTab.q2 = standardDiseaseOptions;
  } else {
    optionsByTab.q1 = buildQ1Options(models);
    optionsByTab.q2 = buildQ2Options(models);
  }

  let currentTab = "q1";
  let currentLang = getLang();
  let currentOptionKey = optionsByTab[currentTab][0]?.key || null;

  function getOptions() {
    return optionsByTab[currentTab] || [];
  }

  function getCurrentOption() {
    return getOptions().find((opt) => opt.key === currentOptionKey) || null;
  }

  function updateTip(option) {
    if (!tipEl) return;
    if (!option) {
      tipEl.textContent = "";
      return;
    }
    tipEl.textContent = `${t("detail-current-selection")}：${formatOptionLabel(option, currentLang)}`;
  }

  function renderChart() {
    const option = getCurrentOption();
    if (!option) {
      chartEl.innerHTML = "";
      const empty = document.createElement("div");
      empty.className = "detail-empty";
      empty.textContent = t("detail-no-option");
      chartEl.appendChild(empty);
      updateTip(null);
      return;
    }
    const items = collectChartItems(currentTab, option, models);
    renderBarChart(chartEl, items, t);
    updateTip(option);
  }

  function renderOptions() {
    const opts = getOptions();
    selectEl.innerHTML = "";
    if (!opts.length) {
      currentOptionKey = null;
      renderChart();
      return;
    }
    opts.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.key;
      o.textContent = formatOptionLabel(opt, currentLang);
      selectEl.appendChild(o);
    });
    if (!opts.some((opt) => opt.key === currentOptionKey)) {
      currentOptionKey = opts[0].key;
    }
    selectEl.value = currentOptionKey;
    renderChart();
  }

  subtabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-subtab");
      if (!tab) return;
      currentTab = tab;
      subtabButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
      currentOptionKey = optionsByTab[currentTab][0]?.key || null;
      renderOptions();
    });
  });

  selectEl.addEventListener("change", () => {
    currentOptionKey = selectEl.value;
    renderChart();
  });

  onLanguageChange((lang) => {
    currentLang = lang;
    renderOptions();
  });

  renderOptions();
}

function computeModelRows(models, sortBy) {
  const entries = Object.entries(models || {});
  const rows = entries.map(([name, record]) => {
    const summary = record.summary || {};
    const q1 = safeNumber(summary.q1_anatomical_f1_mean);
    const q2 = safeNumber(summary.q2_spatial_miou);
    const q3 = safeNumber(summary.q3_diagnosis_f1_mean);
    return { name, record, q1, q2, q3 };
  });

  const key = sortBy === "q1" || sortBy === "q2" || sortBy === "q3" ? sortBy : "q1";

  rows.sort((a, b) => {
    const va = a[key] ?? -1;
    const vb = b[key] ?? -1;
    return vb - va;
  });

  return rows;
}

function getColumnMax(rows) {
  let maxQ1 = null;
  let maxQ2 = null;
  let maxQ3 = null;
  rows.forEach((row) => {
    if (row.q1 !== null && (maxQ1 === null || row.q1 > maxQ1)) maxQ1 = row.q1;
    if (row.q2 !== null && (maxQ2 === null || row.q2 > maxQ2)) maxQ2 = row.q2;
    if (row.q3 !== null && (maxQ3 === null || row.q3 > maxQ3)) maxQ3 = row.q3;
  });
  return { maxQ1, maxQ2, maxQ3 };
}

function renderModelTable(tbody, rows, selectedName, t, columnMax) {
  tbody.innerHTML = "";
  rows.forEach((row, idx) => {
    const tr = document.createElement("tr");
    if (!selectedName && idx === 0) {
      tr.classList.add("is-selected");
    } else if (row.name === selectedName) {
      tr.classList.add("is-selected");
    }
    tr.dataset.modelName = row.name;

    const rankCell = document.createElement("td");
    const rankWrap = document.createElement("div");
    rankWrap.className = "rank-cell";
    if (idx === 0) {
      const pill = document.createElement("span");
      pill.className = "rank-pill";
      pill.textContent = "1";
      rankWrap.appendChild(pill);
    } else {
      rankWrap.textContent = String(idx + 1);
    }
    rankCell.appendChild(rankWrap);
    tr.appendChild(rankCell);

    const nameCell = document.createElement("td");
    nameCell.textContent = row.name;
    tr.appendChild(nameCell);

    const { maxQ1, maxQ2, maxQ3 } = columnMax || {};
    const isMax = (val, maxVal) => maxVal !== null && val !== null && val === maxVal;

    const q1Cell = document.createElement("td");
    q1Cell.innerHTML = `<div class="metric-value${isMax(row.q1, maxQ1) ? " is-max" : ""}">${formatFloat(row.q1)}</div><div class="metric-sub">${t("metric.q1")}</div>`;
    tr.appendChild(q1Cell);

    const q2Cell = document.createElement("td");
    q2Cell.innerHTML = `<div class="metric-value${isMax(row.q2, maxQ2) ? " is-max" : ""}">${formatFloat(row.q2)}</div><div class="metric-sub">${t("metric.q2")}</div>`;
    tr.appendChild(q2Cell);

    const q3Cell = document.createElement("td");
    q3Cell.innerHTML = `<div class="metric-value${isMax(row.q3, maxQ3) ? " is-max" : ""}">${formatFloat(row.q3)}</div><div class="metric-sub">${t("metric.q3")}</div>`;
    tr.appendChild(q3Cell);

    tbody.appendChild(tr);
  });
}

function renderSummary(record, t) {
  const nameEl = document.getElementById("model-summary-name");
  const metricsEl = document.getElementById("model-summary-metrics");
  if (!nameEl || !metricsEl) return;

  if (!record) {
    nameEl.textContent = t("no-model-selected");
    metricsEl.innerHTML = "";
    return;
  }

  nameEl.textContent = record.model_name || t("no-model-selected");
  const s = record.summary || {};
  metricsEl.innerHTML = "";

  const items = [
    ["Q1 Macro-F1", safeNumber(s.q1_anatomical_f1_mean)],
    ["Q2 mIoU", safeNumber(s.q2_spatial_miou)],
    ["Q3 Macro-F1", safeNumber(s.q3_diagnosis_f1_mean)],
  ];

  items.forEach(([label, value]) => {
    const row = document.createElement("div");
    const spanLabel = document.createElement("span");
    spanLabel.textContent = `${label}：`;
    const spanVal = document.createElement("span");
    spanVal.className = "value";
    spanVal.textContent = formatFloat(value);
    row.appendChild(spanLabel);
    row.appendChild(spanVal);
    metricsEl.appendChild(row);
  });
}

export function initLeaderboard(rootData, options) {
  const models = rootData.models || {};
  const tbody = document.getElementById("leaderboard-body");
  const sortSelect = document.getElementById("sort-select");
  if (!tbody || !sortSelect) return;

  const t = options?.t || ((key) => key);
  const standards = options?.standards || {};
  const getLang = options?.getLang || (() => "zh");
  const onLanguageChange = options?.onLanguageChange || (() => {});

  initDetailCard(models, standards, { t, getLang, onLanguageChange });

  let currentLang = getLang();
  let sortBy = sortSelect.value || "q1";
  let rows = computeModelRows(models, sortBy);
  let selectedName = rows[0] ? rows[0].name : null;

  function refresh() {
    rows = computeModelRows(models, sortBy);
    if (!rows.length) {
      tbody.innerHTML = "";
      renderSummary(null, t, currentLang);
      return;
    }
    if (!selectedName || !models[selectedName]) {
      selectedName = rows[0].name;
    }
    const columnMax = getColumnMax(rows);
    renderModelTable(tbody, rows, selectedName, t, columnMax);
    renderSummary(models[selectedName], t, currentLang);
  }

  sortSelect.addEventListener("change", () => {
    sortBy = sortSelect.value || "q1";
    refresh();
  });

  tbody.addEventListener("click", (ev) => {
    const tr = ev.target.closest("tr");
    if (!tr || !tr.dataset.modelName) return;
    selectedName = tr.dataset.modelName;
    refresh();
  });

  onLanguageChange((lang) => {
    currentLang = lang;
    refresh();
  });

  refresh();
}
