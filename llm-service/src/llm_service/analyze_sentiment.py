from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from .call_gpt_palm_reader import (
    DEFAULT_MODEL,
    extract_output_text,
    is_missing_or_mock_api_key,
    load_env_file,
    post_response,
)


SYSTEM_PROMPT = """
คุณคือระบบวิเคราะห์ sentiment ภาษาไทยสำหรับพิธีเสี่ยงเซียมซีในแอป Nimidd
ให้วิเคราะห์ "ความรู้สึกก่อนพิธี" และ "ความรู้สึกหลังพิธี" จากข้อความภาษาไทยและ mood chips ที่ผู้ใช้เลือก

คำถามก่อนพิธี:
"ก่อนเริ่มพิธี ตอนนี้คุณรู้สึกอย่างไร?"

คำถามหลังพิธี:
"หลังจากเสี่ยงเซียมซีแล้ว"

หลักการประเมิน:
- score อยู่ระหว่าง 0-100 โดย 0 คือทุกข์/กังวลสูงมาก, 50 คือกลางหรือปนกัน, 100 คือสงบ/โล่งใจ/มีหวังสูงมาก
- ให้ข้อความ free text มีน้ำหนักมากกว่า mood chips ถ้าขัดแย้งกัน
- ก่อนพิธีให้ดูสภาวะใจปัจจุบัน ไม่ใช่แค่ความหวังในอนาคต
- หลังพิธีให้ประเมินว่าผู้ใช้โล่งขึ้น ได้คำตอบ สงบขึ้น หรือยังติดค้างอยู่
- ห้ามวินิจฉัยโรค ห้ามอ้างว่าเป็นคำแนะนำทางการแพทย์
- reason_th และ summary_th ต้องเป็นภาษาไทย สั้น ชัด ไม่เกิน 30 คำต่อช่อง
- ตอบเป็น JSON เท่านั้นตาม schema
""".strip()

USER_PROMPT_TEMPLATE = """
วิเคราะห์ sentiment ของผู้ใช้จากข้อมูลนี้:

ก่อนพิธี:
- คำถาม: ก่อนเริ่มพิธี ตอนนี้คุณรู้สึกอย่างไร?
- ข้อความ: {pre_feeling}
- mood chips: {pre_moods}

หลังพิธี:
- คำถาม: หลังจากเสี่ยงเซียมซีแล้ว
- ข้อความ: {post_feeling}
- mood chips: {post_moods}

ให้เปรียบเทียบก่อน/หลัง และตอบตาม JSON schema เท่านั้น
""".strip()

SENTIMENT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "pre": {
            "type": "object",
            "properties": {
                "score": {"type": "integer", "minimum": 0, "maximum": 100},
                "label": {"type": "string", "enum": ["negative", "mixed", "positive"]},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "reason_th": {"type": "string"},
            },
            "required": ["score", "label", "confidence", "reason_th"],
            "additionalProperties": False,
        },
        "post": {
            "type": "object",
            "properties": {
                "score": {"type": "integer", "minimum": 0, "maximum": 100},
                "label": {"type": "string", "enum": ["negative", "mixed", "positive"]},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "reason_th": {"type": "string"},
            },
            "required": ["score", "label", "confidence", "reason_th"],
            "additionalProperties": False,
        },
        "delta": {"type": "integer", "minimum": -100, "maximum": 100},
        "trend": {"type": "string", "enum": ["improved", "stable", "declined"]},
        "summary_th": {"type": "string"},
    },
    "required": ["pre", "post", "delta", "trend", "summary_th"],
    "propertyOrdering": ["pre", "post", "delta", "trend", "summary_th"],
    "additionalProperties": False,
}


def normalize_moods(moods: list[str] | None) -> list[str]:
    return [str(mood).strip() for mood in (moods or []) if str(mood).strip()]


def build_payload(
    *,
    pre_feeling: str,
    pre_moods: list[str],
    post_feeling: str,
    post_moods: list[str],
    model: str,
) -> dict[str, Any]:
    user_prompt = USER_PROMPT_TEMPLATE.format(
        pre_feeling=(pre_feeling or "").strip() or "(ไม่ได้กรอก)",
        pre_moods=", ".join(pre_moods) or "(ไม่ได้เลือก)",
        post_feeling=(post_feeling or "").strip() or "(ไม่ได้กรอก)",
        post_moods=", ".join(post_moods) or "(ไม่ได้เลือก)",
    )
    return {
        "model": model,
        "input": [
            {"role": "system", "content": [{"type": "input_text", "text": SYSTEM_PROMPT}]},
            {"role": "user", "content": [{"type": "input_text", "text": user_prompt}]},
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "nimidd_ritual_sentiment_response",
                "strict": True,
                "schema": SENTIMENT_SCHEMA,
            }
        },
    }


def analyze_ritual_sentiment(
    *,
    pre_feeling: str = "",
    pre_moods: list[str] | None = None,
    post_feeling: str = "",
    post_moods: list[str] | None = None,
    env_file: Path | None = None,
    model: str | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    if env_file is not None:
        load_env_file(env_file)

    resolved_model = model or os.getenv("OPENAI_MODEL") or DEFAULT_MODEL
    payload = build_payload(
        pre_feeling=pre_feeling,
        pre_moods=normalize_moods(pre_moods),
        post_feeling=post_feeling,
        post_moods=normalize_moods(post_moods),
        model=resolved_model,
    )

    if dry_run:
        return {
            "status": "dry_run_payload",
            "message": "Sentiment request payload generated.",
            "model": resolved_model,
            "payload": payload,
            "pre": {"score": 50, "label": "mixed", "confidence": 0, "reason_th": "dry run"},
            "post": {"score": 50, "label": "mixed", "confidence": 0, "reason_th": "dry run"},
            "delta": 0,
            "trend": "stable",
            "summary_th": "dry run",
        }

    api_key = os.getenv("OPENAI_API_KEY", "")
    if is_missing_or_mock_api_key(api_key):
        raise RuntimeError("OPENAI_API_KEY is missing or mock; sentiment analysis requires the LLM.")

    response = post_response(payload, api_key)
    output_text = extract_output_text(response)
    parsed = json.loads(output_text)
    parsed["status"] = "complete"
    parsed["message"] = "Sentiment analysis complete."
    parsed["model"] = resolved_model
    return parsed
