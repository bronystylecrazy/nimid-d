// @ts-nocheck
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import httpProxy from 'http-proxy';
import mqtt from 'mqtt';

const port = Number(process.env.PORT || 80);
const staticDir = process.env.STATIC_DIR || join(process.cwd(), 'dist');
const mqttBrokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://mqtt:1883';
const mqttWebSocketTarget = process.env.MQTT_WS_TARGET || 'http://mqtt:9001';
const mqttLogTopic = process.env.MQTT_LOG_TOPIC || '#';
const mqttShakeTopic = 'v1/shake';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function safeStaticPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0] || '/');
  const normalized = normalize(cleanPath).replace(/^(\.\.[/\\])+/, '');
  const relative = normalized === '/' ? '/index.html' : normalized;
  return join(staticDir, relative);
}

function serveStatic(req, res) {
  const requestedPath = safeStaticPath(req.url || '/');
  const filePath = existsSync(requestedPath) && statSync(requestedPath).isFile()
    ? requestedPath
    : join(staticDir, 'index.html');
  const ext = filePath.slice(filePath.lastIndexOf('.'));

  res.writeHead(200, {
    'content-type': contentTypes[ext] || 'application/octet-stream',
    'cache-control': filePath.includes('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
  });
  createReadStream(filePath).pipe(res);
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
    if (topic === mqttShakeTopic) {
      console.log(`[mqtt:shake] topic=${topic} payload=${message}`);
      return;
    }
    console.log(`[mqtt] ${topic}: ${message}`);
  });
}

const proxy = httpProxy.createProxyServer({
  target: mqttWebSocketTarget,
  ws: true,
  changeOrigin: true,
});

proxy.on('error', (err, _req, res) => {
  console.error(`[proxy] ${err.message}`);
  if (res?.writeHead) {
    res.writeHead(502);
    res.end('Bad gateway');
  }
});

const server = createServer((req, res) => {
  if (req.url?.startsWith('/mqtt')) {
    proxy.web(req, res);
    return;
  }
  serveStatic(req, res);
});

server.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith('/mqtt')) {
    proxy.ws(req, socket, head);
    return;
  }
  socket.destroy();
});

startMqttLogger();

server.listen(port, '0.0.0.0', () => {
  console.log(`[server] listening on :${port}`);
  console.log(`[server] static ${staticDir}`);
  console.log(`[server] mqtt websocket proxy ${mqttWebSocketTarget}`);
  console.log(`[server] mqtt shake logger ${mqttShakeTopic}`);
});
