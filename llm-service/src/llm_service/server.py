from __future__ import annotations

import base64
import os
from pathlib import Path

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from .analyze_sentiment import analyze_wish_sentiment
from .call_gpt_palm_reader import load_env_file
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


class SentimentRequest(BaseModel):
    text: str = ""
    dry_run: bool = False
    model: str = ""


class SentimentResponse(BaseModel):
    status: str
    message: str
    model: str
    feeling_now: int
    wellbeing_now: int
    score: int
    reason_th: str


app = FastAPI(title="Nimidd LLM Service", version="0.1.0")


def bootstrap_env() -> None:
    path = env_file()
    if path is not None:
        load_env_file(path)


def output_root() -> Path:
    return Path(os.getenv("LLM_OUTPUT_DIR", "/app/output"))


def env_file() -> Path | None:
    candidates = [
        Path(os.getenv("LLM_ENV_FILE", "")) if os.getenv("LLM_ENV_FILE") else None,
        Path.cwd() / ".env.local",
        Path("/app/.env.local"),
    ]
    for path in candidates:
        if path is not None and path.exists():
            return path
    return None


bootstrap_env()


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.post("/palm-reading", response_model=PalmReadingResponse)
async def analyze_palm_image(
    image: UploadFile = File(...),
    dry_run: bool = Form(False),
    keep_all_images: bool = Form(False),
    keep_payload: bool = Form(False),
    keep_raw_response: bool = Form(False),
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
            keep_payload=keep_payload,
            keep_raw_response=keep_raw_response,
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


@app.post("/sentiment", response_model=SentimentResponse)
def analyze_sentiment(request: SentimentRequest) -> SentimentResponse:
    try:
        result = analyze_wish_sentiment(
            text=request.text,
            env_file=env_file(),
            model=request.model or None,
            dry_run=request.dry_run,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return SentimentResponse(**result)


def main() -> None:
    bootstrap_env()
    port = int(os.getenv("HTTP_PORT", "8000"))
    host = os.getenv("HTTP_HOST", "0.0.0.0")
    print(f"[llm-service] REST API listening on {host}:{port}")
    uvicorn.run("llm_service.server:app", host=host, port=port)


if __name__ == "__main__":
    main()
