#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Generate unified GIBench leaderboard JSON with normalized names (models/diseases/physicians)
and emit a standalone standards file for front-end and downstream use.
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from math import sqrt
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ----------------------------
# Standard definitions
# ----------------------------

LOCATION_NAMES_EN: Dict[str, str] = {
    "食管": "Esophagus",
    "胃": "Stomach",
    "肠": "Colorectum",
    "全部": "All",
}

DISEASE_CATEGORIES: Dict[str, Dict[str, str]] = {
    "Esophagus": {
        "食管静脉曲张": "Esophageal varices",
        "反流性食管炎": "Reflux esophagitis",
        "Barrett食管": "Barrett esophagus",
        "食管黏膜下肿瘤": "Esophageal submucosal lesion",
        "食管异物": "Esophageal foreign body",
        "食管早期肿瘤": "Early esophageal cancer",
        "食管进展期肿瘤": "Advanced esophageal cancer",
    },
    "Stomach": {
        "胃底静脉曲张": "Fundic varices",
        "胃良性息肉": "Benign gastric polyp",
        "早期胃癌": "Early gastric cancer",
        "进展期胃癌": "Advanced gastric cancer",
        "胃黏膜下肿瘤": "Gastric submucosal tumor",
        "消化性溃疡": "Peptic ulcer",
    },
    "Colorectum": {
        "增生性息肉": "Hyperplastic polyp",
        "腺瘤性息肉": "Adenomatous polyp",
        "锯齿状病变": "Serrated lesion",
        "结直肠黏膜下肿瘤": "Colorectal submucosal tumor",
        "进展期结直肠癌": "Advanced colorectal cancer",
        "结肠憩室": "Colonic diverticulum",
        "炎症性肠病": "Inflammatory bowel disease",
    },
}

REGION_KEY_TO_DISEASE_CN: Dict[str, List[str]] = {
    "esophagus": list(DISEASE_CATEGORIES["Esophagus"].keys()),
    "stomach": list(DISEASE_CATEGORIES["Stomach"].keys()),
    "colo": list(DISEASE_CATEGORIES["Colorectum"].keys()),
}

def calculate_standard_error(values: List[float]) -> float:
    """
    与评估脚本一致：标准误 = 样本标准差 / sqrt(n)
    """
    if not values or len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    return sqrt(variance) / sqrt(len(values))

MODEL_CATEGORIES: Dict[str, List[str]] = {
    "medical_opensource": [
        "medgemma-27b-it",
        "HuatuoGPT-Vision-34B",
        "Lingshu-32B",
    ],
    "opensource": [
        "ERNIE-4.5-Turbo-VL-32K",
        "GLM-4.5V",
        "Qwen2.5-VL-72B-Instruct",
        "qwen3-vl-plus",
    ],
    "closed": [
        "claude-sonnet-4-5",
        "gemini-2.5-pro",
        "gemini-3-pro",
        "gpt-4o",
        "gpt-5",
    ],
}

# Model aliases to canonical ids
MODEL_ALIASES: Dict[str, str] = {
    "gemini-3-pro-preview": "gemini-3-pro",
    "gemini-2.5-pro-thinking": "gemini-2.5-pro",
}

PHYSICIAN_NAMES_EN: Dict[str, str] = {
    "马丽云": "Junior-01",
    "许佳琪": "Junior-02",
    "耿子寒": "Junior-03",
    "屈一帆": "Trainee-01",
    "苏伟": "Trainee-02",
    "姚璐": "Trainee-03",
}

SENIORITY_NAMES_EN: Dict[str, str] = {
    "初级内窥镜医师": "Junior Endoscopists",
    "住院实习医师": "Residency Trainees",
}

TASK_TYPE_NAMES_EN: Dict[str, str] = {
    "解剖定位": "Anatomical Localization",
    "病变定位": "Lesion Localization",
    "诊断": "Diagnosis",
    "看图说话": "Findings",
    "后续建议": "Recommendations",
}

LIKERT_DIMENSIONS: Dict[str, Dict[str, Any]] = {
    "dimension1": {"name_cn": "语言表达与可读性", "name_en": "Language Expression", "order": 1},
    "dimension2": {"name_cn": "图像证据利用与可视要点覆盖", "name_en": "Image Evidence", "order": 2},
    "dimension3": {"name_cn": "事实准确性与临床正确性", "name_en": "Factual Accuracy", "order": 3},
    "dimension4": {"name_cn": "可操作性与规范性", "name_en": "Actionability", "order": 4},
    "dimension5": {"name_cn": "安全性与风险控制", "name_en": "Safety", "order": 5},
}

LOCATION_EN_TO_CN: Dict[str, str] = {v: k for k, v in LOCATION_NAMES_EN.items()}
MODEL_CATEGORY_LOOKUP: Dict[str, str] = {
    model: category for category, models in MODEL_CATEGORIES.items() for model in models
}
PHYSICIAN_EN_TO_CN: Dict[str, str] = {v: k for k, v in PHYSICIAN_NAMES_EN.items()}


def build_disease_map() -> Dict[str, Dict[str, str]]:
    mapping: Dict[str, Dict[str, str]] = {}
    for location_en, diseases in DISEASE_CATEGORIES.items():
        location_cn = LOCATION_EN_TO_CN.get(location_en)
        for disease_cn, disease_en in diseases.items():
            mapping[disease_cn] = {
                "name_cn": disease_cn,
                "name_en": disease_en,
                "location_en": location_en,
                "location_cn": location_cn,
            }
    return mapping


DISEASE_NAME_MAP = build_disease_map()


# ----------------------------
# Helpers
# ----------------------------

def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def normalize_model_name(name: str) -> str:
    if not name:
        return name
    name = name.strip()
    return MODEL_ALIASES.get(name, name)


