function safeNumber(value) {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

function formatFloat(value, digits = 3) {
  const v = safeNumber(value);
  if (v === null) return "–";
  return v.toFixed(digits);
}

/**
 * 根据参与者信息返回分组类别（用于色块和条形图颜色）
 * @returns 'closed' | 'medical-opensource' | 'opensource' | 'junior-endoscopist' | 'residency-trainee'
 */
function getParticipantCategory(name, isDoctor, type, standards) {
  if (isDoctor) {
    // 医生分组：根据 type 字段判断
    const typeStr = (type || "").toString().trim();
    if (
      typeStr === "初级内窥镜医师" ||
      typeStr === "Junior Endoscopists" ||
      typeStr === "高年资" ||
      typeStr.includes("初级") ||
      typeStr.includes("Junior")
    ) {
      return "junior-endoscopist";
    }
    return "residency-trainee";
  }
  // 模型分组：从 standards.model_categories 中查找
  const categories = standards?.model_categories || {};
  for (const [cat, models] of Object.entries(categories)) {
    if (Array.isArray(models) && models.includes(name)) {
      // 将 'medical_opensource' 转为 'medical-opensource'
      return cat.replace(/_/g, "-");
    }
  }
  return "opensource"; // 默认归类为开源
}

function normalizeDiseaseKey(name) {
  return (name || "")
    .toString()
    .replace(/^\s*\d+\.\s*/, "")
    .trim()
    .toLowerCase();
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

function buildOptionsFromData(hvmData) {
  const map = new Map();
  const add = (raw) => {
    const key = normalizeDiseaseKey(raw);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        key,
        disease_cn: raw,
        disease_en: raw,
      });
    }
  };

  const q1 = hvmData?.q1_q3_multiple_choice?.anatomical_location_disease_f1 || {};
  Object.keys(q1).forEach(add);
  const q3 = hvmData?.q1_q3_multiple_choice?.diagnosis_disease_f1 || {};
  Object.keys(q3).forEach(add);

  const participants = hvmData?.q2_spatial_localization?.participants || {};
  Object.values(participants).forEach((info) => {
    Object.keys(info?.metrics?.by_disease || {}).forEach((name) => add(name.replace(/^\s*\d+\.\s*/, "")));
  });

  return Array.from(map.values()).sort((a, b) => {
    return (a.disease_cn || a.disease_en || a.key || "").localeCompare(b.disease_cn || b.disease_en || b.key || "", "zh-CN");
  });
}

function formatOptionLabel(option, lang) {
  const disease = lang === "en" ? option.disease_en || option.disease_cn || option.key : option.disease_cn || option.disease_en || option.key;
  const location = lang === "en" ? option.location_en : option.location_cn;
  if (location) {
    return `${disease} (${location})`;
  }
  return disease;
}

function buildPhysicianChecker(standards) {
  const physicianIds = new Set(Object.values(standards?.physician_names_en || {}));
  const physicianIds2 = new Set(Object.keys(standards?.physician_en_to_cn || {}));
  return (name) => physicianIds.has(name) || physicianIds2.has(name);
}

function getDisplayName(name, lang, standards) {
  if (!name) return name;
  // 去掉名称中的 (Avg) 后缀
  return name.replace(/\(Avg\)$/i, "").trim();
}

function extractMacroValue(entry, candidates) {
  if (entry == null) return null;
  const numeric = safeNumber(entry);
  if (numeric !== null) return numeric;
  if (typeof entry !== "object") return null;

  for (const key of candidates || []) {
    const v = safeNumber(entry[key]);
    if (v !== null) return v;
  }

  const overall = safeNumber(entry.overall ?? entry["总体"] ?? entry["æ€»ä½“"] ?? entry.total ?? entry.mean);
  return overall;
}

function mean(arr) {
  if (!arr || !arr.length) return null;
  const s = arr.reduce((a, b) => a + b, 0);
  return s / arr.length;
}

function isGroupAverageName(name) {
  return typeof name === "string" && name.endsWith("(Avg)");
}

