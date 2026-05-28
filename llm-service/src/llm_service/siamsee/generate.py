from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..call_gpt_palm_reader import (
    extract_output_text,
    is_missing_or_mock_api_key,
    load_env_file,
    post_response,
)
from .aggregate_shake_features import aggregate_path
from .condition_classifier_common import prototype_predict
from .condition_context import build_compact_context, format_context_for_prompt
from .prompts import DEFAULT_MODEL, build_api_payload, build_user_prompt, render_reading


ROOT = Path(__file__).resolve().parent
DEFAULT_SIAMSEE_STYLE = ROOT / "siamsee.txt"
DEFAULT_PROTOTYPE = ROOT / "models" / "prototype_rules.json"
DEFAULT_STICKS = ROOT / "sticks" / "siamsee.json"
MIN_SAMPLE_COUNT = 8
MIN_DURATION_MS = 300
FALLBACK_CONDITION = {
    "predicted_condition": "focus",
    "method": "fallback_insufficient_motion",
    "confidence": 0,
    "distances": {},
}


@dataclass
class SiamseeReadingResult:
    text: str
    fields: dict[str, str]
    predicted_condition: str
    condition_context: dict[str, Any]
    model: str
    siamsee_stick: dict[str, Any] | None = None

    def to_api_dict(self) -> dict[str, Any]:
        return {
            "status": "complete",
            "message": "Siamsee reading complete.",
            "model": self.model,
            "reading": self.text.rstrip("\n"),
            "fields": self.fields,
            "predicted_condition": self.predicted_condition,
            "condition_context": self.condition_context,
            "siamsee_stick": self.siamsee_stick,
        }


def _csv_stats(shake_csv_text: str) -> tuple[int, float]:
    lines = [line.strip() for line in shake_csv_text.splitlines() if line.strip()]
    if len(lines) <= 1:
        return 0, 0.0
    values: list[float] = []
    for raw in lines[1:]:
        first = raw.split(",", 1)[0].strip()
        try:
            values.append(float(first))
        except ValueError:
            continue
    if not values:
        return 0, 0.0
    return len(values), max(values) - min(values)