def normalize_physician_name(name: str) -> str:
    if not name:
        return name
    name = name.strip()
    if name.startswith("physician_"):
        name = name.replace("physician_", "", 1)
    return PHYSICIAN_NAMES_EN.get(name, name)


def normalize_location(name: str) -> Tuple[str, str]:
    if not name:
        return None, None
    name = name.strip()
    if name in LOCATION_NAMES_EN:
        return name, LOCATION_NAMES_EN[name]
    if name in LOCATION_EN_TO_CN:
        return LOCATION_EN_TO_CN[name], name
    return name, name


def normalize_disease_label(raw: str) -> Dict[str, Any]:
    """Strip numeric prefixes like '01.' and return cn/en/location info."""
    if not raw:
        return {"name_cn": None, "name_en": None, "location_cn": None, "location_en": None}
    clean = re.sub(r"^[0-9]+[.、．]?\s*", "", raw).strip()
    info = DISEASE_NAME_MAP.get(clean, {})
    return {
        "name_cn": clean,
        "name_en": info.get("name_en"),
        "location_cn": info.get("location_cn"),
        "location_en": info.get("location_en"),
    }


def location_en_to_region_key(location_en: str) -> str:
    mapping = {
        "Esophagus": "esophagus",
        "Stomach": "stomach",
        "Colorectum": "colo",
    }
    return mapping.get(location_en, (location_en or "").lower())


def build_per_disease_f1_se_from_mc(mc_data: Dict[str, Any]) -> Tuple[Dict[str, Dict[str, float]], Dict[str, Dict[str, Dict[str, float]]]]:
    """
    从 multiple_choice.json 的题级结果近似计算病变级 F1 标准误（与计算脚本同公式，无额外采样）。
    Accuracy 不重新计算；F1 标准误基于题级 0/1 正确值。
    Returns:
        q1_f1_se[model][disease_cn]
        q3_f1_se[model][region_key][disease_cn]
    """
    q1_f1_se: Dict[str, Dict[str, float]] = {}
    q3_f1_se: Dict[str, Dict[str, Dict[str, float]]] = {}

    for entry in (mc_data.get("model_disease_results") or {}).values():
        model_name = normalize_model_name(entry.get("model_name") or "")
        disease_info = normalize_disease_label(entry.get("disease_type") or "")
        disease_cn = disease_info["name_cn"]
        region_key = location_en_to_region_key(disease_info["location_en"])

        detailed_results = entry.get("detailed_results") or {}
        q1_correct: List[int] = []
        q3_correct: List[int] = []

        for item in detailed_results.values():
            anat = item.get("解剖定位")
            if isinstance(anat, dict) and "is_correct" in anat:
                q1_correct.append(1 if anat.get("is_correct") else 0)
            diag = item.get("诊断")
            if isinstance(diag, dict) and "is_correct" in diag:
                q3_correct.append(1 if diag.get("is_correct") else 0)

        if q1_correct:
            q1_f1_se.setdefault(model_name, {})[disease_cn] = calculate_standard_error(q1_correct)
        if q3_correct:
            q3_f1_se.setdefault(model_name, {}).setdefault(region_key, {})[disease_cn] = calculate_standard_error(q3_correct)

    return q1_f1_se, q3_f1_se


def build_hvm_per_disease_se(comparison_data: Dict[str, Any]) -> Tuple[Dict[str, Dict[str, float]], Dict[str, Dict[str, float]]]:
    """
    从人机对比 comparison_results.json 计算病变级 Q1/Q3 标准误。
    依据题级 is_correct 0/1 序列，标准误与评估脚本一致：样本标准差 / sqrt(n)。
    Returns:
        q1_se[disease_cn][participant] -> float
        q3_se[disease_cn][participant] -> float
    """
    q1_se: Dict[str, Dict[str, float]] = {}
    q3_se: Dict[str, Dict[str, float]] = {}

    def consume_block(block: Dict[str, Any], is_physician: bool) -> None:
        for name, info in (block or {}).items():
            if is_physician:
                # 对医生统一使用 physician_name 字段做归一化，确保与 human_vs_model 中的英文代号一致
                raw_name = info.get("physician_name") or name
                normalized_name = normalize_physician_name(normalize_model_name(raw_name))
            else:
                normalized_name = normalize_model_name(name)
            detailed = info.get("detailed_results") or []
            per_disease_q1: Dict[str, List[int]] = {}
            per_disease_q3: Dict[str, List[int]] = {}
            for item in detailed:
                disease_info = normalize_disease_label(item.get("disease_type"))
                disease_cn = disease_info["name_cn"]
                if not disease_cn:
                    continue
                q_type = item.get("question_type")
                is_correct = 1 if item.get("is_correct") else 0
                if q_type == "解剖定位":
                    per_disease_q1.setdefault(disease_cn, []).append(is_correct)
                elif q_type == "诊断":
                    per_disease_q3.setdefault(disease_cn, []).append(is_correct)
            for d, arr in per_disease_q1.items():
                q1_se.setdefault(d, {})[normalized_name] = calculate_standard_error(arr)
            for d, arr in per_disease_q3.items():
                q3_se.setdefault(d, {})[normalized_name] = calculate_standard_error(arr)

    consume_block(comparison_data.get("physician_results"), is_physician=True)
    consume_block(comparison_data.get("model_results"), is_physician=False)
    return q1_se, q3_se


def merge_nested_dict(existing: Dict[str, Any], new: Dict[str, Any]) -> Dict[str, Any]:
    if not existing:
        return new or {}
    if not new:
        return existing
    merged = existing.copy()
    for k, v in new.items():
        if isinstance(v, dict) and isinstance(existing.get(k), dict):
            merged[k] = merge_nested_dict(existing[k], v)
        elif v is not None:
            merged[k] = v
    return merged


