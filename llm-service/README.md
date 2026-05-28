# Nimidd LLM Service

Python REST service for palm image preprocessing and structured palm reading.

## Run Locally

```bash
cd llm-service
uv run llm-service
```

The server listens on `0.0.0.0:8000` by default.

## Endpoints

- `GET /health`
- `POST /palm-reading`
- `POST /sentiment`

Example:

```bash
curl -X POST http://127.0.0.1:8000/palm-reading \
  -F "image=@../ocr/Photo on 27-5-2569 BE at 14.06.jpg" \
  -F "dry_run=true"
```

The response includes:

- `status`
- `message`
- `model`
- `llm_panel_png_base64`
- `reading`
- `manifest`

Sentiment example:

```bash
curl -X POST http://127.0.0.1:8000/sentiment \
  -H "content-type: application/json" \
  -d '{
    "pre_feeling": "วันนี้รู้สึกกังวลเรื่องงาน",
    "pre_moods": ["กังวล"],
    "post_feeling": "รู้สึกโล่งใจขึ้นและได้คำตอบ",
    "post_moods": ["โล่งใจ", "ได้รับคำตอบ"]
  }'
```

## Environment

- `OPENAI_API_KEY`: required for live OpenAI calls.
- `OPENAI_MODEL`: optional, defaults to the model from the copied OCR flow.
- `HTTP_PORT`: optional, defaults to `8000`.
- `LLM_OUTPUT_DIR`: optional, defaults to `/app/output` in Docker.
