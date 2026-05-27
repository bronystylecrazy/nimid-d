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
ENV MQTT_BROKER_URL=mqtt://mqtt:1883
ENV MQTT_WS_TARGET=http://mqtt:9001

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY backend ./backend
COPY --from=build /app/dist ./dist

EXPOSE 80

CMD ["bun", "run", "start"]
