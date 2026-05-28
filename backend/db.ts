// @ts-nocheck
import { Database } from 'bun:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

const SESSION_TTL_DAYS = 90;
const SESSION_COOKIE = 'nimidd_session';

function nowIso() {
  return new Date().toISOString();
}

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function jsonString(value, fallback = null) {
  return JSON.stringify(value ?? fallback);
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function randomId(prefix) {
  return `${prefix}_${randomBytes(16).toString('hex')}`;
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function parseCookies(header) {
  const cookies = {};
  for (const part of String(header || '').split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=');
    if (!rawKey) continue;
    cookies[rawKey] = decodeURIComponent(rawValue.join('=') || '');
  }
  return cookies;
}

function safeUploadPath(uploadDir, storedPath) {
  const clean = normalize(storedPath || '').replace(/^(\.\.[/\\])+/, '');
  const fullPath = join(uploadDir, clean);
  const rel = relative(uploadDir, fullPath);
  if (rel.startsWith('..') || rel === '') return null;
  return fullPath;
}

function mimeExtension(mime) {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  return '.jpg';
}

function saveDataUrl(uploadDir, folder, name, dataUrl) {
  if (!String(dataUrl || '').startsWith('data:')) return dataUrl || null;
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] || 'image/jpeg';
  const bytes = Buffer.from(match[2], 'base64');
  const dir = join(uploadDir, folder);
  mkdirSync(dir, { recursive: true });
  const filename = `${name}${mimeExtension(mime)}`;
  writeFileSync(join(dir, filename), bytes);
  return {
    path: `${folder}/${filename}`,
    mime,
  };
}

function uploadPublicUrl(path) {
  return path ? `/api/uploads/${path.split('/').map(encodeURIComponent).join('/')}` : null;
}

function userFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.display_name,
    palm: uploadPublicUrl(row.palm_image_path),
    palmImageMime: row.palm_image_mime,
    palmReading: parseJson(row.palm_reading_json, null),
    palmReadingStatus: row.palm_reading_status,
    palmReadingManifest: parseJson(row.palm_reading_manifest_json, null),
    palmReadingPanel: uploadPublicUrl(row.palm_reading_panel_path),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
  };
}

function ritualFromRow(row, user) {
  if (!row) return null;
  return {
    user,
    activity: row.activity || 'meditate',
    feeling: row.feeling || '',
    moods: parseJson(row.moods_json, []),
    temple: row.temple || 'thai',
    box: row.box || 'gold',
    category: row.category || 'work',
    music: row.music || 'bell',
  };
}

function readingFromRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    user: parseJson(row.user_snapshot_json, null),
    ritual: {
      activity: row.activity,
      feeling: row.feeling || '',
      moods: parseJson(row.moods_json, []),
      temple: row.temple || 'thai',
      box: row.box || 'gold',
      category: row.category || 'work',
      music: row.music || 'bell',
    },
    fortune: {
      category: row.category || 'work',
      num: row.fortune_num,
      title: row.fortune_title,
      text: row.fortune_text,
      advice: row.fortune_advice,
      question: row.fortune_question,
      luck: row.fortune_luck,
    },
  };
}

