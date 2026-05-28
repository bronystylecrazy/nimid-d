from __future__ import annotations

import base64
import os
from pathlib import Path

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from .palm_flow import run_palm_flow


class HealthResponse(BaseModel):
    status: str


class PalmReadingResponse(BaseModel):
    status: str
    message: str
    model: str
    llm_panel_png_base64: str
    reading: dict
    manifest: dict


app = FastAPI(title="Nimidd LLM Service", version="0.1.0")


def output_root() -> Path:
    return Path(os.getenv("LLM_OUTPUT_DIR", "/app/output"))


def env_file() -> Path | None:
    path = Path(os.getenv("LLM_ENV_FILE", "/app/.env.local"))
    return path if path.exists() else None


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.post("/palm-reading", response_model=PalmReadingResponse)
async def analyze_palm_image(
    image: UploadFile = File(...),
    dry_run: bool = Form(False),
    keep_all_images: bool = Form(False),
    model: str = Form(""),
) -> PalmReadingResponse:
    image_bytes = await image.read()
    try:
        result = run_palm_flow(
            image_bytes=image_bytes,
            filename=image.filename or "palm.png",
            output_root=output_root(),
            env_file=env_file(),
            model=model or None,
            dry_run=dry_run,
            keep_all_images=keep_all_images,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    import json

    return PalmReadingResponse(
        status=result["status"],
        message=result["message"],
        model=result["model"],
        llm_panel_png_base64=base64.b64encode(result["llm_panel_png"]).decode("ascii"),
        reading=json.loads(result["reading_json"]),
        manifest=json.loads(result["manifest_json"]),
    )


def main() -> None:
    port = int(os.getenv("HTTP_PORT", "8000"))
    host = os.getenv("HTTP_HOST", "0.0.0.0")
    print(f"[llm-service] REST API listening on {host}:{port}")
    uvicorn.run("llm_service.server:app", host=host, port=port)


if __name__ == "__main__":
    main()
