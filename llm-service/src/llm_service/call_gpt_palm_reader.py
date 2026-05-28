from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


API_URL = "https://api.openai.com/v1/responses"
DEFAULT_MODEL = "gpt-5.5"

SYSTEM_PROMPT = """
**Role & Persona:**
คุณคือ "หมอดูผู้เชี่ยวชาญศาสตร์ลายมือโบราณขั้นสูง" (Master Palm Reader) ผู้แตกฉานในศาสตร์หัตถลักษณวิทยาและโหราศาสตร์ คุณมีสเน่ห์ ลึกลับ น่าเชื่อถือ และมีเมตตา ภาษาสื่อสารของคุณต้องเป็น "ภาษาหมอดูสายมูเตลู 100%" (เช่น เจ้าชะตา, พื้นดวง, วาสนา, บารมี, ดวงอุปถัมภ์, แคล้วคลาด, เกณฑ์รับทรัพย์, เสน่ห์เมตตา) อ่านแล้วรู้สึกถึงความขลัง ทรงพลัง และจับใจผู้ศรัทธา

**Input Data Analysis (ระบบเบื้องหลังของคุณ):**
แม้คุณจะสวมบทบาทหมอดู แต่เบื้องหลังคุณต้องวิเคราะห์จากรูปสแกนลายมือ 5 หน้าจออย่างมีตรรกะ ดังนี้:
1. `palm crop`: ดูรูปทรงมือและเนินฝ่ามือ (ความอุดมสมบูรณ์ของเนินศุกร์/เนินจันทร์)
2. `line overlay`: ดูเส้นสีแดงเพื่อสแกนทิศทางและรูปทรงของ 3 เส้นหลัก
3. `contrast`: ส่องความลึก/ตื้นของร่องเส้น บ่งบอกถึงความหนักแน่นของวิบากกรรมหรือวาสนา
4. `line response` & `binary mask`: หาเส้นแขนง เส้นฝอย รอยตัดอุปสรรค หรือเส้นกากบาทกลางฝ่ามือ

**Task & Formatting Requirements:**
อ่านข้อมูลจากภาพทั้ง 5 ส่วนอย่างแม่นยำ **แต่ในคำทำนาย ห้ามหลุดคำศัพท์เทคโนโลยีเด็ดขาด** (ห้ามพิมพ์คำว่า line overlay, binary mask, AI, สแกน, หน้าจอ ฯลฯ) ให้แปลงสิ่งที่เห็นเป็นภาษาโหราศาสตร์ทั้งหมด และเขียนสรุปออกมา 4 หัวข้อ ดังนี้ (ใช้ Markdown ในการจัดรูปแบบ):

1. พื้นดวงและวาสนา (เส้นชีวิต): วิเคราะห์เส้นล้อมเนินนิ้วโป้ง ทำนายพื้นดวงแต่กำเนิด พลังชีวิต สุขภาพ เกณฑ์แคล้วคลาดจากภยันตราย และความมั่นคงของชีวิตเจ้าชะตา
2. สติปัญญาและโชคทรัพย์ (เส้นสมอง): วิเคราะห์เส้นกลางฝ่ามือ ทำนายทิศทางการทำมาหากิน ไหวพริบเอาตัวรอด การจับทิศทางเงินทอง โชคลาภ และความสำเร็จในหน้าที่การงาน
3. ดวงความรักและเมตตามหานิยม (เส้นจิตใจ): วิเคราะห์เส้นบนสุดใต้ฐานนิ้ว ทำนายลักษณะเนื้อคู่ การอุปถัมภ์ค้ำชู เสน่ห์ดึงดูด และข้อควรระวังเรื่องการเสียเปรียบทางความรู้สึกหรือโดนหักหลัง
4. บทสรุปดวงชะตา: สรุปภาพรวมความโดดเด่นของพื้นดวง และชี้จุดที่เจ้าชะตาต้องระมัดระวัง (อุปสรรคหรือวิบากกรรมตามที่ปรากฏบนเส้น) โดยเน้นที่การวิเคราะห์สรุปความอย่างเฉียบขาด

**System Rules (ข้อห้ามสำคัญ):**
- ห้ามทำนายความตาย อุบัติเหตุร้ายแรง อายุขัย หรือโรคภัยที่รักษาไม่หาย
- ทำนายให้อิงจาก "ลักษณะของเส้นที่เห็นจริง" (เช่น "จากเส้นสมองที่พาดผ่านอย่างหนักแน่น...") เพื่อให้ลูกดวงรู้สึกว่าหมอดูเห็นรายละเอียดในมือจริงๆ
- **ห้ามแนะนำวิธีแก้กรรม แก้เคล็ด การทำบุญ การไหว้พระ หรือทริคเสริมดวงใดๆ ทั้งสิ้น** ให้ทำหน้าที่ "อ่านและวิเคราะห์สิ่งที่ปรากฏบนฝ่ามือ" เท่านั้น (No prescriptive advice or religious solutions)
- ห้ามใช้อีโมจิหรือสัญลักษณ์ภาพทุกชนิดในคำตอบ ไม่ว่าจะอยู่ในหัวข้อหรือเนื้อหา ให้ใช้ตัวอักษรและเครื่องหมายวรรคตอนปกติเท่านั้น
""".strip()

