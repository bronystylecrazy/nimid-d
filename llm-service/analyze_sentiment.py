from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


API_URL = "https://api.openai.com/v1/responses"
DEFAULT_MODEL = "gpt-5-mini"
DEFAULT_ENV_FILE = Path(__file__).with_name(".env.local")

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


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


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


def post_response(payload: dict[str, Any], api_key: str) -> dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        API_URL,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI API error {exc.code}: {error_body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"OpenAI API connection error: {exc.reason}") from exc


def extract_output_text(response: dict[str, Any]) -> str:
    if isinstance(response.get("output_text"), str):
        return response["output_text"]

    chunks: list[str] = []
    for item in response.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                chunks.append(content["text"])

    if not chunks:
        raise ValueError("No output_text found in API response")

    return "\n".join(chunks)


def clamp_score(value: int) -> int:
    return max(1, min(10, value))


def compute_final_score(feeling_now: int, wellbeing_now: int) -> int:
    raw_score = 0.45 * feeling_now + 0.55 * wellbeing_now
    return clamp_score(round(raw_score))


def is_missing_or_mock_api_key(api_key: str) -> bool:
    normalized = api_key.strip().lower()
    return not normalized or "mock" in normalized or "replace_me" in normalized


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analyze Thai wish sentiment with GPT-5 mini (two-axis + final score).",
    )
    parser.add_argument("--text", help="Thai text to analyze")
    parser.add_argument(
        "--env-file",
        type=Path,
        default=DEFAULT_ENV_FILE,
        help="Path to environment file",
    )
    parser.add_argument("--model", default=None, help=f"Defaults to OPENAI_MODEL or {DEFAULT_MODEL}")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Optional output JSON file path; prints to stdout if omitted",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Write/print API payload instead of calling the API",
    )
    return parser.parse_args()


def resolve_input_text(cli_text: str | None) -> str:
    if cli_text and cli_text.strip():
        return cli_text.strip()

    if not sys.stdin.isatty():
        stdin_text = sys.stdin.read().strip()
        if stdin_text:
            return stdin_text

    raise ValueError("Thai input text is required. Use --text or pipe text via stdin.")


def write_or_print_json(data: dict[str, Any], output_path: Path | None) -> None:
    serialized = json.dumps(data, ensure_ascii=False, indent=2)
    if output_path:
        output_path.write_text(serialized, encoding="utf-8")
        print(f"Wrote output JSON to {output_path}")
        return
    print(serialized)


def main() -> int:
    args = parse_args()
    load_env_file(args.env_file)

    try:
        input_text = resolve_input_text(args.text)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    model = args.model or os.getenv("OPENAI_MODEL") or DEFAULT_MODEL
    payload = build_payload(input_text, model)

    if args.dry_run:
        write_or_print_json(payload, args.output)
        return 0

    api_key = os.getenv("OPENAI_API_KEY", "")
    if is_missing_or_mock_api_key(api_key):
        print(
            "OPENAI_API_KEY is missing or still set to a mock value. "
            "Set it in your .env.local before a live API call.",
            file=sys.stderr,
        )
        return 2

    try:
        response = post_response(payload, api_key)
        output_text = extract_output_text(response)
        parsed_output = json.loads(output_text)
    except (RuntimeError, ValueError, json.JSONDecodeError) as exc:
        print(f"Sentiment analysis failed: {exc}", file=sys.stderr)
        return 1

    try:
        feeling_now = clamp_score(int(parsed_output["feeling_now"]))
        wellbeing_now = clamp_score(int(parsed_output["wellbeing_now"]))
        reason_th = str(parsed_output["reason_th"]).strip()
    except (KeyError, TypeError, ValueError) as exc:
        print(f"Invalid model output fields: {exc}", file=sys.stderr)
        return 1

    result = {
        "feeling_now": feeling_now,
        "wellbeing_now": wellbeing_now,
        "score": compute_final_score(feeling_now, wellbeing_now),
        "reason_th": reason_th,
    }
    write_or_print_json(result, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
