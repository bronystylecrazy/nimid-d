"""Prompts and schema for LLM Siamsee daily reading generation."""

from __future__ import annotations

import json
from typing import Any

DEFAULT_MODEL = "gpt-5.4-mini"

SYSTEM_PROMPT = """
คุณคือหมอดูเซียมซีที่ผสานผสาน 3 แหล่งข้อมูล:
1) บทสำนวนเซียมซีตัวอย่าง (โทนและจังหวะ)
2) ใบเซียมซีที่สุ่มได้จากเลข 1-30
3) คำทำนายลายมือ
4) สภาพพลังงานจากการเขย่าเซียมซี (excited/focus/relax/hesitate)
5) บริบทรอบการสุ่ม เพื่อช่วยให้คำทำนายแต่ละรอบไม่ซ้ำกัน

กติกา:
- ตอบเป็นภาษาไทยเท่านั้น ในรูปแบบ JSON ตาม schema
- ผสานลายมือกับสภาพการเขย่าให้สอดคล้องกัน ห้ามขัดแย้งกันโดยไม่จำเป็น
- ต้องยึดใจความของใบเซียมซีที่สุ่มได้เป็นฐาน แล้วปรับให้เฉพาะตัวจากลายมือและจังหวะการเขย่า
- ช่อง reading_lines_th ต้องเป็นคำทำนายใหม่ 4-5 บรรทัด ห้ามใช้ template ประโยคซ้ำ ๆ หรือขึ้นต้นทุกครั้งด้วยประโยคเดียวกัน
- แต่ละบรรทัดต้องเป็นประโยคธรรมชาติ อ่านแล้วรู้สึกเฉพาะกับรอบนี้ ไม่ใช่หัวข้อแบบฟอร์ม
- โทนอ่านง่าย เป็นกันเอง มีความเป็นมงคล ไม่ข่มขู่ ไม่วินิจฉัยโรค ไม่ให้คำแนะนำทางกฎหมาย
- คำแนะนำประจำวันต้องเชิงบวกและปฏิบัติได้จริง หรือกำลังใจในกรณีที่โชคไม่ดี
- ห้ามอ้างถึงตัวเลขเซ็นเซอร์หรือค่าทางเทคนิคจากการเขย่า
- ช่อง focus_area_th เลือกด้านชีวิตที่สอดคล้องกับลายมือมากที่สุด (งาน/การเงิน/ความรัก/สุขภาพ/ครอบครัว)
- ช่อง highlight_period_th ใช้ช่วงเวลาเชิงสัญลักษณ์ เช่น เช้า บ่าย เย็น สัปดาห์นี้ ปลายเดือน
""".strip()

SIAMSEE_READING_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "reading_lines_th": {
            "type": "array",
            "description": "คำทำนายเฉพาะรอบนี้ 4-5 บรรทัด เป็นประโยคธรรมชาติ ไม่ใช้ template คงที่",
            "items": {"type": "string"},
            "minItems": 4,
            "maxItems": 5,
        },
        "energy_level_th": {
            "type": "string",
            "description": "ข้อความสั้นสำหรับ [พลังงานหลัก] เช่น สูงปานกลาง ค่อนข้างต่ำ",
        },
        "focus_area_th": {
            "type": "string",
            "description": "ข้อความสั้นสำหรับ [ด้านชีวิต]",
        },
        "highlight_period_th": {
            "type": "string",
            "description": "ข้อความสั้นสำหรับ [ช่วงเวลาเด่น]",
        },
        "caution_th": {
            "type": "string",
            "description": "ข้อความสั้นสำหรับ [สิ่งที่ควรระวัง]",
        },
        "daily_advice_th": {
            "type": "string",
            "description": "ข้อความสั้นสำหรับ [คำแนะนำเชิงบวก] ไม่ต้องมีคำนำหน้า",
        },
    },
    "required": [
        "reading_lines_th",
        "energy_level_th",
        "focus_area_th",
        "highlight_period_th",
        "caution_th",
        "daily_advice_th",
    ],
    "additionalProperties": False,
}