function clampToRange(value, min, max) {
  if (typeof value !== "number" || Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function normalizeLikertType(typeKey) {
  const key = (typeKey || "").toString().toLowerCase();
  if (
    key.includes("çœ‹å›¾è¯´è¯") ||
    key.includes("看图说话") ||
    key.includes("findings") ||
    key.includes("q4")
  ) {
    return "q4";
  }
  if (
    key.includes("åŽç»­å»ºè®®") ||
    key.includes("后续建议") ||
    key.includes("recommend") ||
    key.includes("q5")
  ) {
    return "q5";
  }
  return null;
}

function computeLikertScores(likertBlock) {
  const q4Scores = new Map();
  const q5Scores = new Map();

  Object.entries(likertBlock || {}).forEach(([typeKey, info]) => {
    const normalized = normalizeLikertType(typeKey);
    if (!normalized) return;
    const target = normalized === "q4" ? q4Scores : q5Scores;
    const stats = info?.basic_statistics || {};
    Object.entries(stats).forEach(([name, record]) => {
      const meanVal = safeNumber(record?.total_score?.mean);
      if (meanVal == null) return;
      const stdVal = safeNumber(record?.total_score?.std);
      const arr = target.get(name) || [];
      arr.push({ mean: meanVal, std: stdVal });
      target.set(name, arr);
    });
  });

  const aggregateScores = (sourceMap) => {
    const result = {};
    sourceMap.forEach((arr, name) => {
      const meanVals = arr.map((v) => v.mean).filter((v) => typeof v === "number" && !Number.isNaN(v));
      const stdVals = arr.map((v) => v.std).filter((v) => typeof v === "number" && !Number.isNaN(v));
      const m = mean(meanVals);
      const s = mean(stdVals);
      if (m != null) {
        result[name] = { mean: m, std: s ?? null };
      }
    });
    return result;
  };

  const q4Aggregates = aggregateScores(q4Scores);
  const q5Aggregates = aggregateScores(q5Scores);

  return { q4Aggregates, q5Aggregates };
}

function computeLikertDimensions(likertBlock, standards) {
  const q4Dims = {};
  const q5Dims = {};
  const likeDimsMeta = standards?.likert_dimensions || {};
  const seenDimKeys = new Set();

  // helper: 给一个维度记录，尝试按标准维度元数据匹配；若匹配不到，则按键顺序取前 5 个
  function extractDimValues(dimensions) {
    const result = { dimension1: null, dimension2: null, dimension3: null, dimension4: null, dimension5: null };
    const entries = Object.entries(dimensions || {});

    // 优先按标准维度名匹配（中英文）
    const norm = (s) => (s || "").toString().trim().toLowerCase();
    Object.entries(likeDimsMeta).forEach(([dimKey, meta]) => {
      const hit =
        entries.find(([k]) => norm(k) === norm(meta?.name_cn)) ||
        entries.find(([k]) => norm(k) === norm(meta?.name_en));
      if (hit) {
        const v = safeNumber(hit[1]?.mean ?? hit[1]);
        if (v != null) result[dimKey] = v;
        seenDimKeys.add(hit[0]);
      }
    });

    // 若仍有空缺，则按原始顺序补齐
    let idx = 1;
    entries.forEach(([_, val]) => {
      seenDimKeys.add(_);
      const targetKey = `dimension${idx}`;
      if (result[targetKey] == null && idx <= 5) {
        const v = safeNumber(val?.mean ?? val);
        if (v != null) {
          result[targetKey] = v;
        }
        idx += 1;
      }
    });

    return result;
  }

  Object.entries(likertBlock || {}).forEach(([typeKey, info]) => {
    const normalized = normalizeLikertType(typeKey);
    if (!normalized) return;
    const target = normalized === "q4" ? q4Dims : q5Dims;
    const stats = info?.basic_statistics || {};
    Object.entries(stats).forEach(([name, record]) => {
      const dimsRaw = record?.dimensions || {};
      const dimVals = extractDimValues(dimsRaw);
      const bucket = target[name] || { dimension1: [], dimension2: [], dimension3: [], dimension4: [], dimension5: [] };
      Object.entries(dimVals).forEach(([dimKey, v]) => {
        if (v != null) bucket[dimKey].push(v);
      });
      target[name] = bucket;
    });
  });

  function finalizeBuckets(src) {
    const out = {};
    Object.entries(src).forEach(([name, bucket]) => {
      out[name] = {};
      Object.entries(bucket).forEach(([dimKey, arr]) => {
        out[name][dimKey] = mean(arr);
      });
    });
    return out;
  }

  return {
    q4Dims: finalizeBuckets(q4Dims),
    q5Dims: finalizeBuckets(q5Dims),
  };
}

function computeParticipantRows(hvmData, standards, sortBy) {
  const mcBlock = hvmData?.q1_q3_multiple_choice || {};
  const macro = mcBlock.macro_avg_f1 || {};
  const spatialBlock = hvmData?.q2_spatial_localization || {};
  const participantsQ2 = spatialBlock.participants || {};
  const { q4Aggregates, q5Aggregates } = computeLikertScores(hvmData?.q4_q5_likert || {});

  const allNames = new Set([
    ...Object.keys(macro),
    ...Object.keys(participantsQ2),
    ...Object.keys(q4Aggregates),
    ...Object.keys(q5Aggregates),
  ]);
  if (!allNames.size) return [];

  const isDoctor = buildPhysicianChecker(standards);

  let rows = Array.from(allNames).map((name) => {
    const macroEntry = macro[name];
    const q1 = extractMacroValue(macroEntry, [
      "è§£å‰–å®šä½",
      "解剖定位",
      "anatomical_localization",
      "anatomical",
      "q1",
    ]);
    const q3 = extractMacroValue(macroEntry, ["è¯Šæ–­", "诊断", "diagnosis", "q3"]);
    const q2 = safeNumber(participantsQ2[name]?.metrics?.overall?.mean_iou);
    const q4 = safeNumber(q4Aggregates[name]?.mean);
    const q5 = safeNumber(q5Aggregates[name]?.mean);
    const type = participantsQ2[name]?.type || null;
    return { name, isDoctor: isDoctor(name), type, q1, q2, q3, q4, q5 };
  });

  // 页面规则：整体排名仅显示人类组均值（Avg），不显示单个医生参与者；模型不受影响
  rows = rows.filter((row) => {
    if (!row?.isDoctor) return true;
    return isGroupAverageName(row.name);
  });

  const key =
    sortBy === "q1" ||
    sortBy === "q2" ||
    sortBy === "q3" ||
    sortBy === "q4" ||
    sortBy === "q5"
      ? sortBy
      : "q1";
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
  let maxQ4 = null;
  let maxQ5 = null;
  rows.forEach((row) => {
    if (row.q1 !== null && (maxQ1 === null || row.q1 > maxQ1)) maxQ1 = row.q1;
    if (row.q2 !== null && (maxQ2 === null || row.q2 > maxQ2)) maxQ2 = row.q2;
    if (row.q3 !== null && (maxQ3 === null || row.q3 > maxQ3)) maxQ3 = row.q3;
    if (row.q4 !== null && (maxQ4 === null || row.q4 > maxQ4)) maxQ4 = row.q4;
    if (row.q5 !== null && (maxQ5 === null || row.q5 > maxQ5)) maxQ5 = row.q5;
  });
  return { maxQ1, maxQ2, maxQ3, maxQ4, maxQ5 };
}

function renderParticipantTable(tbody, rows, selectedName, t, columnMax, { lang, standards }) {
  tbody.innerHTML = "";
  rows.forEach((row, idx) => {
    const tr = document.createElement("tr");
    if (!selectedName && idx === 0) {
      tr.classList.add("is-selected");
    } else if (row.name === selectedName) {
      tr.classList.add("is-selected");
    }
    tr.dataset.participantName = row.name;

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
    const nameWrap = document.createElement("div");
    nameWrap.className = "tags";

    // 分组色块
    const categoryDot = document.createElement("span");
    const category = getParticipantCategory(row.name, row.isDoctor, row.type, standards);
    categoryDot.className = `category-dot category-dot--${category}`;
    nameWrap.appendChild(categoryDot);

    // 名称
    const nameText = document.createElement("span");
    nameText.textContent = getDisplayName(row.name, lang, standards);
    nameWrap.appendChild(nameText);

    // 医生样本量角标
    if (row.isDoctor) {
      const sampleSize = document.createElement("span");
      sampleSize.className = "sample-size";
      sampleSize.textContent = "(n=60)";
      nameWrap.appendChild(sampleSize);
    }

    // 身份标签（根据分类显示不同样式）
    const tag = document.createElement("span");
    tag.className = `tag tag--${category}`;
    tag.textContent = t(`legend.${category}`);
    nameWrap.appendChild(tag);

    nameCell.appendChild(nameWrap);
    tr.appendChild(nameCell);

    const { maxQ1, maxQ2, maxQ3, maxQ4, maxQ5 } = columnMax || {};
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

    const q4Cell = document.createElement("td");
    q4Cell.innerHTML = `<div class="metric-value${isMax(row.q4, maxQ4) ? " is-max" : ""}">${formatFloat(
      row.q4,
      2,
    )}</div><div class="metric-sub">${t("metric.q4")}</div>`;
    tr.appendChild(q4Cell);

    const q5Cell = document.createElement("td");
    q5Cell.innerHTML = `<div class="metric-value${isMax(row.q5, maxQ5) ? " is-max" : ""}">${formatFloat(
      row.q5,
      2,
    )}</div><div class="metric-sub">${t("metric.q5")}</div>`;
    tr.appendChild(q5Cell);

    tbody.appendChild(tr);
  });
}

function resolveParticipantTypeLabel(row, { standards, lang, t }) {
  const typeRaw = (row?.type || "").trim();
  const mapping = standards?.seniority_names_en || {};
  const aliases = {
    "低年资": "住院实习医师",
    "高年资": "初级内窥镜医师",
  };
  const keyCn = aliases[typeRaw] || typeRaw;
  if (mapping[keyCn]) {
    return lang === "en" ? mapping[keyCn] : keyCn;
  }
  if (typeRaw) return typeRaw;
  if (row?.isDoctor) return t("participant.doctor");
  return t("participant.model");
}

function findScoresByDisease(mapping, option) {
  const keySet = buildOptionKeySet(option);
  for (const [disease, scores] of Object.entries(mapping || {})) {
    if (keySet.has(normalizeDiseaseKey(disease))) {
      return scores;
    }
  }
  return null;
}

function collectHumanChartItems(hvmData, subtab, option, standards) {
  if (!option && (subtab === "q1" || subtab === "q2" || subtab === "q3")) return [];
  const items = [];
  const isPhysician = buildPhysicianChecker(standards);
  // 用于获取医生的 type 字段
  const participantsQ2 = hvmData?.q2_spatial_localization?.participants || {};

  if (subtab === "q1" || subtab === "q3") {
    const block = hvmData?.q1_q3_multiple_choice || {};
    const mapping = subtab === "q1" ? block.anatomical_location_disease_f1 : block.diagnosis_disease_f1;
    const scores = findScoresByDisease(mapping, option);
    // 从 Q1/Q3 数据中获取每个病变的样本量（每个病变固定3张）
    const perDiseaseSampleSize = 3;
    if (scores) {
      Object.entries(scores).forEach(([name, value]) => {
        const v = safeNumber(value?.value ?? value);
        const std = safeNumber(value?.std);
        if (v !== null) {
          const isDoctor = isPhysician(name);
          const type = participantsQ2[name]?.type || null;
          // 医生有样本量角标，模型没有
          const sampleSize = isDoctor ? perDiseaseSampleSize : null;
          items.push({ name, value: v, std, isDoctor, type, sampleSize });
        }
      });
    }
  } else if (subtab === "q2") {
    const participants = hvmData?.q2_spatial_localization?.participants || {};
    const targetKeys = buildOptionKeySet(option);
    Object.entries(participants).forEach(([name, info]) => {
      const diseases = info?.metrics?.by_disease || {};
      for (const [diseaseName, metrics] of Object.entries(diseases)) {
        if (targetKeys.has(normalizeDiseaseKey(diseaseName))) {
          const v = safeNumber(metrics?.mean_iou ?? metrics?.overall?.mean_iou ?? metrics?.meanIoU);
          const std = safeNumber(
            metrics?.std_error ??
              metrics?.overall_avg_iou_std_error ??
              metrics?.mean_iou_std_error ??
              metrics?.miou_std_error ??
              metrics?.std,
          );
          if (v !== null) {
            const isDoctor = isPhysician(name);
            const type = info?.type || null;
            // 从数据中获取每个病变的样本量
            const sampleSize = isDoctor ? (metrics?.total ?? 3) : null;
            items.push({ name, value: v, std, isDoctor, type, sampleSize });
          }
          break;
        }
      }
    });
  } else if (subtab === "q4" || subtab === "q5") {
    const diseaseMap =
      subtab === "q4"
        ? hvmData?.q4_q5_likert?.q4_per_disease
        : hvmData?.q4_q5_likert?.q5_per_disease;
    const scores = findScoresByDisease(diseaseMap, option);
    // Q4/Q5 每个病变固定3张
    const perDiseaseSampleSize = 3;
    if (scores) {
      Object.entries(scores).forEach(([name, value]) => {
        const v = safeNumber(value?.mean ?? value);
        const std = safeNumber(value?.std);
        if (v !== null) {
          const isDoctor = isPhysician(name);
          const type = participantsQ2[name]?.type || null;
          // 按病变细分时，医生使用每个病变的样本量
          const sampleSize = isDoctor ? (value?.sample_size ?? perDiseaseSampleSize) : null;
          items.push({ name, value: v, std, isDoctor, type, sampleSize });
        }
      });
    } else {
      const likertBlock = hvmData?.q4_q5_likert || {};
      const { q4Aggregates, q5Aggregates } = computeLikertScores(likertBlock);
      const aggregates = subtab === "q4" ? q4Aggregates : q5Aggregates;
      Object.entries(aggregates || {}).forEach(([name, record]) => {
        const val = safeNumber(record?.mean);
        const std = safeNumber(record?.std);
        if (val !== null) {
          const isDoctor = isPhysician(name);
          const type = participantsQ2[name]?.type || null;
          // 总体聚合时不显示样本量角标（在细分页使用）
          items.push({ name, value: val, std, isDoctor, type, sampleSize: null });
        }
      });
    }
  }
  // 页面规则：按病变 / 题型细分中隐藏人类组均值（Avg），保留单个医生参与者（模型不受影响）
  const filtered = items.filter((item) => !isGroupAverageName(item?.name));
  filtered.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  return filtered;
}

function renderBarChart(chartEl, items, t, maxValue = 1, { lang, standards } = {}) {
  chartEl.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "detail-empty";
    empty.textContent = t("detail-no-data");
    chartEl.appendChild(empty);
    return;
  }
  const clamp = (val) => {
    if (typeof val !== "number" || Number.isNaN(val)) return 0;
    if (maxValue <= 0) return Math.max(0, Math.min(val, 1));
    return Math.max(0, Math.min(val / maxValue, 1));
  };
  items.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "bar-row";

    // 标签：色块 + 名称 + 角标
    const label = document.createElement("div");
    label.className = "bar-label";

    const categoryDot = document.createElement("span");
    const category = getParticipantCategory(item.name, item.isDoctor, item.type, standards);
    categoryDot.className = `category-dot category-dot--${category}`;
    label.appendChild(categoryDot);

    const nameSpan = document.createElement("span");
    nameSpan.textContent = getDisplayName(item.name, lang, standards);
    label.appendChild(nameSpan);

    if (item.isDoctor && item.sampleSize != null) {
      const sampleSize = document.createElement("span");
      sampleSize.className = "sample-size";
      sampleSize.textContent = `(n=${item.sampleSize})`;
      label.appendChild(sampleSize);
    }

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    const clampedVal = clamp(item.value);
    fill.style.width = `${clampedVal * 100}%`;
    // 条形图颜色按分组区分
    fill.classList.add(`bar-fill--${category}`);
    if (idx === 0) {
      fill.classList.add("bar-fill--top");
    }
    track.appendChild(fill);

    // error bar if std exists
    if (item.std != null && !Number.isNaN(item.std)) {
      const errStart = clamp(item.value - item.std);
      const errEnd = clamp(item.value + item.std);
      const err = document.createElement("div");
      err.className = "bar-error";
      err.style.left = `${errStart * 100}%`;
      err.style.width = `${Math.max(0, errEnd - errStart) * 100}%`;
      const errLine = document.createElement("div");
      errLine.className = "bar-error__line";
      const capStart = document.createElement("div");
      capStart.className = "bar-error__cap bar-error__cap--start";
      const capEnd = document.createElement("div");
      capEnd.className = "bar-error__cap bar-error__cap--end";
      err.appendChild(errLine);
      err.appendChild(capStart);
      err.appendChild(capEnd);
      track.appendChild(err);
    }

    const valueEl = document.createElement("div");
    valueEl.className = "bar-value";
    if (item.std != null && !Number.isNaN(item.std)) {
      const digits = maxValue > 1 ? 2 : 3;
      valueEl.textContent = `${formatFloat(item.value, digits)} ± ${formatFloat(item.std, digits)}`;
    } else {
      valueEl.textContent = formatFloat(item.value);
    }

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(valueEl);
    chartEl.appendChild(row);
  });
}

