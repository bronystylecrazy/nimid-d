"""Compact shake-condition context for LLM prompts (no raw sensor numbers by default)."""

from __future__ import annotations

from typing import Any

CLASSES = ["excited", "focus", "relax", "hesitate"]

CONDITION_META: dict[str, dict[str, str]] = {
    "excited": {
        "energy": "high",
        "stability": "low",
        "thai_gloss": "กระตือรือร้น มีไฟ แต่จังหวะยังไม่นิ่ง",
        "thai_label": "ตื่นตัว มีพลัง แต่ยังไม่นิ่ง",
    },
    "focus": {
        "energy": "high",
        "stability": "high",
        "thai_gloss": "มีพลัง โฟกัส จังหวะมั่นคง",
        "thai_label": "โฟกัส มีพลัง มีจังหวะ",
    },
    "relax": {
        "energy": "low",
        "stability": "high",
        "thai_gloss": "สงบ นุ่มนวล เสถียร",
        "thai_label": "สงบ นุ่มนวล เสถียร",
    },
    "hesitate": {
        "energy": "low",
        "stability": "low",
        "thai_gloss": "ลังเล อ่อนพลัง จังหวะไม่แน่น",
        "thai_label": "ลังเล อ่อนกำลัง ไม่แน่ใจ",
    },
}

DEFAULT_LOW_CONFIDENCE_THRESHOLD = 0.35


def _runner_up(distances: dict[str, float], predicted: str) -> str | None:
    if not distances:
        return None
    sorted_items = sorted(distances.items(), key=lambda x: x[1])
    if len(sorted_items) < 2:
        return None
    if sorted_items[0][0] == predicted:
        return sorted_items[1][0]
    return sorted_items[0][0]


def build_compact_context(
    predict_result: dict[str, Any],
    *,
    low_confidence_threshold: float = DEFAULT_LOW_CONFIDENCE_THRESHOLD,
    include_raw_features: bool = False,
    raw_features: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Turn predict_condition.py output into LLM-friendly context."""
    condition = str(predict_result.get("predicted_condition", "")).strip()
    if condition not in CONDITION_META:
        raise ValueError(f"Unknown predicted_condition: {condition!r}")

    meta = CONDITION_META[condition]
    confidence = float(predict_result.get("confidence", 0.0))
    distances = predict_result.get("distances") or {}
    if not isinstance(distances, dict):
        distances = {}

    runner_up = _runner_up({k: float(v) for k, v in distances.items()}, condition)

    ctx: dict[str, Any] = {
        "predicted_condition": condition,
        "confidence": round(confidence, 4),
        "energy_level": meta["energy"],
        "stability_level": meta["stability"],
        "thai_gloss": meta["thai_gloss"],
        "thai_label": meta["thai_label"],
    }

    if confidence < low_confidence_threshold and runner_up:
        ctx["ambiguous"] = True
        ctx["runner_up_condition"] = runner_up
        ctx["note_th"] = f"สัญญาณการเขย่าไม่ชัด ใกล้เคียง {runner_up}"
    else:
        ctx["ambiguous"] = False

    if include_raw_features and raw_features:
        ctx["raw_features_debug"] = raw_features

    return ctx


def format_context_for_prompt(ctx: dict[str, Any]) -> str:
    lines = [
        f"- สภาพจากการเขย่า (predicted): {ctx['predicted_condition']}",
        f"- ความมั่นใจของโมเดล: {ctx['confidence']}",
        f"- พลังงาน (แกน): {ctx['energy_level']}",
        f"- เสถียรภาพ (แกน): {ctx['stability_level']}",
        f"- คำอธิบายสั้น: {ctx['thai_gloss']}",
        f"- ป้ายภาษาไทย: {ctx['thai_label']}",
    ]
    if ctx.get("ambiguous"):
        lines.append(f"- หมายเหตุ: {ctx.get('note_th', '')}")
    return "\n".join(lines)