def round_metrics(obj: Any, ndigits: int = 3) -> Any:
    """
    递归地将所有 float 指标保留到小数点后 ndigits 位。
    仅对 float 生效，不改变 int / str 等其它类型。
    """
    if isinstance(obj, float):
        return round(obj, ndigits)
    if isinstance(obj, dict):
        return {k: round_metrics(v, ndigits) for k, v in obj.items()}
    if isinstance(obj, list):
        return [round_metrics(v, ndigits) for v in obj]
    return obj


def standards_payload(model_alias_sources: Dict[str, List[str]]) -> Dict[str, Any]:
    avg_physician_names_en: Dict[str, str] = {
        f"{name_cn}(平均)": f"{name_en}(Avg)" for name_cn, name_en in SENIORITY_NAMES_EN.items()
    }
    avg_physician_en_to_cn: Dict[str, str] = {
        v: k for k, v in avg_physician_names_en.items()
    }
    return {
        "location_names_en": LOCATION_NAMES_EN,
        "disease_categories": DISEASE_CATEGORIES,
        "disease_name_map": DISEASE_NAME_MAP,
        "model_categories": MODEL_CATEGORIES,
        "model_aliases": MODEL_ALIASES,
        "model_alias_sources": model_alias_sources,
        "physician_names_en": {**PHYSICIAN_NAMES_EN, **avg_physician_names_en},
        "physician_en_to_cn": {**PHYSICIAN_EN_TO_CN, **avg_physician_en_to_cn},
        "seniority_names_en": SENIORITY_NAMES_EN,
        "task_type_names_en": TASK_TYPE_NAMES_EN,
        "likert_dimensions": LIKERT_DIMENSIONS,
    }


def ensure_data_dir(base_dir: Path) -> Path:
    data_dir = base_dir / "assets" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


# ----------------------------
# Core builder
# ----------------------------

