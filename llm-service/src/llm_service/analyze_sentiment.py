from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from .call_gpt_palm_reader import (
    extract_output_text,
    is_missing_or_mock_api_key,
    load_env_file,
    post_response,
)


DEFAULT_SENTIMENT_MODEL = "gpt-5-mini"

SYSTEM_PROMPT = """
คุณคือผู้ประเมินอารมณ์และคุณภาพชีวิตปัจจุบันจากข้อความอธิษฐานภาษาไทย
ให้ประเมิน "สภาพปัจจุบัน" ไม่ใช่ "ความหวังในอนาคต" เพียงอย่างเดียว

วิเคราะห์ 2 แกน:
1) feeling_now (1-10): สภาพอารมณ์ของผู้เขียนในปัจจุบัน
2) wellbeing_now (1-10): สภาพความเป็นอยู่ของผู้เขียนในปัจจุบัน

เกณฑ์ feeling_now:
- 1-3: ทุกข์หนัก วิตกสูง หมดแรงใจ/กลัวชัดเจน
- 4-6: มีความกังวล กดดัน หรืออารมณ์ปนกัน
- 7-8: โดยรวมสงบ/มีหวัง มีปัญหาแต่รับมือได้
- 9-10: มั่นคงทางอารมณ์อย่างชัดเจน

เกณฑ์ wellbeing_now:
- 1-3: ความเป็นอยู่ลำบากชัดเจน (สุขภาพ/การเงิน/งาน/ความสัมพันธ์)
- 4-6: ยังมีข้อจำกัดหรือไม่มั่นคงระดับกลาง
- 7-8: โดยรวมค่อนข้างมั่นคง
- 9-10: มั่นคงและเอื้อต่อชีวิตอย่างชัดเจน

กติกาเพิ่มเติมสำหรับข้อความอธิษฐาน:
- ถ้ามีสัญญาณว่ากำลังทุกข์อยู่ตอนนี้ เช่น "ไม่อยากทรมาน", "ไม่ลำบากเหมือนที่ผ่านมา" ให้ประเมินปัจจุบันเป็นค่าต่ำ-กลางตามหลักฐาน
- ถ้าข้อความสะท้อนว่าปัจจุบันดีอยู่แล้วแต่ขอให้ดียิ่งขึ้น ให้ประเมินช่วงกลางสูง-สูง
- ห้ามให้คะแนนสูงเพียงเพราะถ้อยคำเชิงความหวังในอนาคต
- ต้องอิงหลักฐานจากข้อความเท่านั้น ห้ามเดาเกินข้อมูล

ให้ตอบเป็น JSON เท่านั้นตาม schema ที่กำหนด
- reason_th ต้องเป็นภาษาไทย 1 ประโยคสั้น ไม่เกิน 30 คำ
""".strip()

USER_PROMPT_TEMPLATE = """
วิเคราะห์ข้อความอธิษฐานนี้ตามกติกาอย่างเคร่งครัด:
"{text}"
""".strip()

SENTIMENT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "feeling_now": {"type": "integer", "minimum": 1, "maximum": 10},
        "wellbeing_now": {"type": "integer", "minimum": 1, "maximum": 10},
        "reason_th": {
            "type": "string",
            "description": "เหตุผลภาษาไทยสั้น 1 ประโยค ไม่เกิน 30 คำ",
        },
    },
    "required": ["feeling_now", "wellbeing_now", "reason_th"],
    "propertyOrdering": ["feeling_now", "wellbeing_now", "reason_th"],
    "additionalProperties": False,
}


def build_payload(text: str, model: str) -> dict[str, Any]:
    user_prompt = USER_PROMPT_TEMPLATE.format(text=text.strip())
    return {
        "model": model,
        "input": [
            {"role": "system", "content": [{"type": "input_text", "text": SYSTEM_PROMPT}]},
            {"role": "user", "content": [{"type": "input_text", "text": user_prompt}]},
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "thai_sentiment_two_axis_response",
                "strict": True,
                "schema": SENTIMENT_SCHEMA,
            }
        },
    }


def clamp_score(value: int) -> int:
    return max(1, min(10, value))


def compute_final_score(feeling_now: int, wellbeing_now: int) -> int:
    raw_score = 0.45 * feeling_now + 0.55 * wellbeing_now
    return clamp_score(round(raw_score))


def analyze_wish_sentiment(
    *,
    text: str,
    env_file: Path | None = None,
    model: str | None = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    input_text = text.strip()
    if not input_text:
        raise ValueError("text is required")

    if env_file is not None:
        load_env_file(env_file)

    resolved_model = model or os.getenv("OPENAI_SENTIMENT_MODEL") or DEFAULT_SENTIMENT_MODEL
    payload = build_payload(input_text, resolved_model)

    if dry_run:
        return {
            "status": "dry_run_payload",
            "message": "Sentiment request payload generated.",
            "model": resolved_model,
            "payload": payload,
            "feeling_now": 5,
            "wellbeing_now": 5,
            "score": 5,
            "reason_th": "dry run",
        }

    api_key = os.getenv("OPENAI_API_KEY", "")
    if is_missing_or_mock_api_key(api_key):
        raise RuntimeError("OPENAI_API_KEY is missing or mock; sentiment analysis requires the LLM.")

    response = post_response(payload, api_key)
    output_text = extract_output_text(response)
    parsed = json.loads(output_text)
    feeling_now = clamp_score(int(parsed["feeling_now"]))
    wellbeing_now = clamp_score(int(parsed["wellbeing_now"]))
    return {
        "status": "complete",
        "message": "Sentiment analysis complete.",
        "model": resolved_model,
        "feeling_now": feeling_now,
        "wellbeing_now": wellbeing_now,
        "score": compute_final_score(feeling_now, wellbeing_now),
        "reason_th": str(parsed["reason_th"]).strip(),
    }