/**
 * 渲染分组图例
 */
function renderCategoryLegend(containerEl, t) {
  if (!containerEl) return;
  containerEl.innerHTML = "";

  const legendItems = [
    { category: "closed", key: "legend.closed" },
    { category: "medical-opensource", key: "legend.medical-opensource" },
    { category: "opensource", key: "legend.opensource" },
    { category: "junior-endoscopist", key: "legend.junior-endoscopist" },
    { category: "residency-trainee", key: "legend.residency-trainee" },
  ];

  // 模型组标题
  const modelTitle = document.createElement("span");
  modelTitle.className = "category-legend-title";
  modelTitle.textContent = t("legend.models");
  containerEl.appendChild(modelTitle);

  // 模型分类图例
  legendItems.slice(0, 3).forEach(({ category, key }) => {
    const item = document.createElement("div");
    item.className = "category-legend-item";
    const dot = document.createElement("span");
    dot.className = `category-dot category-dot--${category}`;
    item.appendChild(dot);
    const label = document.createElement("span");
    label.textContent = t(key);
    item.appendChild(label);
    containerEl.appendChild(item);
  });

  // 分隔符
  const separator = document.createElement("span");
  separator.className = "category-legend-separator";
  separator.textContent = "|";
  containerEl.appendChild(separator);

  // 医生组标题
  const doctorTitle = document.createElement("span");
  doctorTitle.className = "category-legend-title";
  doctorTitle.textContent = t("legend.doctors");
  containerEl.appendChild(doctorTitle);

  // 医生分类图例
  legendItems.slice(3).forEach(({ category, key }) => {
    const item = document.createElement("div");
    item.className = "category-legend-item";
    const dot = document.createElement("span");
    dot.className = `category-dot category-dot--${category}`;
    item.appendChild(dot);
    const label = document.createElement("span");
    label.textContent = t(key);
    item.appendChild(label);
    containerEl.appendChild(item);
  });
}