def _predict_from_shake_csv(shake_csv: Path, prototype_path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    agg = aggregate_path(shake_csv, save_debug_peaks=False)
    features = agg["features"]
    with prototype_path.open("r", encoding="utf-8") as f:
        rules = json.load(f)
    pred, distances, confidence = prototype_predict(features, rules)
    predict_result = {
        "predicted_condition": pred,
        "method": "prototype_shrunk",
        "confidence": confidence,
        "distances": distances,
    }
    return predict_result, build_compact_context(predict_result)


def _resolve_condition(
    *,
    shake_csv_text: str,
    condition: dict[str, Any] | None,
    prototype_path: Path,
) -> tuple[dict[str, Any], dict[str, Any]]:
    if condition is not None:
        return condition, build_compact_context(condition)

    sample_count, duration_ms = _csv_stats(shake_csv_text)
    if sample_count < MIN_SAMPLE_COUNT or duration_ms < MIN_DURATION_MS:
        return FALLBACK_CONDITION, build_compact_context(FALLBACK_CONDITION)

    with tempfile.TemporaryDirectory() as tmp:
        shake_path = Path(tmp) / "shake.csv"
        shake_path.write_text(shake_csv_text, encoding="utf-8")
        return _predict_from_shake_csv(shake_path, prototype_path)


def load_siamsee_stick(
    stick_number: int | None,
    siamsee_stick: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if siamsee_stick is not None:
        if "stick_number" not in siamsee_stick:
            raise ValueError("siamsee_stick.stick_number required")
        return siamsee_stick
    if stick_number is None:
        return None
    with DEFAULT_STICKS.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    for stick in payload.get("fortune_sticks", []):
        if int(stick.get("stick_number", 0)) == int(stick_number):
            return stick
    raise ValueError(f"Unknown siamsee stick_number: {stick_number}")


def generate_siamsee_reading(
    *,
    palm_reading: dict[str, Any],
    shake_csv_text: str = "",
    condition: dict[str, Any] | None = None,
    stick_number: int | None = None,
    siamsee_stick: dict[str, Any] | None = None,
    round_context: dict[str, Any] | None = None,
    env_file: Path | None = None,
    model: str | None = None,
    dry_run: bool = False,
) -> SiamseeReadingResult | dict[str, Any]:
    if not isinstance(palm_reading, dict):
        raise ValueError("palm_reading object required")
    if not shake_csv_text.strip() and condition is None:
        raise ValueError("shake_csv_text or condition required")
    if env_file is not None:
        load_env_file(env_file)

    predict_result, compact = _resolve_condition(
        shake_csv_text=shake_csv_text,
        condition=condition,
        prototype_path=DEFAULT_PROTOTYPE,
    )
    resolved_stick = load_siamsee_stick(stick_number, siamsee_stick)
    style_text = DEFAULT_SIAMSEE_STYLE.read_text(encoding="utf-8")
    user_prompt = build_user_prompt(
        siamsee_style_text=style_text,
        siamsee_stick=resolved_stick,
        palm_reading=palm_reading,
        shake_context_text=format_context_for_prompt(compact),
        round_context=round_context,
    )
    resolved_model = model or os.getenv("OPENAI_SIAMSEE_MODEL") or os.getenv("OPENAI_MODEL") or DEFAULT_MODEL
    payload = build_api_payload(user_prompt, resolved_model)

    if dry_run:
        fields = {
            "reading_lines_th": [
                "จังหวะของรอบนี้ชี้ว่าคุณกำลังค่อย ๆ กลับมายืนบนฐานที่มั่นคงขึ้น",
                "ใบเซียมซีหนุนให้เลือกเรื่องสำคัญเพียงหนึ่งเรื่อง แล้วให้เวลากับมันอย่างจริงใจ",
                "ลายมือบอกว่าความคิดละเอียดของคุณจะช่วยแยกเรื่องเร่งด่วนออกจากเรื่องที่รอได้",
                "ช่วงบ่ายถึงเย็นเหมาะกับการทบทวนคำตอบก่อนตัดสินใจครั้งเล็ก ๆ",
                "วันนี้ให้เริ่มจากก้าวที่ทำได้จริง แล้วปล่อยให้ความมั่นใจตามมาทีหลัง",
            ],
            "energy_level_th": "กำลังดีและค่อย ๆ มั่นคง",
            "focus_area_th": "การงานและจังหวะการตัดสินใจ",
            "highlight_period_th": "ช่วงบ่ายถึงเย็น",
            "caution_th": "การรีบสรุปก่อนฟังใจตัวเองให้ครบ",
            "daily_advice_th": "ค่อย ๆ เลือกสิ่งสำคัญที่สุดหนึ่งอย่าง แล้วทำให้จบด้วยใจสงบ",
        }
        return SiamseeReadingResult(
            text=render_reading(fields) + "\n",
            fields=fields,
            predicted_condition=str(predict_result.get("predicted_condition", "")),
            condition_context=compact,
            siamsee_stick=resolved_stick,
            model=resolved_model,
        ).to_api_dict()

    api_key = os.getenv("OPENAI_API_KEY", "")
    if is_missing_or_mock_api_key(api_key):
        raise RuntimeError("OPENAI_API_KEY is missing or mock; Siamsee reading requires the LLM.")

    response = post_response(payload, api_key)
    output_text = extract_output_text(response)
    fields = json.loads(output_text)
    rendered = render_reading(fields)
    return SiamseeReadingResult(
        text=rendered + "\n",
        fields={k: str(v) for k, v in fields.items()},
        predicted_condition=str(predict_result.get("predicted_condition", "")),
        condition_context=compact,
        siamsee_stick=resolved_stick,
        model=resolved_model,
    )
