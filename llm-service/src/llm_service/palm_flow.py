from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from .call_gpt_palm_reader import (
    DEFAULT_MODEL,
    SYSTEM_PROMPT,
    USER_PROMPT,
    build_payload,
    extract_output_text,
    is_missing_or_mock_api_key,
    load_env_file,
    post_response,
)
from .preprocess_palm import preprocess_palm


def safe_slug(value: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "_", value.strip())
    return slug.strip("._-") or "palm"


def write_json(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def compact_image_outputs(image_outputs: dict[str, Path], output_dir: Path) -> dict[str, Path]:
    source_panel = image_outputs["llm_panel"]
    compact_panel = output_dir / "llm_panel.png"
    if source_panel.resolve() != compact_panel.resolve():
        shutil.copy2(source_panel, compact_panel)

    for name, path in image_outputs.items():
        if name == "llm_panel":
            continue
        if path.exists():
            path.unlink()

    if source_panel.exists() and source_panel.resolve() != compact_panel.resolve():
        source_panel.unlink()

    return {"llm_panel": compact_panel}


def run_palm_flow(
    *,
    image_bytes: bytes,
    filename: str,
    output_root: Path,
    env_file: Path | None,
    model: str | None,
    dry_run: bool,
    keep_all_images: bool,
) -> dict[str, Any]:
    if not image_bytes:
        raise ValueError("image bytes are required")

    suffix = Path(filename or "palm.png").suffix or ".png"
    stem = safe_slug(Path(filename or "palm").stem)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_id = f"{stem}_{timestamp}_{uuid.uuid4().hex[:8]}"
    output_dir = output_root / run_id
    output_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(prefix=f"{stem}_", suffix=suffix, delete=False) as tmp:
      tmp.write(image_bytes)
      input_path = Path(tmp.name)

    try:
        image_outputs = preprocess_palm(
            image_path=input_path,
            output_dir=output_dir,
            auto=True,
            auto_padding=0.08,
            palm_mask_erode=11,
            crop=None,
            mask_mode="none",
            ellipse_center=(0.54, 0.52),
            ellipse_axes=(0.45, 0.55),
            min_component_area=60,
            clip_limit=2.0,
            tile_grid_size=8,
            blackhat_kernel_size=21,
            threshold_block_size=31,
            threshold_c=-3,
        )
    finally:
        input_path.unlink(missing_ok=True)

    if not keep_all_images:
        image_outputs = compact_image_outputs(image_outputs, output_dir)

    panel_path = image_outputs["llm_panel"]
    if env_file is not None:
        load_env_file(env_file)
    resolved_model = model or os.getenv("OPENAI_MODEL") or DEFAULT_MODEL

    payload = build_payload(
        image_path=panel_path,
        model=resolved_model,
        system_prompt=SYSTEM_PROMPT,
        user_prompt=USER_PROMPT,
    )
    payload_path = output_dir / "openai_request_payload.json"
    write_json(payload_path, payload)

    manifest: dict[str, Any] = {
        "input_filename": filename,
        "output_dir": str(output_dir),
        "model": resolved_model,
        "dry_run": dry_run,
        "image_outputs": {name: str(path) for name, path in image_outputs.items()},
        "request_payload": str(payload_path),
    }

    reading: dict[str, Any] | None = None
    status = "dry_run_payload_written"
    message = "Preprocessing complete; dry-run payload written."

    if not dry_run:
        api_key = os.getenv("OPENAI_API_KEY", "")
        if is_missing_or_mock_api_key(api_key):
            status = "missing_or_mock_openai_api_key"
            message = "Preprocessing complete, but OPENAI_API_KEY is missing or mock."
        else:
            try:
                response = post_response(payload, api_key)
                output_text = extract_output_text(response)
                reading = json.loads(output_text)
                status = "complete"
                message = "Palm reading complete."
                write_json(output_dir / "palm_reading_response.json", reading)
            except Exception as exc:
                status = "openai_api_error"
                message = str(exc)

    manifest["status"] = status
    manifest["message"] = message
    manifest["llm_output"] = str(output_dir / "palm_reading_response.json") if reading is not None else None
    write_json(output_dir / "manifest.json", manifest)

    return {
        "status": status,
        "message": message,
        "model": resolved_model,
        "llm_panel_png": panel_path.read_bytes(),
        "reading_json": json.dumps(reading or {}, ensure_ascii=False),
        "manifest_json": json.dumps(manifest, ensure_ascii=False),
    }
