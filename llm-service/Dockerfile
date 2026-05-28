FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV HTTP_PORT=8000
ENV LLM_OUTPUT_DIR=/app/output

COPY pyproject.toml uv.lock ./
COPY src ./src

RUN uv sync --frozen --no-dev

RUN mkdir -p /app/output

EXPOSE 8000

CMD ["uv", "run", "--frozen", "llm-service"]
