# syntax=docker/dockerfile:1

FROM --platform=$BUILDPLATFORM oven/bun:1.3.14 AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1.3.14

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80
ENV STATIC_DIR=/app/dist
ENV MQTT_BROKER_URL=mqtt://127.0.0.1:1883
ENV DB_PATH=/app/data/nimidd.sqlite
ENV UPLOAD_DIR=/app/data/uploads

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY backend ./backend
COPY --from=build /app/dist ./dist

EXPOSE 80
VOLUME ["/app/data"]

CMD ["bun", "run", "start"]