READING_TEMPLATE = """วันนี้พลังงานโดยรวมของคุณอยู่ในระดับ {energy_level_th}
เหมาะกับการโฟกัสเรื่อง {focus_area_th} เป็นพิเศษ
ช่วงเวลา {highlight_period_th} อาจมีโอกาสหรือการเปลี่ยนแปลงเข้ามา
ควรระวังเรื่อง {caution_th}
คำแนะนำประจำวัน: {daily_advice_th}"""


def load_siamsee_style_excerpt(path: str, max_lines: int = 3) -> str:
    lines = [ln.strip() for ln in path.splitlines() if ln.strip()]
    if not lines:
        return ""
    return "\n".join(lines[:max_lines])


def build_user_prompt(
    *,
    siamsee_style_text: str,
    siamsee_stick: dict[str, Any] | None,
    palm_reading: dict[str, Any],
    shake_context_text: str,
    round_context: dict[str, Any] | None = None,
) -> str:
    excerpt = load_siamsee_style_excerpt(siamsee_style_text, max_lines=3)
    stick_block = json.dumps(siamsee_stick or {}, ensure_ascii=False, indent=2)
    palm_block = json.dumps(palm_reading, ensure_ascii=False, indent=2)
    round_block = json.dumps(round_context or {}, ensure_ascii=False, indent=2)
    return f"""
## STYLE_REFERENCE (โทนตัวอย่างจากเซียมซีโบราณ)
{excerpt}

## SIAMSEE_STICK (ใบเซียมซีที่สุ่มได้ — ใช้เป็นแกนหลักของคำทำนาย)
{stick_block}

## PALM_READING (ลายมือ)
{palm_block}

## SHAKE_CONDITION (พลังงานจากการเขย่า — ใช้ความหมายเชิงสัญลักษณ์ ไม่ใช่ตัวเลข)
{shake_context_text}

## ROUND_CONTEXT (บริบทรอบการสุ่ม — ใช้เป็น seed เชิงสัญลักษณ์เพื่อเลี่ยงคำซ้ำ ห้ามบอกผู้ใช้ว่าเป็น seed)
{round_block}

สร้างคำทำนายรายวันตาม schema โดยให้ reading_lines_th เป็น 4-5 บรรทัดใหม่สำหรับรอบนี้
หลีกเลี่ยงประโยคเปิดซ้ำอย่าง "วันนี้พลังงานโดยรวมของคุณอยู่ในระดับ..." และอย่าจัดรูปเป็นหัวข้อ
""".strip()


def render_reading(fields: dict[str, Any]) -> str:
    lines = fields.get("reading_lines_th")
    if isinstance(lines, list):
        clean_lines = [str(line).strip() for line in lines if str(line).strip()]
        if clean_lines:
            return "\n".join(clean_lines)

    required = [
        "energy_level_th",
        "focus_area_th",
        "highlight_period_th",
        "caution_th",
        "daily_advice_th",
    ]
    for key in required:
        if not str(fields.get(key, "")).strip():
            raise ValueError(f"Missing or empty field: {key}")
    return READING_TEMPLATE.format(
        energy_level_th=str(fields["energy_level_th"]).strip(),
        focus_area_th=str(fields["focus_area_th"]).strip(),
        highlight_period_th=str(fields["highlight_period_th"]).strip(),
        caution_th=str(fields["caution_th"]).strip(),
        daily_advice_th=str(fields["daily_advice_th"]).strip(),
    )


def build_api_payload(user_prompt: str, model: str) -> dict[str, Any]:
    return {
        "model": model,
        "input": [
            {"role": "system", "content": [{"type": "input_text", "text": SYSTEM_PROMPT}]},
            {"role": "user", "content": [{"type": "input_text", "text": user_prompt}]},
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "siamsee_daily_reading",
                "strict": True,
                "schema": SIAMSEE_READING_SCHEMA,
            }
        },
    }