export function openAppDb(options = {}) {
  const dbPath = options.dbPath || process.env.DB_PATH || join(process.cwd(), 'data', 'nimidd.sqlite');
  const dataDir = dirname(dbPath);
  const uploadDir = options.uploadDir || process.env.UPLOAD_DIR || join(dataDir, 'uploads');
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(uploadDir, { recursive: true });

  const db = new Database(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      palm_image_path TEXT,
      palm_image_mime TEXT,
      palm_reading_status TEXT NOT NULL DEFAULT 'pending',
      palm_reading_json TEXT,
      palm_reading_manifest_json TEXT,
      palm_reading_panel_path TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      user_agent TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      revoked_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS ritual_states (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      activity TEXT NOT NULL DEFAULT 'meditate',
      feeling TEXT NOT NULL DEFAULT '',
      moods_json TEXT NOT NULL DEFAULT '[]',
      temple TEXT NOT NULL DEFAULT 'thai',
      box TEXT NOT NULL DEFAULT 'gold',
      category TEXT NOT NULL DEFAULT 'work',
      music TEXT NOT NULL DEFAULT 'bell',
      current_step TEXT NOT NULL DEFAULT 'login',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fortune_readings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_snapshot_json TEXT,
      activity TEXT,
      feeling TEXT NOT NULL DEFAULT '',
      moods_json TEXT NOT NULL DEFAULT '[]',
      temple TEXT NOT NULL DEFAULT 'thai',
      box TEXT NOT NULL DEFAULT 'gold',
      category TEXT NOT NULL DEFAULT 'work',
      music TEXT NOT NULL DEFAULT 'bell',
      fortune_num TEXT NOT NULL,
      fortune_title TEXT NOT NULL,
      fortune_text TEXT NOT NULL,
      fortune_advice TEXT,
      fortune_question TEXT,
      fortune_luck TEXT,
      pre_score INTEGER,
      post_score INTEGER,
      post_moods_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_fortune_readings_user_id_created_at
      ON fortune_readings(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS palm_reading_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      image_path TEXT,
      response_json TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_palm_reading_requests_user_id
      ON palm_reading_requests(user_id, created_at DESC);
  `);

  const statements = {
    userById: db.query('SELECT * FROM users WHERE id = ?'),
    sessionByHash: db.query(`
      SELECT
        s.id AS session_id,
        s.user_id AS session_user_id,
        s.token_hash AS session_token_hash,
        s.expires_at AS session_expires_at,
        u.id AS user_id,
        u.display_name,
        u.palm_image_path,
        u.palm_image_mime,
        u.palm_reading_status,
        u.palm_reading_json,
        u.palm_reading_manifest_json,
        u.palm_reading_panel_path,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at,
        u.last_seen_at AS user_last_seen_at
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > ?
    `),
    touchSession: db.query(`
      UPDATE user_sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?
    `),
    touchUser: db.query('UPDATE users SET last_seen_at = ?, updated_at = ? WHERE id = ?'),
    upsertUser: db.query(`
      INSERT INTO users (
        id, display_name, palm_image_path, palm_image_mime, palm_reading_status,
        palm_reading_json, palm_reading_manifest_json, palm_reading_panel_path,
        created_at, updated_at, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        palm_image_path = COALESCE(excluded.palm_image_path, users.palm_image_path),
        palm_image_mime = COALESCE(excluded.palm_image_mime, users.palm_image_mime),
        palm_reading_status = excluded.palm_reading_status,
        palm_reading_json = excluded.palm_reading_json,
        palm_reading_manifest_json = excluded.palm_reading_manifest_json,
        palm_reading_panel_path = COALESCE(excluded.palm_reading_panel_path, users.palm_reading_panel_path),
        updated_at = excluded.updated_at,
        last_seen_at = excluded.last_seen_at
    `),
    insertSession: db.query(`
      INSERT INTO user_sessions (id, user_id, token_hash, user_agent, ip_address, created_at, last_seen_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `),
    revokeSession: db.query('UPDATE user_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL'),
    ritualByUser: db.query('SELECT * FROM ritual_states WHERE user_id = ?'),
    upsertRitual: db.query(`
      INSERT INTO ritual_states (user_id, activity, feeling, moods_json, temple, box, category, music, current_step, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        activity = excluded.activity,
        feeling = excluded.feeling,
        moods_json = excluded.moods_json,
        temple = excluded.temple,
        box = excluded.box,
        category = excluded.category,
        music = excluded.music,
        current_step = excluded.current_step,
        updated_at = excluded.updated_at
    `),
    readingsByUser: db.query('SELECT * FROM fortune_readings WHERE user_id = ? ORDER BY created_at DESC LIMIT 100'),
    insertReading: db.query(`
      INSERT INTO fortune_readings (
        id, user_id, user_snapshot_json, activity, feeling, moods_json, temple, box, category, music,
        fortune_num, fortune_title, fortune_text, fortune_advice, fortune_question, fortune_luck,
        pre_score, post_score, post_moods_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
  };

  function getSession(req) {
    const token = parseCookies(req.headers.get('cookie'))[SESSION_COOKIE];
    if (!token) return null;
    const tokenHash = hashToken(token);
    const row = statements.sessionByHash.get(tokenHash, nowIso());
    if (!row) return null;
    const now = nowIso();
    statements.touchSession.run(now, daysFromNow(SESSION_TTL_DAYS), row.id);
    statements.touchUser.run(now, now, row.user_id);
    return {
      id: row.session_id,
      userId: row.session_user_id,
      token,
      tokenHash,
      user: userFromRow({
        id: row.user_id,
        display_name: row.display_name,
        palm_image_path: row.palm_image_path,
        palm_image_mime: row.palm_image_mime,
        palm_reading_status: row.palm_reading_status,
        palm_reading_json: row.palm_reading_json,
        palm_reading_manifest_json: row.palm_reading_manifest_json,
        palm_reading_panel_path: row.palm_reading_panel_path,
        created_at: row.user_created_at,
        updated_at: row.user_updated_at,
        last_seen_at: row.user_last_seen_at,
      }),
    };
  }

  function createSession(userId, req) {
    const token = randomBytes(32).toString('base64url');
    const now = nowIso();
    statements.insertSession.run(
      randomId('session'),
      userId,
      hashToken(token),
      req.headers.get('user-agent') || '',
      req.headers.get('x-forwarded-for') || '',
      now,
      now,
      daysFromNow(SESSION_TTL_DAYS),
    );
    return token;
  }

  function sessionCookie(token) {
    return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_DAYS * 24 * 60 * 60}`;
  }

  function clearSessionCookie() {
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  }

  function saveUser(userPayload, req, currentUserId = null) {
    const userId = currentUserId || userPayload.id || randomId('user');
    const palm = saveDataUrl(uploadDir, 'palms', userId, userPayload.palm);
    const palmPanel = saveDataUrl(uploadDir, 'palm-panels', userId, userPayload.palmReadingPanel);
    const palmImagePath = typeof palm === 'string' && !palm.startsWith('/api/uploads/') ? null : palm?.path || null;
    const palmImageMime = palm?.mime || userPayload.palmImageMime || null;
    const palmPanelPath = typeof palmPanel === 'string' && !palmPanel.startsWith('/api/uploads/') ? null : palmPanel?.path || null;
    const now = nowIso();
    statements.upsertUser.run(
      userId,
      String(userPayload.name || userPayload.displayName || '').trim(),
      palmImagePath,
      palmImageMime,
      userPayload.palmReadingStatus || 'pending',
      jsonString(userPayload.palmReading, null),
      jsonString(userPayload.palmReadingManifest, null),
      palmPanelPath,
      now,
      now,
      now,
    );
    const token = createSession(userId, req);
    return {
      token,
      user: userFromRow(statements.userById.get(userId)),
    };
  }

  function getSessionSnapshot(req) {
    const session = getSession(req);
    if (!session) return null;
    const user = session.user;
    return {
      user,
      ritual: ritualFromRow(statements.ritualByUser.get(session.userId), user),
      readings: statements.readingsByUser.all(session.userId).map(readingFromRow),
    };
  }

  function saveRitualForUser(userId, user, ritual) {
    const now = nowIso();
    statements.upsertRitual.run(
      userId,
      ritual.activity || 'meditate',
      ritual.feeling || '',
      jsonString(Array.isArray(ritual.moods) ? ritual.moods : [], []),
      ritual.temple || 'thai',
      ritual.box || 'gold',
      ritual.category || 'work',
      ritual.music || 'bell',
      ritual.currentStep || 'login',
      now,
    );
    return ritualFromRow(statements.ritualByUser.get(userId), user);
  }

  function saveRitual(req, ritual) {
    const session = getSession(req);
    if (!session) return null;
    return saveRitualForUser(session.userId, session.user, ritual);
  }

  function saveReading(req, record) {
    const session = getSession(req);
    if (!session) return null;
    const ritual = record.ritual || {};
    const fortune = record.fortune || {};
    const id = record.id || randomId('reading');
    statements.insertReading.run(
      id,
      session.userId,
      jsonString(record.user || session.user, null),
      ritual.activity || null,
      ritual.feeling || '',
      jsonString(Array.isArray(ritual.moods) ? ritual.moods : [], []),
      ritual.temple || 'thai',
      ritual.box || 'gold',
      ritual.category || fortune.category || 'work',
      ritual.music || 'bell',
      String(fortune.num || ''),
      String(fortune.title || ''),
      String(fortune.text || ''),
      fortune.advice || null,
      fortune.question || null,
      fortune.luck || null,
      record.preScore ?? null,
      record.postScore ?? null,
      jsonString(record.postMoods, null),
      record.createdAt || nowIso(),
    );
    return readingFromRow(db.query('SELECT * FROM fortune_readings WHERE id = ?').get(id));
  }

  function revokeSession(req) {
    const token = parseCookies(req.headers.get('cookie'))[SESSION_COOKIE];
    if (token) statements.revokeSession.run(nowIso(), hashToken(token));
  }

  function uploadResponse(urlPath) {
    const prefix = '/api/uploads/';
    const rawPath = decodeURIComponent(urlPath.slice(prefix.length));
    const fullPath = safeUploadPath(uploadDir, rawPath);
    if (!fullPath || !existsSync(fullPath)) return new Response('Not found', { status: 404 });
    return new Response(Bun.file(fullPath), {
      headers: { 'cache-control': 'private, max-age=3600' },
    });
  }

  return {
    db,
    dbPath,
    uploadDir,
    SESSION_COOKIE,
    getSession,
    getSessionSnapshot,
    saveUser,
    saveRitualForUser,
    saveRitual,
    saveReading,
    revokeSession,
    sessionCookie,
    clearSessionCookie,
    uploadResponse,
  };
}