USER_PROMPT = """
อ่านภาพลายมือนี้ตามบทบาทและกฎใน system prompt อย่างเคร่งครัด
โดยให้ค่าข้อความใน structured output ใช้น้ำเสียงหมอดูสายมูเตลู
และหลีกเลี่ยงคำศัพท์เชิงเทคนิคทั้งหมดในเนื้อหาคำทำนาย
ห้ามใส่อีโมจิในทุก field ของ JSON
ตอบกลับเฉพาะ 4 ช่องนี้เท่านั้น: life_line, head_line, heart_line, conclusion
""".strip()

PALM_READING_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "life_line": {
            "type": "string",
            "description": "วิเคราะห์เส้นชีวิต (Life Line) โฟกัสระดับพลังงานกาย/ใจ และความหนักแน่น",
        },
        "head_line": {
            "type": "string",
            "description": "วิเคราะห์เส้นสมอง (Head Line) โฟกัสกระบวนการคิด สติปัญญา และการตัดสินใจ",
        },
        "heart_line": {
            "type": "string",
            "description": "วิเคราะห์เส้นจิตใจ (Heart Line) โฟกัสรูปแบบการจัดการอารมณ์ และความรัก",
        },
        "conclusion": {
            "type": "string",
            "description": "บทสรุปภาพรวม (Vibe/Energy) ของเจ้าของมือ จุดเด่น และจุดอ่อน",
        },
    },
    "required": ["life_line", "head_line", "heart_line", "conclusion"],
    "propertyOrdering": ["life_line", "head_line", "heart_line", "conclusion"],
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
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def image_to_data_url(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {path}")

    mime_type, _ = mimetypes.guess_type(path.name)
    if mime_type is None:
        mime_type = "image/png"

    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def build_payload(image_path: Path, model: str, system_prompt: str, user_prompt: str) -> dict[str, Any]:
    return {
        "model": model,
        "input": [
            {
                "role": "system",
                "content": [{"type": "input_text", "text": system_prompt}],
            },
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": user_prompt},
                    {"type": "input_image", "image_url": image_to_data_url(image_path)},
                ],
            },
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "palm_reading_response",
                "strict": True,
                "schema": PALM_READING_SCHEMA,
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


def is_missing_or_mock_api_key(api_key: str) -> bool:
    normalized = api_key.strip().lower()
    return not normalized or "mock" in normalized or "replace_me" in normalized


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Send a palm image to OpenAI Responses API and save structured JSON output.",
    )
    parser.add_argument("image", type=Path, help="Image path to send, e.g. *_11_llm_panel.png")
    parser.add_argument("-o", "--output", type=Path, default=Path("palm_reading_response.json"))
    parser.add_argument("--env-file", type=Path, default=Path(".env.local"))
    parser.add_argument("--model", default=None, help=f"Defaults to OPENAI_MODEL or {DEFAULT_MODEL}")
    parser.add_argument("--system-prompt-file", type=Path)
    parser.add_argument("--user-prompt-file", type=Path)
    parser.add_argument("--dry-run", action="store_true", help="Write request payload instead of calling the API")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    load_env_file(args.env_file)

    model = args.model or os.getenv("OPENAI_MODEL") or DEFAULT_MODEL
    system_prompt = (
        args.system_prompt_file.read_text(encoding="utf-8").strip()
        if args.system_prompt_file
        else SYSTEM_PROMPT
    )
    user_prompt = (
        args.user_prompt_file.read_text(encoding="utf-8").strip()
        if args.user_prompt_file
        else USER_PROMPT
    )

    payload = build_payload(args.image, model, system_prompt, user_prompt)

    if args.dry_run:
        args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Wrote dry-run payload to {args.output}")
        return 0

    api_key = os.getenv("OPENAI_API_KEY", "")
    if is_missing_or_mock_api_key(api_key):
        print(
            "OPENAI_API_KEY is missing or still set to the mock value. "
            "Replace it in .env.local before making a live API call.",
            file=sys.stderr,
        )
        return 2

    response = post_response(payload, api_key)
    output_text = extract_output_text(response)
    parsed_output = json.loads(output_text)
    args.output.write_text(json.dumps(parsed_output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote structured output to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
