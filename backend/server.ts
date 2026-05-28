// @ts-nocheck
import { existsSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import mqtt from 'mqtt';

const port = Number(process.env.PORT || 80);
const staticDir = process.env.STATIC_DIR || join(process.cwd(), 'dist');
const mqttBrokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883';
const llmServiceUrl = process.env.LLM_SERVICE_URL || 'http://127.0.0.1:8000';
const mqttLogTopic = '#';
const mqttShakeTopic = 'v1/shake';
const mqttDetectionTopic = 'v1/detection';
const sockets = new Set();

function safeStaticPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0] || '/');
  const normalized = normalize(cleanPath).replace(/^(\.\.[/\\])+/, '');
  const relative = normalized === '/' ? '/index.html' : normalized;
  return join(staticDir, relative);
}

function staticResponse(req) {
  const url = new URL(req.url);
  const requestedPath = safeStaticPath(url.pathname);
  const filePath = existsSync(requestedPath) && statSync(requestedPath).isFile()
    ? requestedPath
    : join(staticDir, 'index.html');
  const headers = {
    'cache-control': filePath.includes('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  };
  return new Response(Bun.file(filePath), { headers });
}

function broadcast(event) {
  const payload = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
  }
}

function parsePayload(message) {
  try {
    return JSON.parse(message);
  } catch {
    return null;
  }
}

async function proxyPalmReading(req) {
  const formData = await req.formData();
  const response = await fetch(`${llmServiceUrl}/palm-reading`, {
    method: 'POST',
    body: formData,
  });
  const headers = new Headers(response.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function startMqttLogger() {
  const client = mqtt.connect(mqttBrokerUrl, {
    clientId: `nimidd_backend_${Math.random().toString(16).slice(2)}`,
    clean: true,
    connectTimeout: 5000,
    keepalive: 15,
    reconnectPeriod: 1000,
    resubscribe: true,
  });

  client.on('connect', () => {
    console.log(`[mqtt] connected ${mqttBrokerUrl}`);
    client.subscribe(mqttLogTopic, (err) => {
      if (err) console.error(`[mqtt] subscribe failed: ${err.message}`);
      else console.log(`[mqtt] logging topic ${mqttLogTopic}`);
    });
  });
  client.on('reconnect', () => console.log('[mqtt] reconnecting'));
  client.on('offline', () => console.warn('[mqtt] offline'));
  client.on('close', () => console.warn('[mqtt] closed'));
  client.on('error', (err) => console.error(`[mqtt] error: ${err.message}`));
  client.on('message', (topic, payload) => {
    const message = payload.toString();
    const data = parsePayload(message);
    const event = { topic, payload: message, data, at: new Date().toISOString() };

    if (topic === mqttShakeTopic) {
      console.log(`[mqtt:shake] topic=${topic} payload=${message}`);
      broadcast(event);
      return;
    }
    if (topic === mqttDetectionTopic) {
      console.log(`[mqtt:detection] seq=${data?.sequence_number ?? '-'} shaking=${data?.is_shaking ?? '-'} accel=(${data?.accel_x_g ?? '-'},${data?.accel_y_g ?? '-'},${data?.accel_z_g ?? '-'}) accel_euclidean=${data?.accel_euclidean_g ?? '-'} gyro=(${data?.gyro_x_dps ?? '-'},${data?.gyro_y_dps ?? '-'},${data?.gyro_z_dps ?? '-'}) gyro_magnitude=${data?.gyro_magnitude_dps ?? '-'}`);
      broadcast(event);
      return;
    }
    console.log(`[mqtt] ${topic}: ${message}`);
  });
}

startMqttLogger();

Bun.serve({
  port,
  hostname: '0.0.0.0',
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === '/events') {
      if (server.upgrade(req)) return;
      return new Response('WebSocket upgrade required', { status: 426 });
    }
    if (url.pathname === '/api/palm-reading') {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      return proxyPalmReading(req);
    }
    return staticResponse(req);
  },
  websocket: {
    open(socket) {
      sockets.add(socket);
      socket.send(JSON.stringify({
        type: 'status',
        topic: 'backend/status',
        payload: 'connected',
        at: new Date().toISOString(),
      }));
    },
    close(socket) {
      sockets.delete(socket);
    },
    message() {},
  },
});

console.log(`[server] listening on :${port}`);
console.log(`[server] static ${staticDir}`);
console.log(`[server] realtime websocket /events`);
console.log(`[server] mqtt broker ${mqttBrokerUrl}`);
console.log(`[server] llm service ${llmServiceUrl}`);
