function safeNumber(value) {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

function formatFloat(value, digits = 3) {
  const v = safeNumber(value);
  if (v === null) return "–";
  return v.toFixed(digits);
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

  const rows = Array.from(allNames).map((name) => {
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

function renderParticipantTable(tbody, rows, selectedName, t, columnMax) {
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
    const nameText = document.createElement("span");
    nameText.textContent = row.name;
    nameWrap.appendChild(nameText);
    const tag = document.createElement("span");
    tag.className = row.isDoctor ? "tag tag--primary" : "tag";
    tag.textContent = row.isDoctor ? t("participant.doctor") : t("participant.model");
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

function renderParticipantSummary(row, t, { standards, lang }) {
  const nameEl = document.getElementById("human-summary-name");
  const metricsEl = document.getElementById("human-summary-metrics");
  if (!nameEl || !metricsEl) return;

  if (!row) {
    nameEl.textContent = t("no-participant-selected");
    metricsEl.innerHTML = "";
    return;
  }

  const typeLabel = resolveParticipantTypeLabel(row, { standards, lang, t });
  nameEl.textContent = `${row.name} · ${typeLabel}`;
  metricsEl.innerHTML = "";

  const items = [
    { label: "Q1 Macro-F1", value: row.q1, digits: 3 },
    { label: "Q2 mIoU", value: row.q2, digits: 3 },
    { label: "Q3 Macro-F1", value: row.q3, digits: 3 },
    { label: "Q4 Likert", value: row.q4, digits: 2 },
    { label: "Q5 Likert", value: row.q5, digits: 2 },
  ];

  items.forEach(({ label, value, digits }) => {
    const rowEl = document.createElement("div");
    const spanLabel = document.createElement("span");
    spanLabel.textContent = `${label}：`;
    const spanVal = document.createElement("span");
    spanVal.className = "value";
    spanVal.textContent = formatFloat(value, digits);
    rowEl.appendChild(spanLabel);
    rowEl.appendChild(spanVal);
    metricsEl.appendChild(rowEl);
  });
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

function collectHumanChartItems(hvmData, subtab, option) {
  if (!option && (subtab === "q1" || subtab === "q2" || subtab === "q3")) return [];
  const items = [];
  if (subtab === "q1" || subtab === "q3") {
    const block = hvmData?.q1_q3_multiple_choice || {};
    const mapping = subtab === "q1" ? block.anatomical_location_disease_f1 : block.diagnosis_disease_f1;
    const scores = findScoresByDisease(mapping, option);
    if (scores) {
      Object.entries(scores).forEach(([name, value]) => {
        const v = safeNumber(value);
        if (v !== null) {
          items.push({ name, value: v });
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
          if (v !== null) {
            items.push({ name, value: v });
          }
          break;
        }
      }
    });
  } else if (subtab === "q4" || subtab === "q5") {
    const likertBlock = hvmData?.q4_q5_likert || {};
    const { q4Aggregates, q5Aggregates } = computeLikertScores(likertBlock);
    const aggregates = subtab === "q4" ? q4Aggregates : q5Aggregates;
    Object.entries(aggregates || {}).forEach(([name, record]) => {
      const val = safeNumber(record?.mean);
      if (val !== null) {
        const std = safeNumber(record?.std);
        items.push({ name, value: val, std: std ?? null });
      }
    });
  }
  items.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  return items;
}

function renderBarChart(chartEl, items, t, maxValue = 1) {
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

    const label = document.createElement("div");
    label.className = "bar-label";
    label.textContent = item.name;

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    const clampedVal = clamp(item.value);
    fill.style.width = `${clampedVal * 100}%`;
    if (idx === 0) {
      fill.classList.add("bar-fill--primary", "bar-fill--top");
    } else {
      fill.classList.add("bar-fill--muted");
    }
    track.appendChild(fill);

    const hasStd = typeof item.std === "number" && !Number.isNaN(item.std);
    const stdVal = hasStd ? Math.max(0, item.std) : null;
    if (stdVal && stdVal > 0) {
      const low = clamp(item.value - stdVal);
      const high = clamp(item.value + stdVal);
      const start = Math.min(low, high);
      const end = Math.max(low, high);
      const widthPct = Math.max((end - start) * 100, 2);
      const error = document.createElement("div");
      error.className = "bar-error";
      error.style.left = `${start * 100}%`;
      error.style.width = `${widthPct}%`;
      const line = document.createElement("div");
      line.className = "bar-error__line";
      const capStart = document.createElement("div");
      capStart.className = "bar-error__cap bar-error__cap--start";
      const capEnd = document.createElement("div");
      capEnd.className = "bar-error__cap bar-error__cap--end";
      error.appendChild(line);
      error.appendChild(capStart);
      error.appendChild(capEnd);
      track.appendChild(error);
    }

    const valueEl = document.createElement("div");
    valueEl.className = "bar-value";
    valueEl.textContent = hasStd && stdVal != null ? `${formatFloat(item.value)} ± ${formatFloat(stdVal)}` : formatFloat(item.value);

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(valueEl);
    chartEl.appendChild(row);
  });
}

function renderLikertRadar(radarEl, dims, standards, selectedName, bestNames, isQ4, t, lang) {
  radarEl.innerHTML = "";
  if (!dims || (!selectedName && (!bestNames || !bestNames.length))) {
    const empty = document.createElement("div");
    empty.className = "detail-empty";
    empty.textContent = t("human-q4q5-missing");
    radarEl.appendChild(empty);
    return;
  }

  const likertMeta = standards?.likert_dimensions || {};
  let dimensionKeys = Object.keys(likertMeta).sort((a, b) => (likertMeta[a]?.order || 0) - (likertMeta[b]?.order || 0));
  if (!dimensionKeys.length) {
    // fallback: 从维度数据里取键名
    const firstEntry = Object.values(dims || {})[0] || {};
    dimensionKeys = Object.keys(firstEntry);
  }
  if (!dimensionKeys.length) {
    radarEl.innerHTML = "";
    return;
  }

  const series = [];
  const addSeries = (name, label, cls) => {
    const src = dims[name];
    if (!src) return;
    const values = dimensionKeys.map((key) => {
      const v = safeNumber(src[key]);
      // Likert 1-5 范围
      return clampToRange(v ?? 0, 0, 5);
    });
    series.push({ name, label, cls, values });
  };

  if (selectedName) {
    addSeries(selectedName, `${selectedName}`, "radar-line--primary");
  }

  (bestNames || []).forEach((info) => {
    if (!info || !info.name) return;
    addSeries(info.name, info.label || info.name, info.cls || "radar-line--muted");
  });

  if (!series.length) {
    const empty = document.createElement("div");
    empty.className = "detail-empty";
    empty.textContent = t("human-q4q5-missing");
    radarEl.appendChild(empty);
    return;
  }

  const title = document.createElement("div");
  title.className = "radar-title";
  title.textContent = isQ4 ? t("hvm-q4q5-title") : t("hvm-q4q5-title");
  radarEl.appendChild(title);

  // SVG 雷达图
  const w = 420;
  const h = 320;
  const cx = w / 2;
  const cy = h / 2 + 10;
  const radius = Math.min(w, h) / 2 - 50;
  const step = (Math.PI * 2) / dimensionKeys.length;

  const axisLabels = dimensionKeys.map((key) => (lang === "en" ? likertMeta[key]?.name_en || likertMeta[key]?.name_cn || key : likertMeta[key]?.name_cn || likertMeta[key]?.name_en || key));

  const gridLevels = [1, 0.75, 0.5, 0.25];

  const ptsForValue = (val, idx) => {
    const ang = -Math.PI / 2 + idx * step;
    const r = (clampToRange(val, 0, 5) / 5) * radius;
    return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
  };

  const polygonPath = (values) => {
    const pts = values.map((v, idx) => ptsForValue(v, idx));
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ") + " Z";
  };

  const axisLines = dimensionKeys
    .map((_, idx) => {
      const [x, y] = ptsForValue(5, idx);
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="radar-axis-line" />`;
    })
    .join("");

  const gridPolygons = gridLevels
    .map((level) => {
      const vals = dimensionKeys.map(() => level * 5);
      return `<path d="${polygonPath(vals)}" class="radar-gridline" />`;
    })
    .join("");

  const seriesPaths = series
    .map((s, idx) => {
      const cls = idx === 0 ? "radar-polygon--primary" : "radar-polygon--muted";
      return `<path d="${polygonPath(s.values)}" class="radar-polygon ${cls}" />`;
    })
    .join("");

  const dots = series
    .map((s, sidx) =>
      s.values
        .map((v, idx) => {
          const [x, y] = ptsForValue(v, idx);
          const cls = sidx === 0 ? "radar-dot--primary" : "radar-dot--muted";
          return `<circle cx="${x}" cy="${y}" r="3" class="radar-dot ${cls}" />`;
        })
        .join(""),
    )
    .join("");

  const axisText = axisLabels
    .map((label, idx) => {
      const [x, y] = ptsForValue(5.4, idx);
      return `<text x="${x}" y="${y}" class="radar-axis-label">${label}</text>`;
    })
    .join("");

  const svg = `
    <svg class="radar-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${isQ4 ? "Q4" : "Q5"} Likert radar">
      <g>${gridPolygons}</g>
      <g>${axisLines}</g>
      <g>${seriesPaths}</g>
      <g>${dots}</g>
      <g>${axisText}</g>
    </svg>
  `;

  radarEl.innerHTML = svg;
}

function initHumanDetailCard(hvmData, standards, { t, getLang, onLanguageChange }) {
  const selectEl = document.getElementById("human-detail-select");
  const chartEl = document.getElementById("human-detail-chart");
  const tipEl = document.getElementById("human-detail-selected-tip");
  const radarEl = document.getElementById("human-detail-radar");
  const subtabButtons = document.querySelectorAll(".hvm-subtab-btn");
  if (!selectEl || !chartEl || !radarEl || !subtabButtons.length) return;
  const controlsEl = selectEl.closest(".detail-controls");

  const standardOptions = buildDiseaseOptionsFromStandards(standards);
  const options = standardOptions.length ? standardOptions : buildOptionsFromData(hvmData);

  let currentTab = "q1";
  let currentLang = getLang();
  let currentOptionKey = options[0]?.key || null;

  const likertBlock = hvmData?.q4_q5_likert || {};
  const { q4Dims, q5Dims } = computeLikertDimensions(likertBlock, standards);

  function getCurrentOption() {
    return options.find((opt) => opt.key === currentOptionKey) || null;
  }

  function updateTip(option) {
    if (!tipEl) return;
    if (!option || currentTab === "q4" || currentTab === "q5") {
      tipEl.textContent = "";
      return;
    }
    tipEl.textContent = `${t("detail-current-selection")}：${formatOptionLabel(option, currentLang)}`;
  }

  function renderChart() {
    const isLikert = currentTab === "q4" || currentTab === "q5";
    const option = getCurrentOption();
    if (!isLikert && !option) {
      chartEl.innerHTML = "";
      const empty = document.createElement("div");
      empty.className = "detail-empty";
      empty.textContent = t("detail-no-option");
      chartEl.appendChild(empty);
      updateTip(null);
      if (radarEl) radarEl.innerHTML = "";
      return;
    }

    const items = collectHumanChartItems(hvmData, currentTab, option || null);

    // 对于 Q1-Q3，仍然是按病变/区域条形图，无雷达图
    if (!isLikert) {
      renderBarChart(chartEl, items, t);
      updateTip(option);
      if (radarEl) radarEl.innerHTML = "";
      selectEl.disabled = false;
      if (controlsEl) controlsEl.style.display = "";
      return;
    }

    // Q4/Q5：总分条形图 + 雷达图
    selectEl.disabled = true;
    if (controlsEl) controlsEl.style.display = "none";
    renderBarChart(chartEl, items, t, 5);
    updateTip(null);

    const dims = currentTab === "q4" ? q4Dims : q5Dims;
    // 当前主体：取条形图第一名（用户可通过排序/数据决定）
    const selectedRowName = items.length ? items[0].name : null;

    // 简单策略：选出若干最高分参与者作为“最佳者”，类型区分可以后续细化
    const topCandidates = items.slice(0, 5);
    const bestNames = topCandidates.map((it, idx) => ({
      name: it.name,
      label: it.name,
      cls: idx === 0 ? "radar-line--primary" : "radar-line--muted",
    }));

    renderLikertRadar(radarEl, dims, standards, selectedRowName, bestNames, currentTab === "q4", t, currentLang);
  }

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
      o.textContent = formatOptionLabel(opt, currentLang);
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
    currentLang = getLang();
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
      renderParticipantSummary(null, t, { standards, lang: getLang() });
      return;
    }
    if (!selectedName || !rows.some((r) => r.name === selectedName)) {
      selectedName = rows[0].name;
    }
    const columnMax = getColumnMax(rows);
    renderParticipantTable(tbody, rows, selectedName, t, columnMax);
    renderParticipantSummary(rows.find((r) => r.name === selectedName) || null, t, {
      standards,
      lang: getLang(),
    });
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

  onLanguageChange(() => refresh());
  refresh();
  initHumanDetailCard(hvmData, standards, { t, getLang, onLanguageChange });
}
