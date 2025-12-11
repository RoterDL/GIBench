function safeNumber(value) {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

function formatFloat(value, digits = 3) {
  const v = safeNumber(value);
  if (v === null) return "–";
  return v.toFixed(digits);
}

function classifyParticipants(names, standards) {
  const physicianIds = new Set(Object.values(standards?.physician_names_en || {}));
  const physicianIds2 = new Set(Object.keys(standards?.physician_en_to_cn || {}));
  const doctors = [];
  const models = [];
  (names || []).forEach((name) => {
    if (physicianIds.has(name) || physicianIds2.has(name)) {
      doctors.push(name);
    } else {
      models.push(name);
    }
  });
  return { doctors, models };
}

function setTwoValueCard(doctorValue, modelValue, valueDigits, ids) {
  const dValEl = document.getElementById(ids.doctorValueId);
  const mValEl = document.getElementById(ids.modelValueId);
  const dBarEl = document.getElementById(ids.doctorBarId);
  const mBarEl = document.getElementById(ids.modelBarId);
  if (!dValEl || !mValEl || !dBarEl || !mBarEl) return;

  const d = safeNumber(doctorValue) ?? 0;
  const m = safeNumber(modelValue) ?? 0;
  const max = Math.max(d, m, 0.0001);

  dValEl.textContent = doctorValue == null ? "–" : formatFloat(doctorValue, valueDigits);
  mValEl.textContent = modelValue == null ? "–" : formatFloat(modelValue, valueDigits);

  dBarEl.style.width = `${(d / max) * 100}%`;
  mBarEl.style.width = `${(m / max) * 100}%`;
}

function mean(arr) {
  if (!arr || !arr.length) return null;
  const s = arr.reduce((a, b) => a + b, 0);
  return s / arr.length;
}

function maxOrNull(arr) {
  if (!arr || !arr.length) return null;
  return Math.max(...arr);
}

function renderQ1Q3(mcBlock, standards, t) {
  const macro = (mcBlock && mcBlock.macro_avg_f1) || {};
  const names = Object.keys(macro);
  if (!names.length) {
    const note = document.getElementById("hvm-q1q3-note");
    if (note) note.textContent = t("human-q1q3-missing");
    return;
  }
  const { doctors, models } = classifyParticipants(names, standards);

  const doctorScores = doctors
    .map((name) => macro[name] && safeNumber(macro[name]["总体"] || macro[name].overall || macro[name]))
    .filter((v) => v != null);
  const modelScores = models
    .map((name) => macro[name] && safeNumber(macro[name]["总体"] || macro[name].overall || macro[name]))
    .filter((v) => v != null);

  const doctorMean = mean(doctorScores);
  const bestModel = maxOrNull(modelScores);

  setTwoValueCard(doctorMean, bestModel, 3, {
    doctorValueId: "hvm-q1q3-doctor-value",
    modelValueId: "hvm-q1q3-model-value",
    doctorBarId: "hvm-q1q3-doctor-bar",
    modelBarId: "hvm-q1q3-model-bar",
  });
}

function renderQ2Spatial(spatialBlock, standards, t) {
  const participants = (spatialBlock && spatialBlock.participants) || {};
  const names = Object.keys(participants);
  if (!names.length) {
    const note = document.getElementById("hvm-q2-note");
    if (note) note.textContent = t("human-q2-missing");
    return;
  }
  const { doctors, models } = classifyParticipants(names, standards);

  const doctorScores = doctors
    .map((n) => participants[n] && participants[n].metrics && safeNumber(participants[n].metrics.overall?.mean_iou))
    .filter((v) => v != null);
  const modelScores = models
    .map((n) => participants[n] && participants[n].metrics && safeNumber(participants[n].metrics.overall?.mean_iou))
    .filter((v) => v != null);

  const doctorMean = mean(doctorScores);
  const bestModel = maxOrNull(modelScores);

  setTwoValueCard(doctorMean, bestModel, 3, {
    doctorValueId: "hvm-q2-doctor-value",
    modelValueId: "hvm-q2-model-value",
    doctorBarId: "hvm-q2-doctor-bar",
    modelBarId: "hvm-q2-model-bar",
  });
}

function renderLikert(likertBlock, standards, t) {
  const questionTypes = Object.keys(likertBlock || {});
  if (!questionTypes.length) {
    const note = document.getElementById("hvm-q4q5-note");
    if (note) note.textContent = t("human-q4q5-missing");
    return;
  }

  const doctorScores = [];
  const modelScores = [];

  questionTypes.forEach((qType) => {
    const info = likertBlock[qType];
    if (!info || !info.basic_statistics) return;
    const stats = info.basic_statistics;
    const names = Object.keys(stats);
    const { doctors, models } = classifyParticipants(names, standards);

    doctors.forEach((name) => {
      const s = stats[name] && stats[name].total_score;
      const v = s && safeNumber(s.mean);
      if (v != null) doctorScores.push(v);
    });
    models.forEach((name) => {
      const s = stats[name] && stats[name].total_score;
      const v = s && safeNumber(s.mean);
      if (v != null) modelScores.push(v);
    });
  });

  const doctorMean = mean(doctorScores);
  const bestModel = maxOrNull(modelScores);

  setTwoValueCard(doctorMean, bestModel, 2, {
    doctorValueId: "hvm-q4q5-doctor-value",
    modelValueId: "hvm-q4q5-model-value",
    doctorBarId: "hvm-q4q5-doctor-bar",
    modelBarId: "hvm-q4q5-model-bar",
  });
}

export function initHumanVsModel(hvmData, options) {
  const t = options?.t || ((key) => key);
  const standards = options?.standards || {};
  const getLang = options?.getLang || (() => "zh");
  const onLanguageChange = options?.onLanguageChange || (() => {});

  function refresh() {
    renderQ1Q3(hvmData.q1_q3_multiple_choice || {}, standards, t);
    renderQ2Spatial(hvmData.q2_spatial_localization || {}, standards, t);
    renderLikert(hvmData.q4_q5_likert || {}, standards, t);
  }

  onLanguageChange(() => refresh());
  refresh();
}
