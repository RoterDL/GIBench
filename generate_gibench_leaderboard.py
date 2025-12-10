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
from pathlib import Path
from typing import Any, Dict, List, Tuple

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


def standards_payload(model_alias_sources: Dict[str, List[str]]) -> Dict[str, Any]:
    return {
        "location_names_en": LOCATION_NAMES_EN,
        "disease_categories": DISEASE_CATEGORIES,
        "disease_name_map": DISEASE_NAME_MAP,
        "model_categories": MODEL_CATEGORIES,
        "model_aliases": MODEL_ALIASES,
        "model_alias_sources": model_alias_sources,
        "physician_names_en": PHYSICIAN_NAMES_EN,
        "physician_en_to_cn": PHYSICIAN_EN_TO_CN,
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

    # Q2：逐病变 IoU
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
        record = {
            "disease_type": disease_info["name_cn"],
            "disease_cn": disease_info["name_cn"],
            "disease_en": disease_info["name_en"],
            "location_cn": disease_info["location_cn"],
            "location_en": disease_info["location_en"],
            "overall_avg_iou": entry.get("overall_avg_iou"),
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

    leaderboard: Dict[str, Any] = {
        "bench_name": "GIBench",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "description": "GIBench 多任务统一模型榜指标（Q1 解剖定位、Q2 病变定位、Q3 诊断）",
        "models": {},
        "standards": standards_payload(alias_sources),
    }

    for model_name in sorted(models):
        record: Dict[str, Any] = {
            "model_name": model_name,
            "model_category": MODEL_CATEGORY_LOOKUP.get(model_name),
            "model_alias_sources": alias_sources.get(model_name),
            "summary": {},
            "tasks": {},
        }

        # Q1：解剖定位
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

        # Q3：诊断区域鲁棒性
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
                    {"index": idx, "accuracy": a_val, "f1_score": f_val}
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

        # Q2：病变定位整体 + 按病变
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

        leaderboard["models"][model_name] = record

    # 人机对比汇总
    eval_results_root = base_dir.parent / "evaluation" / "results"
    human_vs_model: Dict[str, Any] = {}

    def remap_participant_scores(block: Dict[str, Any]) -> Dict[str, Any]:
        mapped: Dict[str, Any] = {}
        for name, value in (block or {}).items():
            mapped[normalize_physician_name(normalize_model_name(name))] = value
        return mapped

    # Q1/Q3：选择题 F1
    comparison_path = eval_results_root / "physician_vs_model" / "comparison_results.json"
    if comparison_path.is_file():
        comparison_data = load_json(comparison_path)
        f1_scores = comparison_data.get("f1_scores", {}) or {}
        anatomical_f1 = {
            normalize_disease_label(k).get("name_cn"): remap_participant_scores(v or {})
            for k, v in (f1_scores.get("anatomical_location_disease_f1") or {}).items()
        }
        diagnosis_f1 = {
            normalize_disease_label(k).get("name_cn"): remap_participant_scores(v or {})
            for k, v in (f1_scores.get("diagnosis_disease_f1") or {}).items()
        }
        human_vs_model["q1_q3_multiple_choice"] = {
            "anatomical_location_disease_f1": anatomical_f1,
            "diagnosis_disease_f1": diagnosis_f1,
            "macro_avg_f1": remap_participant_scores(f1_scores.get("macro_avg_f1") or {}),
            "standard_error_statistics": comparison_data.get("standard_error_statistics"),
        }

    # Q2：病变定位 IoU
    spatial_hvm_path = eval_results_root / "physician_vs_model_spatial" / "spatial_metrics.json"
    if spatial_hvm_path.is_file():
        spatial_hvm = load_json(spatial_hvm_path)
        participants = spatial_hvm.get("participants", {}) or {}
        remapped_participants: Dict[str, Any] = {}
        for name, info in participants.items():
            remapped_participants[normalize_physician_name(normalize_model_name(name))] = info
        human_vs_model["q2_spatial_localization"] = {"participants": remapped_participants}

    # Q4/Q5：Likert
    likert_path = (
        eval_results_root
        / "physician_vs_model_likert_analysis"
        / "question_type"
        / "results.json"
    )
    if likert_path.is_file():
        likert_data = load_json(likert_path)
        likert_block: Dict[str, Any] = {}
        for q_type, q_info in (likert_data or {}).items():
            if not isinstance(q_info, dict):
                continue
            basic_stats = {}
            for name, stat in (q_info.get("basic_statistics") or {}).items():
                basic_stats[normalize_physician_name(normalize_model_name(name))] = stat
            likert_block[q_type] = {
                "summary": q_info.get("summary"),
                "basic_statistics": basic_stats,
            }
        human_vs_model["q4_q5_likert"] = likert_block

    if human_vs_model:
        leaderboard["human_vs_model"] = human_vs_model

    # 额外：输出标准对照文件
    standards_out_dir = ensure_data_dir(base_dir)
    with (standards_out_dir / "gibench_standards.json").open("w", encoding="utf-8") as f:
        json.dump(leaderboard["standards"], f, ensure_ascii=False, indent=2)

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