def build_leaderboard() -> Dict[str, Any]:
    base_dir = Path(__file__).resolve().parent
    eval_root = base_dir.parent / "evaluation" / "results" / "evaluation_results"

    mc_path = eval_root / "multiple_choice" / "multiple_choice.json"
    spatial_path = eval_root / "spatial_localization" / "spatial_localization.json"
    spatial_overall_path = eval_root / "spatial_localization" / "spatial_localization_overall_metrics.json"

    if not mc_path.is_file():
        raise FileNotFoundError(f"找不到多项选择题结果文件：{mc_path}")
    if not spatial_path.is_file():
        raise FileNotFoundError(f"找不到病变定位结果文件：{spatial_path}")
    if not spatial_overall_path.is_file():
        raise FileNotFoundError(f"找不到病变定位整体指标文件：{spatial_overall_path}")

    mc_data = load_json(mc_path)
    q1_f1_se_map, q3_f1_se_map = build_per_disease_f1_se_from_mc(mc_data)
    spatial_overall_raw = load_json(spatial_overall_path)
    spatial_detail = load_json(spatial_path)

    anatomical_raw = mc_data.get("anatomical_robustness", {}) or {}
    diagnosis_raw = mc_data.get("diagnosis_regional_robustness", {}) or {}

    alias_sources: Dict[str, List[str]] = {}
    anatomical: Dict[str, Any] = {}
    diagnosis: Dict[str, Any] = {}
    spatial_overall: Dict[str, Any] = {}

    for raw_name, value in anatomical_raw.items():
        canonical = normalize_model_name(raw_name)
        if canonical != raw_name:
            alias_sources.setdefault(canonical, []).append(raw_name)
        anatomical[canonical] = merge_nested_dict(anatomical.get(canonical, {}), value or {})

    for raw_name, value in diagnosis_raw.items():
        canonical = normalize_model_name(raw_name)
        if canonical != raw_name:
            alias_sources.setdefault(canonical, []).append(raw_name)
        diagnosis[canonical] = merge_nested_dict(diagnosis.get(canonical, {}), value or {})

    for raw_name, value in spatial_overall_raw.items():
        canonical = normalize_model_name(raw_name)
        if canonical != raw_name:
            alias_sources.setdefault(canonical, []).append(raw_name)
        spatial_overall[canonical] = merge_nested_dict(spatial_overall.get(canonical, {}), value or {})

    spatial_per_disease: Dict[str, List[Dict[str, Any]]] = {}
    for entry in spatial_detail.values():
        if not isinstance(entry, dict):
            continue
        model_name_raw = entry.get("model_name")
        if not model_name_raw:
            continue
        model_name = normalize_model_name(model_name_raw)
        if model_name != model_name_raw:
            alias_sources.setdefault(model_name, []).append(model_name_raw)
        disease_info = normalize_disease_label(entry.get("disease_type"))
        detailed_results = entry.get("detailed_results") or {}
        iou_values: List[float] = []
        for dr in detailed_results.values():
            if not isinstance(dr, dict):
                continue
            detail = dr.get("病灶定位") or dr.get("病变定位")
            if not isinstance(detail, dict):
                continue
            iou = detail.get("iou")
            if iou is None:
                continue
            iou_values.append(iou)
        record = {
            "disease_type": disease_info["name_cn"],
            "disease_cn": disease_info["name_cn"],
            "disease_en": disease_info["name_en"],
            "location_cn": disease_info["location_cn"],
            "location_en": disease_info["location_en"],
            "overall_avg_iou": entry.get("overall_avg_iou"),
            "overall_avg_iou_std_error": calculate_standard_error(iou_values),
            "total_questions": entry.get("total_questions"),
            "valid_questions": entry.get("valid_questions"),
            "invalid_questions": entry.get("invalid_questions"),
        }
        spatial_per_disease.setdefault(model_name, []).append(record)

    for items in spatial_per_disease.values():
        items.sort(key=lambda x: x.get("disease_type") or "")

    models = set(anatomical.keys()) | set(diagnosis.keys()) | set(spatial_overall.keys()) | set(
        spatial_per_disease.keys()
    )

    standards = standards_payload(alias_sources)

    leaderboard: Dict[str, Any] = {
        "bench_name": "GIBench",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "description": "GIBench 多任务统一模型榜指标（Q1 解剖定位、Q2 病变定位、Q3 诊断）",
    }

    model_records: Dict[str, Any] = {}

    for model_name in sorted(models):
        record: Dict[str, Any] = {
            "model_name": model_name,
            "model_category": MODEL_CATEGORY_LOOKUP.get(model_name),
            "model_alias_sources": alias_sources.get(model_name),
            "summary": {},
            "tasks": {},
        }

        if model_name in anatomical:
            a = anatomical[model_name] or {}
            acc = a.get("accuracy", {}) or {}
            f1 = a.get("f1_score", {}) or {}
            disease_details = a.get("disease_details", []) or []
            per_disease = []
            for d in disease_details:
                disease_info = normalize_disease_label(d.get("disease"))
                per_disease.append(
                    {
                        "disease": disease_info["name_cn"],
                        "disease_cn": disease_info["name_cn"],
                        "disease_en": disease_info["name_en"],
                        "location_cn": disease_info["location_cn"],
                        "location_en": disease_info["location_en"],
                        "accuracy": d.get("accuracy"),
                        "f1_score": d.get("f1_score"),
                        "f1_std_error": (q1_f1_se_map.get(model_name, {}) or {}).get(disease_info["name_cn"]),
                    }
                )
            record["tasks"]["q1_anatomical_robustness"] = {
                "overall": {
                    "accuracy_mean": acc.get("mean"),
                    "accuracy_std_error": acc.get("std_error"),
                    "f1_mean": f1.get("mean"),
                    "f1_std_error": f1.get("std_error"),
                    "num_diseases": a.get("num_diseases"),
                    "num_valid_samples": a.get("num_valid_samples"),
                    "total_samples": a.get("total_samples"),
                },
                "per_disease": per_disease,
            }
            record["summary"]["q1_anatomical_accuracy_mean"] = acc.get("mean")
            record["summary"]["q1_anatomical_f1_mean"] = f1.get("mean")

        if model_name in diagnosis:
            diag = diagnosis[model_name] or {}
            regions: List[Dict[str, Any]] = []
            f1_weighted_sum = 0.0
            sample_total = 0
            for region_key, region_data in diag.items():
                if not isinstance(region_data, dict):
                    continue
                acc = region_data.get("accuracy", {}) or {}
                f1 = region_data.get("f1_score", {}) or {}
                total_samples = int(region_data.get("total_samples") or 0)
                per_acc = acc.get("per_disease") or []
                per_f1 = f1.get("per_disease") or []
                per_disease = [
                    {
                        "index": idx,
                        "accuracy": a_val,
                        "f1_score": f_val,
                        "f1_std_error": (q3_f1_se_map.get(model_name, {}).get(region_key, {}) or {}).get(
                            (REGION_KEY_TO_DISEASE_CN.get(region_key, []) or [None] * len(per_acc))[idx - 1]
                        ),
                    }
                    for idx, (a_val, f_val) in enumerate(zip(per_acc, per_f1), start=1)
                ]
                region_cn, region_en = normalize_location(region_data.get("location_name"))
                regions.append(
                    {
                        "region_key": region_key,
                        "region_name": region_cn,
                        "region_name_cn": region_cn,
                        "region_name_en": region_en,
                        "accuracy_mean": acc.get("mean"),
                        "accuracy_std_error": acc.get("std_error"),
                        "f1_mean": f1.get("mean"),
                        "f1_std_error": f1.get("std_error"),
                        "num_diseases": region_data.get("num_diseases"),
                        "num_valid_samples": region_data.get("num_valid_samples"),
                        "total_samples": total_samples,
                        "per_disease": per_disease,
                    }
                )
                if f1.get("mean") is not None and total_samples:
                    f1_weighted_sum += float(f1["mean"]) * total_samples
                    sample_total += total_samples
            regions.sort(key=lambda x: x.get("region_key") or "")
            record["tasks"]["q3_diagnosis_regional_robustness"] = {"regions": regions}
            if sample_total:
                record["summary"]["q3_diagnosis_f1_mean"] = f1_weighted_sum / sample_total

        if model_name in spatial_overall:
            s = spatial_overall[model_name] or {}
            record["tasks"].setdefault("q2_spatial_localization", {})
            record["tasks"]["q2_spatial_localization"]["overall"] = {
                "miou": s.get("miou"),
                "recall_05": s.get("recall_05"),
                "recall_075": s.get("recall_075"),
                "total_questions": s.get("total_questions"),
            }
            record["summary"]["q2_spatial_miou"] = s.get("miou")
            record["summary"]["q2_spatial_recall_05"] = s.get("recall_05")
            record["summary"]["q2_spatial_recall_075"] = s.get("recall_075")
        if model_name in spatial_per_disease:
            record["tasks"].setdefault("q2_spatial_localization", {})
            record["tasks"]["q2_spatial_localization"]["per_disease"] = spatial_per_disease[model_name]

        model_records[model_name] = record

    q1_models: Dict[str, Any] = {}
    q2_models: Dict[str, Any] = {}
    q3_models: Dict[str, Any] = {}

    for model_name, record in model_records.items():
        tasks = record.get("tasks") or {}
        summary = record.get("summary") or {}

        q1 = tasks.get("q1_anatomical_robustness") or {}
        if q1:
            overall = dict(q1.get("overall") or {})
            total_samples = overall.get("total_samples")
            try:
                overall["sample_size"] = int(total_samples) if total_samples is not None else None
            except (TypeError, ValueError):
                overall["sample_size"] = None
            q1_models[model_name] = {
                "overall": overall,
                "per_disease": q1.get("per_disease") or [],
            }

        q2 = tasks.get("q2_spatial_localization") or {}
        if q2:
            overall = dict(q2.get("overall") or {})
            total_questions = overall.get("total_questions")
            try:
                overall["sample_size"] = int(total_questions) if total_questions is not None else None
            except (TypeError, ValueError):
                overall["sample_size"] = None
            q2_models[model_name] = {
                "overall": overall,
                "per_disease": q2.get("per_disease") or [],
            }

        q3 = tasks.get("q3_diagnosis_regional_robustness") or {}
        if q3:
            regions = q3.get("regions") or []
            sample_total = 0
            for region in regions:
                try:
                    sample_total += int(region.get("total_samples") or 0)
                except (TypeError, ValueError):
                    continue
            q3_models[model_name] = {
                "overall": {
                    "f1_mean": summary.get("q3_diagnosis_f1_mean"),
                    "sample_size": sample_total,
                },
                "regions": regions,
            }

    eval_results_root = base_dir.parent / "evaluation" / "results"
    human_vs_model: Dict[str, Any] = {}

    def safe_float(value: Any) -> Optional[float]:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def mean(values: List[float]) -> Optional[float]:
        if not values:
            return None
        return sum(values) / len(values)

    def resolve_seniority_cn(type_raw: Any, participant_name: str) -> Optional[str]:
        if type_raw is not None:
            type_str = str(type_raw).strip()
            aliases = {
                "低年资": "住院实习医师",
                "高年资": "初级内窥镜医师",
            }
            type_str = aliases.get(type_str, type_str)
            reverse_mapping = {v: k for k, v in SENIORITY_NAMES_EN.items()}
            type_str = reverse_mapping.get(type_str, type_str)
            if type_str in SENIORITY_NAMES_EN:
                return type_str

        if participant_name:
            if participant_name.startswith("Trainee-"):
                return "住院实习医师"
            if participant_name.startswith("Junior-"):
                return "初级内窥镜医师"
        return None

    def group_avg_name(group_cn: str) -> str:
        group_en = SENIORITY_NAMES_EN.get(group_cn, group_cn)
        return f"{group_en}(Avg)"

    def build_group_avg_mc(physicians: Dict[str, Any]) -> Dict[str, Any]:
        group_to_members: Dict[str, List[str]] = {}
        for name, info in (physicians or {}).items():
            if not name or name.endswith("(Avg)"):
                continue
            group_cn = resolve_seniority_cn((info or {}).get("type"), name)
            if not group_cn:
                continue
            group_to_members.setdefault(group_cn, []).append(name)

        avg_records: Dict[str, Any] = {}
        for group_cn, members in group_to_members.items():
            if not members:
                continue
            avg_name = group_avg_name(group_cn)

            macro_by_key: Dict[str, List[float]] = {}
            per_disease_f1: Dict[str, List[float]] = {}
            per_disease_se: Dict[str, List[float]] = {}
            sample_size_sum = 0

            for member in members:
                entry = physicians.get(member) or {}
                try:
                    sample_size_sum += int(entry.get("sample_size") or 0)
                except (TypeError, ValueError):
                    pass

                macro_val = entry.get("macro_avg_f1")
                if isinstance(macro_val, dict):
                    for k, v in macro_val.items():
                        fv = safe_float(v)
                        if fv is None:
                            continue
                        macro_by_key.setdefault(str(k), []).append(fv)
                else:
                    fv = safe_float(macro_val)
                    if fv is not None:
                        macro_by_key.setdefault("overall", []).append(fv)

                for disease, score in (entry.get("per_disease_f1") or {}).items():
                    fv = safe_float(score)
                    if fv is None:
                        continue
                    per_disease_f1.setdefault(str(disease), []).append(fv)

                for disease, se_val in (entry.get("per_disease_std_error") or {}).items():
                    fv = safe_float(se_val)
                    if fv is None:
                        continue
                    per_disease_se.setdefault(str(disease), []).append(fv)

            macro_avg = {k: mean(vals) for k, vals in macro_by_key.items() if vals}
            avg_records[avg_name] = {
                "name": avg_name,
                "type": group_cn,
                "per_disease_f1": {k: mean(vals) for k, vals in per_disease_f1.items() if vals},
                "per_disease_std_error": {k: mean(vals) for k, vals in per_disease_se.items() if vals},
                "sample_size": sample_size_sum if sample_size_sum else None,
                "macro_avg_f1": macro_avg or None,
            }
        return avg_records

    def build_group_avg_spatial(physicians: Dict[str, Any]) -> Dict[str, Any]:
        group_to_members: Dict[str, List[str]] = {}
        for name, info in (physicians or {}).items():
            if not name or name.endswith("(Avg)"):
                continue
            group_cn = resolve_seniority_cn((info or {}).get("type"), name)
            if not group_cn:
                continue
            group_to_members.setdefault(group_cn, []).append(name)

        avg_records: Dict[str, Any] = {}
        for group_cn, members in group_to_members.items():
            if not members:
                continue
            avg_name = group_avg_name(group_cn)

            overall_mean_iou_vals: List[float] = []
            sample_size_sum = 0
            by_disease_mean_iou: Dict[str, List[float]] = {}
            by_disease_se: Dict[str, List[float]] = {}

            for member in members:
                entry = physicians.get(member) or {}
                overall = entry.get("overall") or {}
                mean_iou_val = safe_float(
                    overall.get("mean_iou") if isinstance(overall, dict) else None
                )
                if mean_iou_val is None and isinstance(overall, dict):
                    mean_iou_val = safe_float(overall.get("miou"))
                if mean_iou_val is not None:
                    overall_mean_iou_vals.append(mean_iou_val)

                if isinstance(overall, dict):
                    try:
                        sample_size_sum += int(overall.get("sample_size") or 0)
                    except (TypeError, ValueError):
                        pass

                for disease, metrics in (entry.get("by_disease") or {}).items():
                    if not isinstance(metrics, dict):
                        continue
                    mean_iou = safe_float(metrics.get("mean_iou") or metrics.get("miou"))
                    if mean_iou is not None:
                        by_disease_mean_iou.setdefault(str(disease), []).append(mean_iou)
                    se_val = safe_float(
                        metrics.get("mean_iou_std_error")
                        or metrics.get("std_error")
                        or metrics.get("miou_std_error")
                        or metrics.get("overall_avg_iou_std_error")
                    )
                    if se_val is not None:
                        by_disease_se.setdefault(str(disease), []).append(se_val)

            avg_overall = {
                "mean_iou": mean(overall_mean_iou_vals),
                "sample_size": sample_size_sum if sample_size_sum else None,
            }

            avg_by_disease: Dict[str, Dict[str, Any]] = {}
            for disease, vals in by_disease_mean_iou.items():
                avg_by_disease[disease] = {"mean_iou": mean(vals)}
                se_vals = by_disease_se.get(disease)
                if se_vals:
                    avg_by_disease[disease]["mean_iou_std_error"] = mean(se_vals)

            avg_records[avg_name] = {
                "name": avg_name,
                "type": group_cn,
                "overall": avg_overall,
                "by_disease": avg_by_disease,
            }
        return avg_records

    def inject_group_avg_likert(
        q_type_cn: str,
        disease_block: Dict[str, Dict[str, Dict[str, Any]]],
        totals: Dict[str, Dict[str, int]],
    ) -> None:
        group_to_names: Dict[str, List[str]] = {}
        for participants in (disease_block or {}).values():
            for name, info in (participants or {}).items():
                if not name or name.endswith("(Avg)"):
                    continue
                if name not in PHYSICIAN_EN_TO_CN:
                    continue
                group_cn = resolve_seniority_cn((info or {}).get("participant_type"), name)
                if not group_cn:
                    continue
                group_to_names.setdefault(group_cn, [])
                if name not in group_to_names[group_cn]:
                    group_to_names[group_cn].append(name)

        if group_to_names:
            totals.setdefault(q_type_cn, {})
        for group_cn, names in group_to_names.items():
            avg_name = group_avg_name(group_cn)
            totals[q_type_cn][avg_name] = sum(int(totals[q_type_cn].get(n, 0)) for n in names)

        for disease_key, participants in (disease_block or {}).items():
            if not isinstance(participants, dict):
                continue
            group_buckets: Dict[str, Dict[str, Any]] = {}
            for name, info in participants.items():
                if not name or name.endswith("(Avg)"):
                    continue
                if name not in PHYSICIAN_EN_TO_CN:
                    continue
                group_cn = resolve_seniority_cn((info or {}).get("participant_type"), name)
                if not group_cn:
                    continue
                bucket = group_buckets.setdefault(
                    group_cn,
                    {"dim_mean": {}, "dim_std": {}, "sample_size": 0},
                )
                try:
                    bucket["sample_size"] += int((info or {}).get("sample_size") or 0)
                except (TypeError, ValueError):
                    pass
                dims = (info or {}).get("dimensions") or {}
                for dim_key, dim in dims.items():
                    if not isinstance(dim, dict):
                        continue
                    m = safe_float(dim.get("mean"))
                    s = safe_float(dim.get("std"))
                    if m is not None:
                        bucket["dim_mean"].setdefault(dim_key, []).append(m)
                    if s is not None:
                        bucket["dim_std"].setdefault(dim_key, []).append(s)

            for group_cn, bucket in group_buckets.items():
                avg_name = group_avg_name(group_cn)
                avg_entry = {
                    "name": avg_name,
                    "name_cn": f"{group_cn}(平均)",
                    "participant_type": group_cn,
                    "dimensions": {},
                }
                if bucket.get("sample_size"):
                    avg_entry["sample_size"] = bucket["sample_size"]
                for dim_key, meta in LIKERT_DIMENSIONS.items():
                    dim_mean_vals = bucket["dim_mean"].get(dim_key) or []
                    dim_std_vals = bucket["dim_std"].get(dim_key) or []
                    if not dim_mean_vals and not dim_std_vals:
                        continue
                    avg_entry["dimensions"][dim_key] = {
                        "name_cn": meta.get("name_cn"),
                        "name_en": meta.get("name_en"),
                        "order": meta.get("order"),
                        "mean": mean(dim_mean_vals),
                        "std": mean(dim_std_vals),
                    }
                if avg_entry["dimensions"]:
                    participants[avg_name] = avg_entry

    def remap_participant_scores(block: Dict[str, Any]) -> Dict[str, Any]:
        mapped: Dict[str, Any] = {}
        for name, value in (block or {}).items():
            mapped[normalize_physician_name(normalize_model_name(name))] = value
        return mapped

    comparison_path = eval_results_root / "physician_vs_model" / "comparison_results.json"
    if comparison_path.is_file():
        comparison_data = load_json(comparison_path)
        q1_se_map, q3_se_map = build_hvm_per_disease_se(comparison_data)
        f1_scores = comparison_data.get("f1_scores", {}) or {}
        anatomical_raw = f1_scores.get("anatomical_location_disease_f1") or {}
        diagnosis_raw = f1_scores.get("diagnosis_disease_f1") or {}
        macro_raw = f1_scores.get("macro_avg_f1") or {}

        anatomical_by_disease: Dict[str, Dict[str, float]] = {}
        for disease_key, participants in anatomical_raw.items():
            disease_cn = normalize_disease_label(disease_key).get("name_cn")
            if not disease_cn:
                continue
            anatomical_by_disease[disease_cn] = remap_participant_scores(participants or {})

        diagnosis_by_disease: Dict[str, Dict[str, float]] = {}
        for disease_key, participants in diagnosis_raw.items():
            disease_cn = normalize_disease_label(disease_key).get("name_cn")
            if not disease_cn:
                continue
            diagnosis_by_disease[disease_cn] = remap_participant_scores(participants or {})

        macro_avg = remap_participant_scores(macro_raw)

        participant_sample_sizes_q1: Dict[str, int] = {}
        participant_sample_sizes_q3: Dict[str, int] = {}

        def consume_sample_sizes(block: Dict[str, Any], is_physician: bool) -> None:
            for name, info in (block or {}).items():
                if not isinstance(info, dict):
                    continue
                if is_physician:
                    raw_name = info.get("physician_name") or name
                    normalized = normalize_physician_name(normalize_model_name(raw_name))
                else:
                    normalized = normalize_model_name(name)
                by_qtype = info.get("by_question_type") or {}
                q1_block = by_qtype.get("解剖定位") or {}
                q3_block = by_qtype.get("诊断") or {}
                total_q1 = int(q1_block.get("total") or 0)
                total_q3 = int(q3_block.get("total") or 0)
                if not total_q1 and not q1_block:
                    total_q1 = int(info.get("total_questions") or 0)
                if not total_q3 and not q3_block:
                    total_q3 = int(info.get("total_questions") or 0)
                if total_q1:
                    participant_sample_sizes_q1[normalized] = total_q1
                if total_q3:
                    participant_sample_sizes_q3[normalized] = total_q3

        consume_sample_sizes(comparison_data.get("physician_results"), is_physician=True)
        consume_sample_sizes(comparison_data.get("model_results"), is_physician=False)

        def is_model_participant(name: str) -> bool:
            return name in model_records

        q1_physicians: Dict[str, Any] = {}
        for disease_cn, participants in anatomical_by_disease.items():
            for participant, f1_val in participants.items():
                if is_model_participant(participant):
                    continue
                entry = q1_physicians.setdefault(
                    participant,
                    {
                        "name": participant,
                        "per_disease_f1": {},
                        "per_disease_std_error": {},
                        "sample_size": participant_sample_sizes_q1.get(participant),
                        "macro_avg_f1": None,
                    },
                )
                entry["per_disease_f1"][disease_cn] = f1_val
                se_val = (q1_se_map.get(disease_cn) or {}).get(participant)
                if se_val is not None:
                    entry["per_disease_std_error"][disease_cn] = se_val

        for participant, macro_val in macro_avg.items():
            if is_model_participant(participant):
                continue
            if participant not in q1_physicians:
                q1_physicians[participant] = {
                    "name": participant,
                    "per_disease_f1": {},
                    "per_disease_std_error": {},
                    "sample_size": participant_sample_sizes_q1.get(participant),
                }
            q1_physicians[participant]["macro_avg_f1"] = macro_val
        q1_physicians.update(build_group_avg_mc(q1_physicians))

        q3_physicians: Dict[str, Any] = {}
        for disease_cn, participants in diagnosis_by_disease.items():
            for participant, f1_val in participants.items():
                if is_model_participant(participant):
                    continue
                entry = q3_physicians.setdefault(
                    participant,
                    {
                        "name": participant,
                        "per_disease_f1": {},
                        "per_disease_std_error": {},
                        "sample_size": participant_sample_sizes_q3.get(participant),
                        "macro_avg_f1": None,
                    },
                )
                entry["per_disease_f1"][disease_cn] = f1_val
                se_val = (q3_se_map.get(disease_cn) or {}).get(participant)
                if se_val is not None:
                    entry["per_disease_std_error"][disease_cn] = se_val

        for participant, macro_val in macro_avg.items():
            if is_model_participant(participant):
                continue
            if participant not in q3_physicians:
                q3_physicians[participant] = {
                    "name": participant,
                    "per_disease_f1": {},
                    "per_disease_std_error": {},
                    "sample_size": participant_sample_sizes_q3.get(participant),
                }
            q3_physicians[participant]["macro_avg_f1"] = macro_val
        q3_physicians.update(build_group_avg_mc(q3_physicians))

        if q1_models or q1_physicians:
            block: Dict[str, Any] = {}
            if q1_models:
                block["models"] = q1_models
            if q1_physicians:
                block["physicians"] = q1_physicians
            human_vs_model["q1_anatomical_robustness"] = block

        if q3_models or q3_physicians:
            block: Dict[str, Any] = {}
            if q3_models:
                block["models"] = q3_models
            if q3_physicians:
                block["physicians"] = q3_physicians
            human_vs_model["q3_diagnosis_regional_robustness"] = block

    spatial_hvm_path = eval_results_root / "physician_vs_model_spatial" / "spatial_metrics.json"
    if spatial_hvm_path.is_file():
        spatial_hvm = load_json(spatial_hvm_path)
        per_question_iou = spatial_hvm.get("per_question_iou") or {}
        per_disease_iou_std_error: Dict[str, Dict[str, float]] = {}

        for name, block in per_question_iou.items():
            normalized_name = normalize_physician_name(normalize_model_name(name))
            details = block.get("details") or []
            per_disease_values: Dict[str, List[float]] = {}
            for item in details:
                if not isinstance(item, dict):
                    continue
                if item.get("is_valid_prediction") is False:
                    continue
                try:
                    iou_val = float(item.get("iou"))
                except (TypeError, ValueError):
                    continue
                disease_info = normalize_disease_label(item.get("disease_type"))
                disease_cn = disease_info["name_cn"]
                if not disease_cn:
                    continue
                per_disease_values.setdefault(disease_cn, []).append(iou_val)
            if per_disease_values:
                per_disease_iou_std_error[normalized_name] = {
                    disease: calculate_standard_error(values) for disease, values in per_disease_values.items()
                }

        participants = spatial_hvm.get("participants", {}) or {}
        q2_physicians: Dict[str, Any] = {}
        for name, info in participants.items():
            if not isinstance(info, dict):
                continue
            canonical = normalize_model_name(name)
            if canonical in model_records:
                continue
            normalized_name = normalize_physician_name(canonical)
            metrics = info.get("metrics") or {}
            overall = dict(metrics.get("overall") or {})
            total_questions = overall.get("total_questions")
            try:
                overall["sample_size"] = int(total_questions) if total_questions is not None else None
            except (TypeError, ValueError):
                overall["sample_size"] = None
            raw_by_disease = metrics.get("by_disease") or {}
            by_disease: Dict[str, Dict[str, Any]] = {
                disease: dict(values) for disease, values in raw_by_disease.items() if isinstance(values, dict)
            }
            se_map = per_disease_iou_std_error.get(normalized_name) or {}
            for disease_cn, se_val in se_map.items():
                if disease_cn in by_disease:
                    by_disease[disease_cn]["mean_iou_std_error"] = se_val
                    continue
                for bd_key in by_disease.keys():
                    if normalize_disease_label(bd_key)["name_cn"] == disease_cn:
                        by_disease[bd_key]["mean_iou_std_error"] = se_val
                        break
            q2_physicians[normalized_name] = {
                "name": normalized_name,
                "type": info.get("type"),
                "overall": overall,
                "by_disease": by_disease,
            }
        q2_physicians.update(build_group_avg_spatial(q2_physicians))
        if q2_models or q2_physicians:
            block: Dict[str, Any] = {}
            if q2_models:
                block["models"] = q2_models
            if q2_physicians:
                block["physicians"] = q2_physicians
            human_vs_model["q2_spatial_localization"] = block

    likert_path = (
        eval_results_root
        / "full_dataset_likert_analysis"
        / "analysis_results.json"
    )
    if likert_path.is_file():
        likert_data = load_json(likert_path) or {}
        entries = likert_data.get("by_question_and_disease_type") or []
        likert_grouped: Dict[str, Dict[str, Dict[str, Dict[str, Any]]]] = {}
        likert_totals: Dict[str, Dict[str, int]] = {}
        for item in entries:
            if not isinstance(item, dict):
                continue
            q_type_cn = item.get("question_type")
            disease_raw = item.get("disease_type")
            participant_raw = item.get("model_name")
            if not q_type_cn or not disease_raw or not participant_raw:
                continue
            normalized_name = normalize_physician_name(normalize_model_name(participant_raw))
            participant_cn = PHYSICIAN_EN_TO_CN.get(normalized_name)
            participant_entry = likert_grouped.setdefault(q_type_cn, {}).setdefault(disease_raw, {}).setdefault(
                normalized_name,
                {
                    "name": normalized_name,
                    "name_cn": participant_cn,
                    "participant_type": item.get("participant_type"),
                    "dimensions": {},
                },
            )
            try:
                n_samples = int(item.get("n_samples") or 0)
            except (TypeError, ValueError):
                n_samples = 0
            if n_samples:
                participant_entry["sample_size"] = int(participant_entry.get("sample_size") or 0) + n_samples
                likert_totals.setdefault(q_type_cn, {}).setdefault(normalized_name, 0)
                likert_totals[q_type_cn][normalized_name] += n_samples
            for dim_key, meta in LIKERT_DIMENSIONS.items():
                order = meta.get("order")
                name_cn = meta.get("name_cn")
                mean_key = f"维度{order}_{name_cn}_mean"
                std_key = f"维度{order}_{name_cn}_std"
                participant_entry["dimensions"][dim_key] = {
                    "name_cn": name_cn,
                    "name_en": meta.get("name_en"),
                    "order": order,
                    "mean": item.get(mean_key),
                    "std": item.get(std_key),
                }

        likert_block: Dict[str, Any] = {}
        for q_type_cn, disease_block in likert_grouped.items():
            inject_group_avg_likert(q_type_cn, disease_block, likert_totals)
            diseases: List[Dict[str, Any]] = []
            for disease_key, participants in disease_block.items():
                disease_info = normalize_disease_label(disease_key)
                participant_list = sorted(
                    participants.values(),
                    key=lambda x: (x.get("name_cn") or x.get("name") or ""),
                )
                diseases.append(
                    {
                        "disease": disease_info["name_cn"],
                        "disease_cn": disease_info["name_cn"],
                        "disease_en": disease_info["name_en"],
                        "location_cn": disease_info["location_cn"],
                        "location_en": disease_info["location_en"],
                        "participants": participant_list,
                    }
                )
            diseases.sort(key=lambda x: x.get("disease") or "")
            likert_block[q_type_cn] = {
                "question_type_cn": q_type_cn,
                "question_type_en": TASK_TYPE_NAMES_EN.get(q_type_cn, q_type_cn),
                "diseases": diseases,
                "participant_sample_sizes": likert_totals.get(q_type_cn) or {},
            }
        if likert_block:
            q4_cn = "看图说话"
            q5_cn = "后续建议"
            q4_block = likert_block.get(q4_cn)
            q5_block = likert_block.get(q5_cn)
            if q4_block:
                human_vs_model["q4_findings_likert"] = q4_block
            if q5_block:
                human_vs_model["q5_recommendations_likert"] = q5_block

    if human_vs_model:
        leaderboard["human_vs_model"] = human_vs_model

    # 将所有浮点指标统一保留三位小数
    leaderboard = round_metrics(leaderboard, ndigits=3)

    standards_out_dir = ensure_data_dir(base_dir)
    with (standards_out_dir / "gibench_standards.json").open("w", encoding="utf-8") as f:
        json.dump(standards, f, ensure_ascii=False, indent=2)

    return leaderboard


def main() -> None:
    data = build_leaderboard()
    out_path = Path(__file__).resolve().parent / "gibench_leaderboard.json"
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"已生成文件：{out_path}")
    print("标准对照文件：assets/data/gibench_standards.json")


if __name__ == "__main__":
    main()