function initHumanDetailCard(hvmData, standards, { t, getLang, onLanguageChange }) {
  const selectEl = document.getElementById("human-detail-select");
  const chartEl = document.getElementById("human-detail-chart");
  const tipEl = document.getElementById("human-detail-selected-tip");
  const subtabButtons = document.querySelectorAll(".hvm-subtab-btn");
  if (!selectEl || !chartEl || !subtabButtons.length) return;
  const controlsEl = selectEl.closest(".detail-controls");

  const standardOptions = buildDiseaseOptionsFromStandards(standards);
  const options = standardOptions.length ? standardOptions : buildOptionsFromData(hvmData);

  let currentTab = "q1";
  let currentOptionKey = options[0]?.key || null;

  function getCurrentOption() {
    return options.find((opt) => opt.key === currentOptionKey) || null;
  }

  function updateTip(option) {
    if (!tipEl) return;
    if (!option || currentTab === "q4" || currentTab === "q5") {
      tipEl.textContent = "";
      return;
    }
    tipEl.textContent = `${t("detail-current-selection")}：${formatOptionLabel(option, getLang())}`;
  }

  // patched updateTip: Q4/Q5 也按病变显示提示
  const updateTipPatched = (option) => {
    if (!tipEl) return;
    if (!option) {
      tipEl.textContent = "";
      return;
    }
    tipEl.textContent = `${t("detail-current-selection")}：${formatOptionLabel(option, getLang())}`;
  };
  updateTip = updateTipPatched;

  function renderChart() {
    const isLikert = currentTab === "q4" || currentTab === "q5";
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

    const items = collectHumanChartItems(hvmData, currentTab, option || null, standards);

    // 对于 Q1-Q3，仍然是按病变/区域条形图，无雷达图
    if (!isLikert) {
      renderBarChart(chartEl, items, t, 1, { lang: getLang(), standards });
      updateTip(option);
      selectEl.disabled = false;
      if (controlsEl) controlsEl.style.display = "";
      return;
    }

    // Q4/Q5：仅总分条形图
    selectEl.disabled = true;
    if (controlsEl) controlsEl.style.display = "none";
    renderBarChart(chartEl, items, t, 5, { lang: getLang(), standards });
    updateTip(null);

    // 当前主体：取条形图第一名（用户可通过排序/数据决定）

    // 简单策略：选出若干最高分参与者作为“最佳者”，类型区分可以后续细化
  }

  // patched renderChart: Q4/Q5 也按病变选择，Likert 0-5 量程
  const renderChartPatched = () => {
    const isLikert = currentTab === "q4" || currentTab === "q5";
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
    const items = collectHumanChartItems(hvmData, currentTab, option || null, standards);
    const maxValue = isLikert ? 5 : 1;
    renderBarChart(chartEl, items, t, maxValue, { lang: getLang(), standards });
    updateTip(option);
    selectEl.disabled = false;
    if (controlsEl) controlsEl.style.display = "";
  };
  renderChart = renderChartPatched;

  function renderOptions() {
    selectEl.innerHTML = "";
    if (!options.length) {
      currentOptionKey = null;
      renderChart();
      return;
    }
    options.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.key;
      o.textContent = formatOptionLabel(opt, getLang());
      selectEl.appendChild(o);
    });
    if (!options.some((opt) => opt.key === currentOptionKey)) {
      currentOptionKey = options[0].key;
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
      renderChart();
    });
  });

  selectEl.addEventListener("change", () => {
    currentOptionKey = selectEl.value;
    renderChart();
  });

  onLanguageChange(() => {
    renderOptions();
  });

  renderOptions();
}

