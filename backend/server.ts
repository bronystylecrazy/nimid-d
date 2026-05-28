// @ts-nocheck
import { existsSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import mqtt from 'mqtt';
import { openAppDb } from './db';

const port = Number(process.env.PORT || 80);
const staticDir = process.env.STATIC_DIR || join(process.cwd(), 'dist');
const mqttBrokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://127.0.0.1:1883';
const llmServiceUrl = process.env.LLM_SERVICE_URL || 'http://127.0.0.1:8000';
const mqttLogTopic = '#';
const mqttShakeTopic = 'v1/shake';
const mqttDetectionTopic = 'v1/detection';
const sockets = new Set();
const appDb = openAppDb();
const palmReadingJobs = new Map();
const palmReadingJobTtlMs = 30 * 60 * 1000;

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

async function postPalmReadingToLlm({ imageBytes, filename, mimeType, dryRun }) {
  const formData = new FormData();
  formData.append('image', new Blob([imageBytes], { type: mimeType || 'image/jpeg' }), filename || 'palm.jpg');
  formData.append('dry_run', dryRun ? 'true' : 'false');

  const response = await fetch(`${llmServiceUrl}/palm-reading`, {
    method: 'POST',
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.message || `Palm reading failed: ${response.status}`);
  }
  return payload;
}

function palmReadingJobSnapshot(job) {
  return {
    jobId: job.id,
    status: job.status,
    dryRun: job.dryRun,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    result: job.result || null,
    error: job.error || '',
  };
}

function cleanupPalmReadingJobs() {
  const cutoff = Date.now() - palmReadingJobTtlMs;
  for (const [jobId, job] of palmReadingJobs) {
    if (Date.parse(job.updatedAt || job.createdAt) < cutoff) palmReadingJobs.delete(jobId);
  }
}

function updatePalmReadingJob(job, patch) {
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  broadcast({
    type: 'palm-reading-job',
    topic: `palm-reading/jobs/${job.id}`,
    data: palmReadingJobSnapshot(job),
    at: new Date().toISOString(),
  });
}

function runPalmReadingJob(job) {
  queueMicrotask(async () => {
    updatePalmReadingJob(job, { status: 'running' });
    try {
      const result = await postPalmReadingToLlm(job.input);
      updatePalmReadingJob(job, { status: 'complete', result, error: '' });
    } catch (error) {
      updatePalmReadingJob(job, {
        status: 'error',
        error: error?.message || 'อ่านลายมือไม่สำเร็จ',
      });
    } finally {
      cleanupPalmReadingJobs();
    }
  });
}

async function createPalmReadingJob(req) {
  let formData;
  try {
    formData = await req.formData();
  } catch {
    return jsonResponse({ message: 'multipart form-data is required' }, { status: 400 });
  }
  const image = formData.get('image');
  if (!image || typeof image === 'string' || typeof image.arrayBuffer !== 'function') {
    return jsonResponse({ message: 'image is required' }, { status: 400 });
  }

  const id = `palm_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const dryRun = String(formData.get('dry_run') || 'false') === 'true';
  const createdAt = new Date().toISOString();
  const job = {
    id,
    status: 'queued',
    dryRun,
    createdAt,
    updatedAt: createdAt,
    result: null,
    error: '',
    input: {
      imageBytes: await image.arrayBuffer(),
      filename: image.name || 'palm.jpg',
      mimeType: image.type || 'image/jpeg',
      dryRun,
    },
  };
  palmReadingJobs.set(id, job);
  runPalmReadingJob(job);
  return jsonResponse(palmReadingJobSnapshot(job), { status: 202 });
}

function getPalmReadingJob(pathname) {
  const match = /^\/api\/palm-reading\/jobs\/([^/]+)$/.exec(pathname);
  if (!match) return null;
  cleanupPalmReadingJobs();
  return palmReadingJobs.get(decodeURIComponent(match[1])) || null;
}

async function proxySentiment(req) {
  const response = await fetch(`${llmServiceUrl}/sentiment`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: await req.text(),
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

async function proxySiamseeReading(req) {
  const response = await fetch(`${llmServiceUrl}/siamsee-reading`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: await req.text(),
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

function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(payload), { ...init, headers });
}

async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

async function handleApi(req) {
  const url = new URL(req.url);

  if (url.pathname === '/api/palm-reading/jobs') {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    return createPalmReadingJob(req);
  }

  if (url.pathname.startsWith('/api/palm-reading/jobs/')) {
    if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    const job = getPalmReadingJob(url.pathname);
    if (!job) return jsonResponse({ message: 'Palm reading job not found' }, { status: 404 });
    return jsonResponse(palmReadingJobSnapshot(job));
  }

  if (url.pathname.startsWith('/api/uploads/')) {
    if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    return appDb.uploadResponse(url.pathname);
  }

  if (url.pathname === '/api/session') {
    if (req.method === 'GET') {
      return jsonResponse({ authenticated: true, ...(appDb.getSessionSnapshot(req) || { authenticated: false }) });
    }
    if (req.method === 'DELETE') {
      appDb.revokeSession(req);
      return jsonResponse({ ok: true }, { headers: { 'set-cookie': appDb.clearSessionCookie() } });
    }
    return new Response('Method not allowed', { status: 405 });
  }

  if (url.pathname === '/api/session/user') {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const body = await readJson(req);
    if (!body?.user?.name && !body?.user?.displayName) {
      return jsonResponse({ message: 'user.name is required' }, { status: 400 });
    }
    const current = appDb.getSession(req);
    const saved = appDb.saveUser(body.user, req, current?.userId || null);
    if (body.ritual) appDb.saveRitualForUser(saved.user.id, saved.user, body.ritual);
    return jsonResponse({ user: saved.user }, { headers: { 'set-cookie': appDb.sessionCookie(saved.token) } });
  }

  if (url.pathname === '/api/ritual') {
    if (req.method !== 'PUT') return new Response('Method not allowed', { status: 405 });
    const body = await readJson(req);
    const ritual = appDb.saveRitual(req, body?.ritual || body || {});
    if (!ritual) return jsonResponse({ message: 'Not authenticated' }, { status: 401 });
    return jsonResponse({ ritual });
  }

    if (url.pathname === '/api/readings') {
    if (req.method === 'GET') {
      const snapshot = appDb.getSessionSnapshot(req);
      if (!snapshot) return jsonResponse({ message: 'Not authenticated' }, { status: 401 });
      return jsonResponse({ readings: snapshot.readings });
    }
    if (req.method === 'POST') {
      const body = await readJson(req);
      const record = appDb.saveReading(req, body?.record || body || {});
      if (!record) return jsonResponse({ message: 'Not authenticated' }, { status: 401 });
      return jsonResponse({ record });
    }
    return new Response('Method not allowed', { status: 405 });
  }

  if (url.pathname === '/api/sentiment') {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    return proxySentiment(req);
  }

  if (url.pathname === '/api/siamsee-reading') {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    return proxySiamseeReading(req);
  }

  return null;
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
    if (url.pathname.startsWith('/api/')) {
      return handleApi(req).then((response) => response || new Response('Not found', { status: 404 }));
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
console.log(`[server] sqlite ${appDb.dbPath}`);