export function initHumanVsModel(hvmData, options) {
  const tbody = document.getElementById("human-leaderboard-body");
  const sortSelect = document.getElementById("human-sort-select");
  if (!tbody || !sortSelect) return;

  const t = options?.t || ((key) => key);
  const standards = options?.standards || {};
  const onLanguageChange = options?.onLanguageChange || (() => {});
  const getLang = options?.getLang || (() => "zh");

  let sortBy = sortSelect.value || "q1";
  let rows = computeParticipantRows(hvmData, standards, sortBy);
  let selectedName = rows[0] ? rows[0].name : null;

  function refresh() {
    rows = computeParticipantRows(hvmData, standards, sortBy);
    if (!rows.length) {
      tbody.innerHTML = "";
      return;
    }
    if (!selectedName || !rows.some((r) => r.name === selectedName)) {
      selectedName = rows[0].name;
    }
    const columnMax = getColumnMax(rows);
    renderParticipantTable(tbody, rows, selectedName, t, columnMax, { lang: getLang(), standards });
  }

  sortSelect.addEventListener("change", () => {
    sortBy = sortSelect.value || "q1";
    refresh();
  });

  tbody.addEventListener("click", (ev) => {
    const tr = ev.target.closest("tr");
    if (!tr || !tr.dataset.participantName) return;
    selectedName = tr.dataset.participantName;
    refresh();
  });

  // 图例渲染
  const legendEl = document.getElementById("human-category-legend");
  function refreshLegend() {
    renderCategoryLegend(legendEl, t);
  }

  onLanguageChange(() => {
    refresh();
    refreshLegend();
  });

  refresh();
  refreshLegend();
  initHumanDetailCard(hvmData, standards, { t, getLang, onLanguageChange });
}
