// @ts-nocheck
import React from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { AppNav, PageFrame } from './app-navigation';
import { analyzeSentiment, clearSession, generateSiamseeReading, getReadings, getSessionSnapshot, saveReading, saveRitualDraft, saveSessionUser } from './api';
import DashboardScreen from './dashboard';
import { DesignCanvas, DCArtboard, DCPostIt, DCSection } from './design-canvas';
import siamseeData from './siamsee.json';
import {
  ACTIVITIES,
  AppShell,
  BlobShape,
  Blobs,
  BOXES,
  BoxPreview,
  CATEGORIES,
  FORTUNES,
  Icon,
  Logo,
  MOODS_PRE,
  MUSIC,
  SelectCard,
  Sparkles,
  TEMPLES,
  TempleOrnament,
} from './ritual-primitives';
import {
  TweakColor,
  TweakRadio,
  TweakSection,
  TweakSlider,
  TweaksPanel,
  useTweaks,
} from './tweaks';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  MQTT_DETECTION_EVENT,
  MQTT_DETECTION_TOPIC,
  MQTT_SHAKE_EVENT,
  MQTT_SHAKE_TOPIC,
  MQTT_STATUS_EVENT,
  REALTIME_URL,
  isShakeTopic,
  useRealtimeEvents,
} from './realtime';

declare global {
  interface Window { omelette?: { writeFile: (path: string, contents: string) => Promise<unknown> }; webkitAudioContext?: typeof AudioContext; THREE: typeof THREE; __tweaks?: any; }
}

window.THREE = THREE;

// login.tsx — First screen. Two modes:
//   1) First visit  → ลงทะเบียน (ชื่อ · วันเกิด · ลายมือ)
//   2) Return visit → สวัสดีกลับมาอีกครั้ง + ผลวิเคราะห์ลายมือ (3 เส้น)
// User persisted to localStorage so the second visit recognizes them.

const LS_USER_KEY = 'siamsi:user';

// ────────────────────────────
// Palm reading content. Picked deterministically from the user's name +
// dob so the same user always sees the same reading on repeat visits —
// it feels personal without ever calling out to a backend.
// ────────────────────────────
const PALM_LINES = [
  {
    id: 'heart', name: 'เส้นจิตใจ', sub: 'Heart Line',
    hint: 'สะท้อนอารมณ์ ความรัก และความสัมพันธ์',
    color: 'var(--c-coral)',
    pathD: 'M10 28 Q 32 14 60 18 T 110 24',
    readings: [
      { tone: 'ลึกและอบอุ่น', text: 'คุณรักได้ลึกและมีใจให้กับคนรอบข้างเสมอ ช่วงนี้ลองแบ่งพลังใจไปให้ตัวเองสักนิด ความรักจะยิ่งงอกงามขึ้น' },
      { tone: 'ชัดเจน มั่นคง',     text: 'จิตใจของคุณรู้ชัดว่าต้องการอะไร แต่บางครั้งก็รอคอยนานเกินไป ลองฟังเสียงจากใจตัวเองดูบ้าง คำตอบมักรออยู่ตรงนั้น' },
      { tone: 'อ่อนโยน',           text: 'คุณมีหัวใจที่ยืดหยุ่นและปรับตัวได้ง่าย มีความสามารถรับรู้ความรู้สึกของผู้อื่น อย่าลืมให้ความรู้สึกของตัวเองมีความสำคัญไม่แพ้กัน' },
    ],
  },
  {
    id: 'head', name: 'เส้นสมอง', sub: 'Head Line',
    hint: 'วิธีคิด การตัดสินใจ และการเรียนรู้',
    color: 'var(--c-lavender-deep)',
    pathD: 'M8 44 Q 38 50 70 46 T 116 50',
    readings: [
      { tone: 'คิดยืดหยุ่น',     text: 'คุณมองได้หลายมุมและตัดสินใจจากข้อมูล ไม่รีบร้อน จุดแข็งของคุณคือการไม่ตัดสินจนกว่าจะรู้จริง' },
      { tone: 'บอบบางและจะจะ',   text: 'คุณรับรู้ได้ไว มีไอเดียเยอะและชอบลองของใหม่ แต่บางครั้งอาจขยับลงมือทำ ลองจัดลิสต์สั้น ๆ จะช่วยให้สมองไหลลื่น' },
      { tone: 'การงานสร้างสรรค์', text: 'ความถนัดของคุณอยู่ที่การมองเห็นมุมที่คนอื่นมองข้าม สัปดาห์นี้เหมาะกับการจดไอเดียจากข้อมูลไม่ต่อเนื่อง แล้วค่อย ๆ ร้อยเรียงมันไปทีละขั้น' },
    ],
  },
  {
    id: 'life', name: 'เส้นชีวิต', sub: 'Life Line',
    hint: 'พลังชีวิต สุขภาพกายใจ และจังหวะของชีวิต',
    color: 'var(--c-mint-deep)',
    pathD: 'M28 18 Q 18 50 36 84 T 64 110',
    readings: [
      { tone: 'มั่นคงยืนยาว',      text: 'พลังชีวิตของคุณมีความยืนหยุ่น ไม่ว่าจะเจออะไร คุณมักจะลุกขึ้นสู้ต่อได้เสมอ ช่วงนี้ลองให้พื้นฐานของชีวิตได้พักผ่อน' },
      { tone: 'มีชีวิตชีวา',       text: 'คุณรับรู้สัมผัสต่อโลกรอบตัวได้ดี และชอบอยู่ในบรรยากาศที่มีชีวิตชีวา ยังมีสิ่งใหม่ ๆ รอให้คุณค้นพบอีกไม่น้อย' },
      { tone: 'ระมัดระวัง',         text: 'ร่างกายของคุณกำลังส่งสัญญาณบางอย่างเบา ๆ กลับมา ลองฟังมัน พักมากขึ้น ดื่มน้ำมากขึ้น หาสิ่งที่ทำแล้วรู้สึกสงบ แล้วทำมันช้า ๆ',
      },
    ],
  },
];

const PALM_READING_EVENT = 'nimidd:palm-reading';
const PALM_READING_PENDING_STATUSES = new Set(['queued', 'running', 'loading', 'preprocessing']);

function isPalmReadingPending(user) {
  return PALM_READING_PENDING_STATUSES.has(String(user?.palmReadingStatus || ''));
}

function isAbortError(error) {
  return error?.name === 'AbortError';
}

function makeAbortError() {
  const error = new Error('Request cancelled');
  error.name = 'AbortError';
  return error;
}

// simple string-hash so the reading stays the same for a given user
function __palmHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function analyzePalm(user) {
  if (isPalmReadingPending(user)) {
    return PALM_LINES.map((line) => ({
      ...line,
      reading: {
        tone: 'กำลังอ่านลายมือ',
        text: 'ระบบกำลังแยกเส้นลายมือและอ่านผลให้ละเอียด คุณเดินพิธีต่อได้ ระหว่างนี้คำอ่านจะอัปเดตเองเมื่อเสร็จ',
      },
    }));
  }
  if (user?.palmReading && Object.keys(user.palmReading).length > 0) return palmReadingFromLlm(user.palmReading);
  const seed = __palmHash((user?.name || '') + '|' + (user?.dob || ''));
  return PALM_LINES.map((L, i) => {
    const r = L.readings[(seed + i * 7) % L.readings.length];
    return { ...L, reading: r };
  });
}
window.analyzePalm = analyzePalm;

function palmReadingFromLlm(palmReading) {
  const fields = {
    heart: palmReading.heart_line,
    head: palmReading.head_line,
    life: palmReading.life_line,
  };
  return PALM_LINES.map((line) => ({
    ...line,
    reading: {
      tone: 'อ่านจากลายมือ',
      text: fields[line.id] || line.readings[0].text,
    },
  }));
}

async function dataUrlToBlob(dataUrl, signal = null) {
  const response = await fetch(dataUrl, signal ? { signal } : undefined);
  return response.blob();
}

function sleep(ms, signal = null) {
  if (!signal) return new Promise((resolve) => setTimeout(resolve, ms));
  if (signal.aborted) return Promise.reject(makeAbortError());
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer);
      reject(makeAbortError());
    }, { once: true });
  });
}

function stableHash(value) {
  const input = typeof value === 'string' ? value : JSON.stringify(value || {});
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function detectionAccelEuclidean(data) {
  return finiteNumber(
    data?.accel_euclidean_g
      ?? data?.accel_eclidean_g
      ?? data?.accel_euclidean
      ?? data?.accel_eclidean
      ?? data?.linear_accel_magnitude_g,
    NaN,
  );
}

function shakeSampleFromDetection(data, startAtMs) {
  const sourceTime = finiteNumber(data?.t_ms ?? data?.timestamp_ms, performance.now());
  const accel = data?.linear_accel_magnitude_g ?? detectionAccelEuclidean(data);
  const gyro = data?.gyro_magnitude_dps ?? Math.hypot(
    finiteNumber(data?.gyro_x_dps),
    finiteNumber(data?.gyro_y_dps),
    finiteNumber(data?.gyro_z_dps),
  );
  const linearAccel = finiteNumber(accel, NaN);
  const gyroMagnitude = finiteNumber(gyro, NaN);
  if (!Number.isFinite(linearAccel) || !Number.isFinite(gyroMagnitude)) return null;
  return {
    t_ms: Math.max(0, Math.round(sourceTime - startAtMs)),
    linear_accel_magnitude_g: linearAccel,
    gyro_magnitude_dps: gyroMagnitude,
  };
}

function shakeSamplesToCsv(samples) {
  const lines = ['t_ms,linear_accel_magnitude_g,gyro_magnitude_dps'];
  for (const sample of samples) {
    lines.push([
      Math.round(sample.t_ms),
      finiteNumber(sample.linear_accel_magnitude_g).toFixed(3),
      finiteNumber(sample.gyro_magnitude_dps).toFixed(3),
    ].join(','));
  }
  return `${lines.join('\n')}\n`;
}

function makeFallbackSiamsee(status = 'fallback', siamseeStick = null) {
  return {
    status,
    reading: '',
    fields: null,
    predicted_condition: 'focus',
    siamsee_stick: siamseeStick,
    stick_number: siamseeStick?.stick_number || null,
      condition_context: {
      predicted_condition: 'focus',
      confidence: 0,
      energy_level: 'high',
      stability_level: 'high',
      thai_label: 'โฟกัส มีพลัง มีจังหวะ',
      ambiguous: true,
    },
    model: '',
  };
}

const SIAMSEE_STICKS = Array.isArray(siamseeData?.fortune_sticks) ? siamseeData.fortune_sticks : [];

function getSiamseeStick(stickNumber) {
  return SIAMSEE_STICKS.find((stick) => Number(stick.stick_number) === Number(stickNumber)) || null;
}

function randomSiamseeStick() {
  const fallbackNumber = Math.floor(Math.random() * 30) + 1;
  const fallback = getSiamseeStick(fallbackNumber);
  if (!SIAMSEE_STICKS.length) return { stick_number: fallbackNumber };
  return fallback || SIAMSEE_STICKS[Math.floor(Math.random() * SIAMSEE_STICKS.length)];
}

const THAI_DIGITS = {
  '๐': '0',
  '๑': '1',
  '๒': '2',
  '๓': '3',
  '๔': '4',
  '๕': '5',
  '๖': '6',
  '๗': '7',
  '๘': '8',
  '๙': '9',
};

function normalizeFortuneNumber(value) {
  const normalized = String(value ?? '')
    .replace(/[๐-๙]/g, digit => THAI_DIGITS[digit] || digit)
    .replace(/\D/g, '');
  return normalized ? Number(normalized) : null;
}

function randomLuckyNumberForStick(stickNumber, previousLuckyNumber = null) {
  const excluded = new Set([
    normalizeFortuneNumber(stickNumber),
    normalizeFortuneNumber(previousLuckyNumber),
  ].filter(value => value != null));
  let luckyNumber = Math.floor(Math.random() * 99) + 1;
  while (excluded.has(luckyNumber)) {
    luckyNumber = (luckyNumber % 99) + 1;
  }
  return String(luckyNumber);
}

function luckyNumbersForStick(stickNumber, explicitLuckyNumber = null, fallbackLuck = [], fallbackNum = '') {
  const drawnNumber = normalizeFortuneNumber(stickNumber);
  const explicitNumber = normalizeFortuneNumber(explicitLuckyNumber);
  if (explicitNumber != null && explicitNumber !== drawnNumber) {
    return [String(explicitLuckyNumber)];
  }

  const candidates = Array.isArray(fallbackLuck) ? fallbackLuck : [fallbackLuck];
  const lucky = candidates.find(candidate => {
    const candidateNumber = normalizeFortuneNumber(candidate);
    return candidateNumber != null && candidateNumber !== drawnNumber;
  });
  if (lucky != null) return [String(lucky)];

  const seed = drawnNumber || normalizeFortuneNumber(fallbackNum) || 1;
  let generated = ((seed * 7 + 13) % 99) + 1;
  if (generated === drawnNumber) generated = (generated % 99) + 1;
  return [String(generated)];
}

function fortuneFromSiamseeStick(stick, fallback, category, luckyNumber = null) {
  if (!stick) return fallback;
  const stickNumber = stick.stick_number || fallback.num;
  const categoryText = category === 'love'
    ? stick.love
    : category === 'work'
      ? stick.work
      : category === 'money'
        ? stick.money
        : stick.overall;
  return {
    ...fallback,
    category,
    num: String(stickNumber),
    title: stick.title || fallback.title,
    text: categoryText || stick.overall || fallback.text,
    advice: stick.advice || fallback.advice,
    luck: luckyNumbersForStick(stickNumber, luckyNumber, fallback.luck, fallback.num),
  };
}

function makeSiamseeCacheKey(state, shakeSession) {
  const userId = state?.user?.id || state?.user?.name || 'guest';
  return [
    userId,
    stableHash(state?.user?.palmReading || {}),
    shakeSession?.durationMs || 0,
    shakeSession?.sampleCount || 0,
    shakeSession?.completedAt || '',
    state?.luckyNumber || shakeSession?.luckyNumber || '',
    state?.category || 'work',
    state?.siamseeStick?.stick_number || shakeSession?.stickNumber || 0,
  ].join(':');
}

function startSiamseePrefetch(state, shakeSession) {
  const palmReading = state?.user?.palmReading;
  const key = makeSiamseeCacheKey(state, shakeSession);
  if (!palmReading || !Object.keys(palmReading).length) {
    window.__nimiddSiamseeResult = { key, status: 'fallback', result: makeFallbackSiamsee('fallback', state?.siamseeStick || null) };
    return window.__nimiddSiamseeResult;
  }
  const existing = window.__nimiddSiamseeResult;
  if (existing?.key === key && ['loading', 'complete'].includes(existing.status)) return existing;

  const payload = {
    palm_reading: palmReading,
    shake_csv_text: shakeSession?.csvText || '',
    condition: shakeSession?.csvText ? null : { predicted_condition: 'focus', confidence: 0, distances: {} },
    stick_number: state?.siamseeStick?.stick_number || shakeSession?.stickNumber || null,
    siamsee_stick: state?.siamseeStick || null,
    round_context: {
      completed_at: shakeSession?.completedAt || '',
      lucky_number: state?.luckyNumber || shakeSession?.luckyNumber || '',
      category: state?.category || 'work',
      cache_key: key,
    },
  };
  const entry = { key, status: 'loading', promise: null, result: null, error: null };
  entry.promise = generateSiamseeReading(payload)
    .then((result) => {
      entry.status = 'complete';
      entry.result = result;
      return result;
    })
    .catch((error) => {
      entry.status = 'error';
      entry.error = error;
      entry.result = makeFallbackSiamsee('error', state?.siamseeStick || null);
      return entry.result;
    });
  window.__nimiddSiamseeResult = entry;
  return entry;
}

async function readApiPayload(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.message || `Request failed: ${response.status}`);
  }
  return payload;
}

async function createPalmReadingJob(palmDataUrl, { dryRun = false, signal = null } = {}) {
  const blob = await dataUrlToBlob(palmDataUrl, signal);
  const formData = new FormData();
  formData.append('image', blob, 'palm.jpg');
  formData.append('dry_run', dryRun ? 'true' : 'false');
  const response = await fetch('/api/palm-reading/jobs', {
    method: 'POST',
    body: formData,
    signal,
  });
  return readApiPayload(response);
}

async function getPalmReadingJob(jobId, { signal = null } = {}) {
  const response = await fetch(`/api/palm-reading/jobs/${encodeURIComponent(jobId)}`, {
    method: 'GET',
    signal,
  });
  return readApiPayload(response);
}

async function waitForPalmReadingJob(jobId, { signal = null, onJob, timeoutMs = 180000 } = {}) {
  const startedAt = Date.now();
  while (true) {
    if (signal?.aborted) throw makeAbortError();
    const job = await getPalmReadingJob(jobId, { signal });
    onJob?.(job);
    if (job.status === 'complete') return job.result;
    if (job.status === 'error') throw new Error(job.error || 'อ่านลายมือไม่สำเร็จ');
    if (Date.now() - startedAt > timeoutMs) throw new Error('อ่านลายมือใช้เวลานานเกินไป');
    await sleep(900, signal);
  }
}

async function postPalmReading(palmDataUrl, { dryRun = false, signal = null, onJob } = {}) {
  const job = await createPalmReadingJob(palmDataUrl, { dryRun, signal });
  onJob?.(job);
  return waitForPalmReadingJob(job.jobId, { signal, onJob });
}

async function requestPalmReading(palmDataUrl, { onPanel, signal, onJob } = {}) {
  let preview = null;
  try {
    preview = await postPalmReading(palmDataUrl, { dryRun: true, signal, onJob });
    if (preview?.llm_panel_png_base64) {
      await onPanel?.(`data:image/png;base64,${preview.llm_panel_png_base64}`, preview);
    }
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.warn('palm preprocessing preview failed', error);
  }

  const result = await postPalmReading(palmDataUrl, { dryRun: false, signal, onJob });
  if (!result.llm_panel_png_base64 && preview?.llm_panel_png_base64) {
    result.llm_panel_png_base64 = preview.llm_panel_png_base64;
  }
  return result;
}

function palmReadingKeyFor(user) {
  return stableHash(`${user?.name || ''}|${user?.palm || ''}`);
}

function palmReadingPatchFromResult(result) {
  const panelUrl = result?.llm_panel_png_base64
    ? `data:image/png;base64,${result.llm_panel_png_base64}`
    : null;
  return {
    palmReading: result?.reading || null,
    palmReadingStatus: result?.status === 'complete' ? 'complete' : (result?.status || 'fallback'),
    palmReadingManifest: result?.manifest || null,
    palmReadingPanel: panelUrl,
    palmReadingError: '',
  };
}

function emitPalmReadingPatch(key, patch) {
  window.dispatchEvent(new CustomEvent(PALM_READING_EVENT, { detail: { key, patch } }));
}

function startPalmReadingInBackground(user) {
  const key = user.palmReadingKey || palmReadingKeyFor(user);
  const existing = window.__nimiddPalmReadingJob;
  if (existing?.key === key && existing.status === 'loading') return existing;

  const controller = new AbortController();
  const entry = { key, status: 'loading', controller };
  entry.previewPromise = new Promise((resolve) => { entry.resolvePreview = resolve; });
  window.__nimiddPalmReadingJob = entry;

  requestPalmReading(user.palm, {
    signal: controller.signal,
    onJob: (job) => {
      if (job.status === 'complete') return;
      const status = job.status || 'loading';
      const marker = `${job.jobId}:${status}`;
      if (entry.lastJobMarker === marker) return;
      entry.lastJobMarker = marker;
      emitPalmReadingPatch(key, {
        palmReadingJobId: job.jobId,
        palmReadingStatus: status,
      });
    },
    onPanel: (panelUrl, preview) => {
      entry.previewPanelUrl = panelUrl;
      entry.resolvePreview?.({ panelUrl, preview });
      emitPalmReadingPatch(key, {
        palmReadingStatus: 'preprocessing',
        palmReadingPanel: panelUrl,
        palmReadingPreviewManifest: preview?.manifest || null,
        palmReadingError: '',
      });
    },
  })
    .then((result) => {
      entry.status = 'complete';
      entry.finalPatch = palmReadingPatchFromResult(result);
      emitPalmReadingPatch(key, entry.finalPatch);
    })
    .catch((error) => {
      if (isAbortError(error)) return;
      entry.status = 'error';
      entry.resolvePreview?.(null);
      entry.finalPatch = {
        palmReadingStatus: 'error',
        palmReadingError: error?.message || 'ยังเชื่อมต่อระบบอ่านลายมือไม่ได้ จะใช้คำอ่านพื้นฐานแทน',
      };
      emitPalmReadingPatch(key, entry.finalPatch);
    });

  return entry;
}

function persistUserSnapshot(user) {
  try { localStorage.setItem(LS_USER_KEY, JSON.stringify(user)); } catch {}
}

function usePalmReadingEvents(ritual, setRitual) {
  const ritualRef = React.useRef(ritual);
  React.useEffect(() => { ritualRef.current = ritual; }, [ritual]);

  React.useEffect(() => {
    const handlePalmReading = (event) => {
      const { key, patch } = event.detail || {};
      const current = ritualRef.current;
      if (!key || !patch || current?.user?.palmReadingKey !== key) return;
      const nextUser = { ...current.user, ...patch };
      const nextRitual = { ...current, user: nextUser };
      setRitual(nextRitual);
      persistUserSnapshot(nextUser);
      saveSessionUser(nextUser, nextRitual).catch(() => {});
    };
    window.addEventListener(PALM_READING_EVENT, handlePalmReading);
    return () => window.removeEventListener(PALM_READING_EVENT, handlePalmReading);
  }, [setRitual]);
}

function usePendingPalmReading(ritual) {
  const user = ritual?.user;
  React.useEffect(() => {
    if (!user?.palm || !user?.palmReadingKey || !isPalmReadingPending(user)) return;
    const active = window.__nimiddPalmReadingJob;
    if (active?.key === user.palmReadingKey && active.status === 'loading') return;
    startPalmReadingInBackground(user);
  }, [user?.palm, user?.palmReadingKey, user?.palmReadingStatus]);
}

function PalmReadingToastHost() {
  const [toast, setToast] = React.useState(null);
  const seenRef = React.useRef(new Set());

  React.useEffect(() => {
    const handlePalmReading = (event) => {
      const { key, patch } = event.detail || {};
      const status = patch?.palmReadingStatus;
      if (!key || !['complete', 'error'].includes(status)) return;

      const id = [
        key,
        status,
        patch.palmReadingJobId || patch.palmReadingManifest?.output_dir || Date.now(),
      ].join(':');
      if (seenRef.current.has(id)) return;
      seenRef.current.add(id);

      setToast(status === 'complete'
        ? {
            id,
            tone: 'success',
            title: 'อ่านลายมือเสร็จแล้ว',
            message: 'คำอ่านลายมือพร้อมแล้ว และจะอัปเดตในพิธีให้อัตโนมัติ',
          }
        : {
            id,
            tone: 'error',
            title: 'อ่านลายมือไม่สำเร็จ',
            message: patch.palmReadingError || 'ระบบจะใช้คำอ่านพื้นฐานให้ก่อน คุณลองใหม่ได้ภายหลัง',
          });
    };
    window.addEventListener(PALM_READING_EVENT, handlePalmReading);
    return () => window.removeEventListener(PALM_READING_EVENT, handlePalmReading);
  }, []);

  React.useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5200);
    return () => window.clearTimeout(timer);
  }, [toast?.id]);

  if (!toast) return null;

  const isSuccess = toast.tone === 'success';
  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      aria-live={isSuccess ? 'polite' : 'assertive'}
      style={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        zIndex: 1000,
        width: 'min(360px, calc(100vw - 32px))',
        padding: 16,
        borderRadius: 18,
        background: 'rgba(255,255,255,.92)',
        color: 'var(--text-main)',
        boxShadow: '0 18px 50px rgba(61,46,42,.18), 0 1px 0 rgba(255,255,255,.8) inset',
        border: `1px solid ${isSuccess ? 'rgba(135,181,158,.35)' : 'rgba(217,122,108,.35)'}`,
        backdropFilter: 'blur(18px) saturate(160%)',
        WebkitBackdropFilter: 'blur(18px) saturate(160%)',
        display: 'grid',
        gridTemplateColumns: '36px 1fr auto',
        gap: 12,
        alignItems: 'start',
        animation: 'float-up .28s cubic-bezier(.3,.7,.4,1.4) both',
      }}>
      <div style={{
        width: 36,
        height: 36,
        borderRadius: 12,
        background: isSuccess ? 'rgba(184,216,200,.42)' : 'rgba(217,122,108,.16)',
        color: isSuccess ? 'var(--c-mint-deep)' : 'var(--c-coral)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {isSuccess ? <Icon.check size={18} sw={2.4}/> : <Icon.refresh size={18} sw={2}/>}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
          {toast.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
          {toast.message}
        </div>
      </div>
      <button
        type="button"
        aria-label="ปิดแจ้งเตือน"
        onClick={() => setToast(null)}
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          border: 'none',
          background: 'var(--surface-soft)',
          color: 'var(--text-muted)',
          fontSize: 18,
          lineHeight: 1,
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
        }}>
        ×
      </button>
    </div>
  );
}

function LoginScreen({ onContinue, initial = {} }) {
  // Detect returning user: either via passed prop (for the design canvas
  // demo artboard), server session, or localStorage fallback.
  const [savedUser, setSavedUser] = React.useState(() => {
    if (initial.user) return initial.user;
    try {
      const raw = localStorage.getItem(LS_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  React.useEffect(() => {
    if (initial.user || initial.forceRegister) return;
    let cancelled = false;
    getSessionSnapshot()
      .then((snapshot) => {
        if (cancelled || !snapshot?.authenticated || !snapshot.user) return;
        try { localStorage.setItem(LS_USER_KEY, JSON.stringify(snapshot.user)); } catch {}
        setSavedUser(snapshot.user);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [initial.forceRegister, initial.user]);
  // "forget me" clears localStorage AND drops back to registration
  const forgetUser = () => {
    try { localStorage.removeItem(LS_USER_KEY); } catch {}
    clearSession().catch(() => {});
    setSavedUser(null);
  };

  if (savedUser && !initial.forceRegister) {
    return <WelcomeBack user={savedUser} onContinue={onContinue} onForget={forgetUser}/>;
  }
  return <RegisterForm initial={initial} onContinue={(u) => {
    persistUserSnapshot(u);
    setSavedUser(u);
    onContinue(u);
    saveSessionUser(u)
      .then((saved) => {
        const savedUser = saved.user || {};
        const savedPatch = {};
        if (savedUser.id) savedPatch.id = savedUser.id;
        if (savedUser.palm) savedPatch.palm = savedUser.palm;
        if (savedUser.palmImageMime) savedPatch.palmImageMime = savedUser.palmImageMime;
        if (savedUser.createdAt) savedPatch.createdAt = savedUser.createdAt;
        if (savedUser.updatedAt) savedPatch.updatedAt = savedUser.updatedAt;
        if (savedUser.lastSeenAt) savedPatch.lastSeenAt = savedUser.lastSeenAt;
        setSavedUser((current) => ({ ...(current || u), ...savedPatch }));
        try {
          const current = JSON.parse(localStorage.getItem(LS_USER_KEY) || 'null') || u;
          persistUserSnapshot({ ...current, ...savedPatch });
        } catch {
          persistUserSnapshot({ ...u, ...savedPatch });
        }
        if (u.palmReadingKey) emitPalmReadingPatch(u.palmReadingKey, savedPatch);
      })
      .catch(() => {});
  }}/>;
}
window.LoginScreen = LoginScreen;

// ────────────────────────────
// RegisterForm — first-visit registration (the original LoginScreen body)
// ────────────────────────────
function RegisterForm({ onContinue, initial = {} }) {
  const [name, setName] = React.useState(initial.name || '');
  const [palm, setPalm] = React.useState(initial.palm || null); // dataURL
  const [readingStatus, setReadingStatus] = React.useState('idle');
  const [readingError, setReadingError] = React.useState('');
  const [palmProcessingPanel, setPalmProcessingPanel] = React.useState(null);
  const ready = name.trim().length >= 2 && palm;
  const analyzing = ['loading', 'preprocessing'].includes(readingStatus);

  const updatePalm = (nextPalm) => {
    setPalm(nextPalm);
    setPalmProcessingPanel(null);
    setReadingStatus('idle');
    setReadingError('');
  };

  const continueWithPalmReading = async () => {
    if (!ready || analyzing) return;
    const palmReadingKey = palmReadingKeyFor({ name: name.trim(), palm });
    const user = { name: name.trim(), palm, palmReadingStatus: 'loading', palmReadingKey };
    setReadingStatus('loading');
    setReadingError('');
    setPalmProcessingPanel(null);
    const entry = startPalmReadingInBackground(user);
    let nextUser = user;
    const preview = await Promise.race([
      entry?.previewPromise || Promise.resolve(null),
      sleep(8000).then(() => null),
    ]);
    if (preview?.panelUrl) {
      setReadingStatus('preprocessing');
      setPalmProcessingPanel(preview.panelUrl);
      nextUser = {
        ...user,
        palmReadingStatus: 'preprocessing',
        palmReadingPanel: preview.panelUrl,
        palmReadingPreviewManifest: preview.preview?.manifest || null,
      };
      await sleep(2000);
    }
    onContinue(nextUser);
    if (entry?.finalPatch) {
      window.setTimeout(() => emitPalmReadingPatch(palmReadingKey, entry.finalPatch), 0);
    }
  };

  return (
    <div className="proto" style={{ overflow: 'auto' }}>
      <Sparkles count={14}/>
      <BlobShape d={Blobs.one}  fill="rgba(242,181,160,.20)" style={{ width: 520, height: 520, top: -160, left: -160, filter: 'blur(20px)' }}/>
      <BlobShape d={Blobs.two}  fill="rgba(232,200,224,.22)" style={{ width: 600, height: 600, bottom: -220, right: -180, filter: 'blur(24px)' }}/>
      <BlobShape d={Blobs.three} fill="rgba(184,216,200,.16)" style={{ width: 460, height: 460, top: '20%', left: '55%', filter: 'blur(30px)' }}/>

      {/* Header */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
        padding: '24px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo/>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em' }}>NIMID D</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Mindful Ritual</span>
          </div>
        </div>
        <span className="badge"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-mint-deep)' }}/> เริ่มต้น</span>
      </header>

      {/* Body */}
      <main style={{
        position: 'absolute', inset: 0, paddingTop: 92,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '92px 48px 48px',
      }}>
        <div style={{
          width: '100%', maxWidth: 1180,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56,
          alignItems: 'center',
        }}>
          {/* LEFT: copy */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>ขั้นตอนที่ ๐ · เริ่มต้นใจ</div>
            <h1 style={{ fontSize: 56, lineHeight: 1.1, marginBottom: 18, textWrap: 'balance' }}>
              เริ่มต้นด้วย<br/>
              <span style={{ color: 'var(--text-muted)', fontWeight: 300 }}>
                การรู้จักคุณสักนิด
              </span>
            </h1>
            <p style={{ fontSize: 17, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 28, maxWidth: 460 }}>
              บอกชื่อและฝ่ามือของคุณ เพื่อให้พิธีเซียมซีปรับให้สอดคล้องกับช่วงชีวิตของคุณมากขึ้น
            </p>

            {/* mini features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { i: Icon.lotus,  t: 'ทุกข้อมูลเก็บไว้ในเครื่องของคุณ', s: 'ไม่ส่งออกไปไหน เว้นแต่คุณอนุญาต' },
                { i: Icon.sparkle, t: 'ฝ่ามือใช้เป็นเครื่องตั้งจิต', s: 'ไม่ได้ใช้ทำนายโดยอัตโนมัติ คุณยังคงเป็นผู้เลือก' },
                { i: Icon.bell,    t: 'เริ่มและออกได้ทุกเวลา',         s: 'พิธีนี้ออกแบบให้นุ่มนวลกับใจของคุณ' },
              ].map((r, i) => {
                const I = r.i;
                return (
                  <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 12,
                      background: 'var(--surface-card)', color: 'var(--text-main)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, boxShadow: 'var(--shadow-soft)',
                    }}>
                      <I size={18}/>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{r.t}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.s}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: form card */}
          <div className="card" style={{ padding: 32, borderRadius: 32 }}>
            <h3 style={{ fontSize: 22, fontWeight: 500, marginBottom: 6 }}>ลงทะเบียนเข้าวัด</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 22 }}>
              ใช้เวลาประมาณ ๑ นาที ทุกช่องสามารถข้ามและกลับมากรอกใหม่ได้
            </p>

            {/* Name */}
            <Field label="ชื่อของคุณ" hint="ชื่อจริงหรือชื่อเล่นก็ได้ ใช้เรียกในพิธี">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="เช่น ปลายฟ้า"
                style={inputStyle}/>
            </Field>

            {/* Palm capture */}
            <Field label="ลายมือของคุณ" hint="วางฝ่ามือไว้ในกรอบ แล้วกดถ่ายภาพ">
              <PalmCapture value={palm} onChange={updatePalm} disabled={analyzing}/>
            </Field>

            {(palm && (analyzing || palmProcessingPanel)) && (
              <PalmProcessingPreview
                panel={palmProcessingPanel}
                status={readingStatus}/>
            )}

            <button className="btn btn-primary" disabled={!ready || analyzing}
              onClick={continueWithPalmReading}
              style={{ width: '100%', marginTop: 22, padding: '16px 22px',
                borderRadius: 18, justifyContent: 'space-between' }}>
              <span>{readingStatus === 'preprocessing' ? 'กำลังแสดงผล OpenCV...' : analyzing ? 'กำลังอ่านลายมือ...' : 'อ่านลายมือของฉัน'}</span>
              {analyzing ? <Icon.sparkle size={18}/> : <Icon.arrowR size={18}/>}
            </button>

            {!ready && (
              <p style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 12, textAlign: 'center' }}>
                กรุณากรอกข้อมูลให้ครบเพื่อเริ่มต้น
              </p>
            )}
            {readingError && (
              <p style={{ fontSize: 11, color: 'var(--c-coral)', marginTop: 12, textAlign: 'center', lineHeight: 1.5 }}>
                {readingError}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
window.LoginScreen = LoginScreen;

// ─────────────────────────────────────────────
const inputStyle = {
  width: '100%', padding: '14px 16px',
  borderRadius: 'var(--radius-input)',
  border: '1.5px solid var(--border-soft)',
  background: 'var(--surface-card)',
  fontSize: 15, fontFamily: 'inherit',
  color: 'var(--text-main)', outline: 'none',
  transition: 'border-color .15s, box-shadow .15s',
};

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-soft)' }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function PalmProcessingPreview({ panel, status }) {
  const done = Boolean(panel);
  const statusText = done
    ? (status === 'complete' ? 'ประมวลผลและอ่านลายมือสำเร็จ' : 'ประมวลผลภาพสำเร็จ กำลังรอคำอ่านจาก LLM')
    : 'กำลังแยกเส้นลายมือด้วย OpenCV';
  return (
    <div style={{
      border: '1px solid var(--border-soft)',
      borderRadius: 22,
      background: 'linear-gradient(180deg, rgba(255,255,255,.72), rgba(252,238,227,.78))',
      padding: 14,
      marginTop: -2,
      animation: 'float-up .28s ease both',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 3 }}>OpenCV Processing</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{statusText}</div>
        </div>
        <span className="badge" style={{ flexShrink: 0 }}>
          {done ? <Icon.check size={12} sw={2.5}/> : <span style={{
            width: 12, height: 12, borderRadius: '50%',
            border: '2px solid rgba(61,46,42,.18)', borderTopColor: 'var(--text-main)',
            animation: 'spin-mini .8s linear infinite',
          }}/>}
          {done ? 'เห็นเส้นแล้ว' : 'กำลังสแกน'}
        </span>
      </div>

      <ProcessingFrame label="OpenCV Processing" active={!done}>
        {panel ? (
          <img src={panel} alt="opencv palm processing panel" style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#121212' }}/>
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'grid', gridTemplateRows: '1fr 1fr', gap: 8,
            padding: 12, background: '#151313',
          }}>
            <ProcessingSkeleton title="palm crop"/>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              <ProcessingSkeleton title="contrast" small/>
              <ProcessingSkeleton title="lines" small/>
              <ProcessingSkeleton title="mask" small/>
            </div>
          </div>
        )}
      </ProcessingFrame>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {['crop', 'contrast', 'line response', 'mask'].map((step, index) => (
          <div key={step} style={{
            flex: 1,
            height: 5,
            borderRadius: 999,
            background: done
              ? 'var(--c-mint-deep)'
              : 'linear-gradient(90deg, var(--c-peach), var(--c-lavender), var(--c-mint))',
            backgroundSize: '200% 100%',
            animation: done ? 'none' : `shimmer 1.2s linear ${index * 0.12}s infinite`,
            opacity: done ? 0.75 : 1,
          }}/>
        ))}
      </div>
    </div>
  );
}

function ProcessingFrame({ label, active, children }) {
  return (
    <div style={{
      position: 'relative',
      minHeight: 156,
      aspectRatio: '4 / 3',
      overflow: 'hidden',
      borderRadius: 16,
      background: 'rgba(61,46,42,.08)',
      boxShadow: active ? 'var(--shadow-glow)' : 'inset 0 0 0 1px var(--border-soft)',
    }}>
      {children}
      <div style={{
        position: 'absolute', left: 10, top: 10,
        padding: '4px 8px',
        borderRadius: 999,
        background: 'rgba(255,255,255,.88)',
        color: 'var(--text-main)',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.08em',
      }}>
        {label}
      </div>
    </div>
  );
}

function ProcessingSkeleton({ title, small = false }) {
  return (
    <div style={{
      position: 'relative',
      borderRadius: 12,
      overflow: 'hidden',
      background: 'linear-gradient(110deg, rgba(255,255,255,.08), rgba(255,255,255,.22), rgba(255,255,255,.08))',
      backgroundSize: '220% 100%',
      animation: 'shimmer 1.1s linear infinite',
      minHeight: small ? 44 : 70,
    }}>
      <span style={{
        position: 'absolute', left: 9, top: 8,
        color: 'rgba(255,255,255,.74)',
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.08em',
      }}>
        {title}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// PalmCapture — live camera preview with palm guide overlay + capture
// ─────────────────────────────────────────────
function PalmCapture({ value, onChange, disabled = false }) {
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const [status, setStatus] = React.useState('idle'); // idle | starting | live | error | captured
  const [error, setError] = React.useState('');

  const start = React.useCallback(async () => {
    if (disabled) return;
    setStatus('starting'); setError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('เบราว์เซอร์ไม่รองรับการใช้กล้อง');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => {});
      }
      setStatus('live');
    } catch (e) {
      console.warn('camera error', e);
      setError(e.message || 'ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้องในเบราว์เซอร์');
      setStatus('error');
    }
  }, [disabled]);

  const stop = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(tr => tr.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  React.useEffect(() => () => stop(), [stop]);

  const capture = () => {
    if (disabled) return;
    const v = videoRef.current;
    if (!v || v.readyState < 2) return;
    const w = v.videoWidth || 480, h = v.videoHeight || 480;
    const c = canvasRef.current || document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    // mirror to match the un-mirrored stored capture (we visually mirror
    // the preview for selfie comfort, but save the natural orientation)
    ctx.save();
    ctx.translate(w, 0); ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, w, h);
    ctx.restore();
    onChange(c.toDataURL('image/jpeg', 0.82));
    setStatus('captured');
    stop();
  };

  const retake = () => {
    if (disabled) return;
    onChange(null);
    start();
  };

  // upload fallback
  const onFile = (e) => {
    if (disabled) return;
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { onChange(r.result); setStatus('captured'); };
    r.readAsDataURL(f);
  };

  return (
    <div style={{
      position: 'relative',
      borderRadius: 'var(--radius-input)',
      overflow: 'hidden',
      background: 'linear-gradient(160deg, var(--bg-soft), var(--surface-soft))',
      border: '1.5px dashed var(--border-medium)',
      aspectRatio: '4 / 3',
    }}>
      {/* idle */}
      {(status === 'idle' || status === 'starting' || status === 'error') && !value && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10, padding: 24, textAlign: 'center',
        }}>
          <PalmIcon active={false}/>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-main)' }}>
            ถ่ายภาพฝ่ามือของคุณ
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 260, lineHeight: 1.5 }}>
            กางมือออก ให้แสงสว่างพอ และวางฝ่ามือให้อยู่ในกรอบ
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={start} className="btn btn-primary" disabled={disabled}
              style={{ padding: '10px 18px', fontSize: 13 }}>
              {status === 'starting' ? 'กำลังเปิดกล้อง...' : 'เปิดกล้อง'}
            </button>
            <label className="btn btn-secondary" style={{ padding: '10px 16px', fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .6 : 1 }}>
              อัปโหลดภาพ
              <input type="file" accept="image/*" onChange={onFile} disabled={disabled} style={{ display: 'none' }}/>
            </label>
          </div>
          {error && (
            <div style={{
              marginTop: 8, padding: '8px 12px', borderRadius: 10,
              background: 'rgba(217,122,108,.12)', color: 'var(--c-coral)',
              fontSize: 11, maxWidth: 280, lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* live preview */}
      <video ref={videoRef} muted playsInline
        style={{
          width: '100%', height: '100%', objectFit: 'cover',
          display: status === 'live' && !value ? 'block' : 'none',
          transform: 'scaleX(-1)', /* selfie mirror */
        }}/>

      {status === 'live' && !value && (
        <>
          {/* palm guide overlay */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <PalmIcon active={true}/>
            <div style={{
              position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
              padding: '6px 14px', borderRadius: 999,
              background: 'rgba(0,0,0,.5)', color: '#fff',
              fontSize: 11, letterSpacing: '.04em',
            }}>
              วางฝ่ามือให้อยู่ในกรอบ
            </div>
          </div>
          {/* capture button */}
          <button type="button" onClick={capture}
            style={{
              position: 'absolute', bottom: -1, left: '50%', transform: 'translateX(-50%) translateY(50%)',
              width: 58, height: 58, borderRadius: '50%',
              background: '#fff', border: '3px solid var(--text-main)',
              cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,.18)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <span style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'var(--c-peach)',
            }}/>
          </button>
        </>
      )}

      {/* captured */}
      {value && (
        <>
          <img src={value} alt="palm"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
          <div style={{
            position: 'absolute', top: 10, right: 10,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px', borderRadius: 999,
            background: 'rgba(255,255,255,.92)',
            color: 'var(--text-main)', fontSize: 11, fontWeight: 500,
          }}>
            <Icon.check size={12} sw={2.4}/> ภาพถูกบันทึก
          </div>
          <button type="button" onClick={retake} disabled={disabled}
            style={{
              position: 'absolute', bottom: 10, right: 10,
              padding: '8px 14px', borderRadius: 999,
              background: 'var(--text-main)', color: 'var(--text-on-dark)',
              border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontFamily: 'inherit', opacity: disabled ? .62 : 1,
            }}>
            <Icon.refresh size={12} sw={2}/> ถ่ายใหม่
          </button>
        </>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }}/>
    </div>
  );
}

function PalmIcon({ active }) {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none"
      style={{ filter: active ? 'drop-shadow(0 4px 18px rgba(0,0,0,.25))' : 'none' }}>
      {/* outline glow */}
      <path d="M40 110 C30 110 25 100 25 90 L25 60 C25 56 28 53 32 53 C36 53 39 56 39 60 L39 70 L39 30 C39 26 42 23 46 23 C50 23 53 26 53 30 L53 60 L53 25 C53 21 56 18 60 18 C64 18 67 21 67 25 L67 60 L67 28 C67 24 70 21 74 21 C78 21 81 24 81 28 L81 64 L81 42 C81 38 84 35 88 35 C92 35 95 38 95 42 L95 80 C95 100 80 110 65 110 Z"
        stroke={active ? '#fff' : 'var(--text-soft)'}
        strokeWidth={active ? 2.2 : 1.6}
        strokeLinejoin="round"
        opacity={active ? 0.95 : 0.55}
        fill={active ? 'rgba(255,255,255,.05)' : 'none'}/>
      {/* corner brackets when active */}
      {active && [[10,10],[110,10],[10,110],[110,110]].map(([x,y], i) => (
        <path key={i}
          d={`M${x + (x<60?0:-14)} ${y+(y<60?14:-14)} L${x} ${y+(y<60?14:-14)} L${x} ${y} L${x + (x<60?14:-14)} ${y}`}
          stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity=".8"/>
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────
// WelcomeBack — shown on return visits (user already in localStorage)
// Greets the user + displays palm reading across 3 lines.
// ─────────────────────────────────────────────
function WelcomeBack({ user, onContinue, onForget }) {
  const reading = React.useMemo(() => analyzePalm(user), [user]);
  const pendingPalmReading = isPalmReadingPending(user);
  const failedPalmReading = user?.palmReadingStatus === 'error';
  const palmConclusion = pendingPalmReading
    ? 'กำลังอ่านลายมือของคุณอยู่เบื้องหลัง คุณสามารถเริ่มพิธีต่อได้ทันที เมื่อผลเสร็จแล้วคำอ่านทั้งสามเส้นจะอัปเดตเอง'
    : user?.palmReading?.conclusion || fallbackPalmConclusion(user);
  const palmStatusLabel = pendingPalmReading
    ? 'กำลังอ่าน'
    : failedPalmReading
      ? 'ใช้คำอ่านพื้นฐาน'
      : 'วิเคราะห์แล้ว';
  // Format date for display (Thai locale)
  const dobLabel = React.useMemo(() => {
    if (!user.dob) return '';
    try {
      const d = new Date(user.dob);
      return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return user.dob; }
  }, [user.dob]);

  return (
    <div className="proto" style={{ overflow: 'auto' }}>
      <Sparkles count={16}/>
      <BlobShape d={Blobs.one}  fill="rgba(242,181,160,.22)" style={{ width: 520, height: 520, top: -160, left: -160, filter: 'blur(20px)' }}/>
      <BlobShape d={Blobs.two}  fill="rgba(232,200,224,.22)" style={{ width: 600, height: 600, bottom: -220, right: -180, filter: 'blur(24px)' }}/>
      <BlobShape d={Blobs.three} fill="rgba(184,216,200,.16)" style={{ width: 460, height: 460, top: '20%', left: '55%', filter: 'blur(30px)' }}/>

      {/* Header */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
        padding: '24px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo/>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em' }}>NIMID D</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Mindful Ritual</span>
          </div>
        </div>
        <span className="badge"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-mint-deep)' }}/> ผู้เดินทางกลับมา</span>
      </header>

      {/* Body */}
      <main style={{
        position: 'absolute', inset: 0, paddingTop: 92,
        overflowY: 'auto',
        padding: '92px 48px 48px',
      }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>

          {/* Greeting row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '280px 1fr auto',
            gap: 36, alignItems: 'center', marginBottom: 36,
          }}>
            {/* user palm photo + identity */}
            <div style={{
              padding: 18, borderRadius: 28,
              background: 'var(--surface-card)',
              boxShadow: 'var(--shadow-card)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 200, height: 160, borderRadius: 18, overflow: 'hidden',
                background: 'linear-gradient(160deg, var(--bg-soft), var(--surface-soft))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                {user.palm
                  ? <img src={user.palm} alt="palm" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  : <PalmIcon active={false}/>}
                {/* badge corner */}
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  padding: '4px 8px', borderRadius: 999,
                  background: 'rgba(255,255,255,.9)', color: 'var(--text-main)',
                  fontSize: 10, fontWeight: 500, letterSpacing: '.04em',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <Icon.sparkle size={10}/> {palmStatusLabel}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase' }}>ลายมือของ</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, marginTop: 2 }}>{user.name}</div>
                {dobLabel && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>เกิด · {dobLabel}</div>}
              </div>
            </div>

            <div>
              <div className="eyebrow" style={{ marginBottom: 12 }}>ยินดีต้อนรับกลับมา</div>
              <h1 style={{ fontSize: 52, lineHeight: 1.1, marginBottom: 14, textWrap: 'balance' }}>
                สวัสดีอีกครั้ง<br/>
                <span style={{
                  background: 'linear-gradient(120deg, var(--c-peach-deep), var(--c-lavender-deep))',
                  WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
                }}>คุณ{user.name}</span>
              </h1>
              <p style={{ fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 560 }}>
                {pendingPalmReading
                  ? 'ระบบกำลังอ่านลายมือของคุณอยู่เบื้องหลัง ระหว่างนี้คุณเริ่มพิธีต่อได้เลย'
                  : 'เราได้อ่านลายมือของคุณจากครั้งก่อนแล้ว ทั้ง ๓ เส้นด้านล่างคือสิ่งที่ลายมือของคุณกำลังบอกในช่วงเวลานี้'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn btn-primary" onClick={() => onContinue(user)}
                style={{ padding: '16px 26px', borderRadius: 18 }}>
                เข้าสู่พิธีต่อ <Icon.arrowR size={18}/>
              </button>
              <button className="btn btn-tertiary" onClick={onForget}
                style={{ padding: '10px 16px', fontSize: 13 }}>
                <Icon.refresh size={14}/> ลงทะเบียนใหม่
              </button>
            </div>
          </div>

          {/* Palm lines grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {reading.map((line, i) => (
              <PalmLineCard key={line.id} line={line} index={i}/>
            ))}
          </div>

          {palmConclusion && (
            <div className="card" style={{
              marginTop: 18,
              padding: 26,
              borderRadius: 24,
              background: 'linear-gradient(160deg, rgba(242,181,160,.18), rgba(184,216,200,.14))',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                top: -32,
                right: -28,
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'rgba(255,255,255,.45)',
                pointerEvents: 'none',
              }}/>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  background: 'var(--text-main)',
                  color: 'var(--text-on-dark)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon.sparkle size={16}/>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                    Palm Reading
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, marginTop: 2 }}>
                    บทสรุปดวงชะตา
                  </h3>
                </div>
              </div>
              <p style={{
                fontSize: 15,
                lineHeight: 1.8,
                color: 'var(--text-main)',
                maxWidth: 980,
                textWrap: 'pretty',
              }}>
                {palmConclusion}
              </p>
            </div>
          )}

          <p style={{
            fontSize: 11, color: 'var(--text-soft)', lineHeight: 1.6,
            marginTop: 22, textAlign: 'center', maxWidth: 560, margin: '22px auto 0',
          }}>
            การวิเคราะห์ลายมือเป็นเพียงเครื่องมือสะท้อนความคิด ไม่ใช่การพยากรณ์ที่แน่นอน
            โปรดใช้ดุลพินิจของตัวเองประกอบการตัดสินใจ
          </p>
        </div>
      </main>
    </div>
  );
}
window.WelcomeBack = WelcomeBack;

function fallbackPalmConclusion(user) {
  const name = user?.name ? `คุณ${user.name}` : 'เจ้าชะตา';
  return `${name}มีพื้นดวงที่ค่อยๆ เติบโตจากความอดทนและการเรียนรู้ เส้นทั้งสามสะท้อนคนที่มีใจละเอียด คิดรอบด้าน และยังมีพลังชีวิตให้เดินต่อได้แม้ผ่านช่วงกดดัน บทสรุปคือจังหวะนี้เหมาะกับการตั้งใจให้มั่น ใช้สติคุมใจ และเลือกทางที่ทำให้ตัวเองมั่นคงขึ้นทีละขั้น`;
}

// ─────────────────────────────────────────────
function PalmLineCard({ line, index }) {
  return (
    <div className="card" style={{
      padding: 22, position: 'relative', overflow: 'hidden',
      animation: `float-up .6s cubic-bezier(.3,.7,.4,1.4) ${index * 0.08}s both`,
    }}>
      {/* line illustration in the corner */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 160, height: 130,
        opacity: 0.18, pointerEvents: 'none',
      }}>
        <svg viewBox="0 0 120 120" width="100%" height="100%">
          <path d={line.pathD} fill="none" stroke={line.color}
            strokeWidth="3.5" strokeLinecap="round"/>
        </svg>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{line.sub}</div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, marginTop: 2 }}>{line.name}</h3>
        </div>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500,
          color: 'var(--text-soft)', fontVariantNumeric: 'tabular-nums',
        }}>๐{index + 1}</span>
      </div>

      {/* line visual — palm with this line highlighted */}
      <div style={{
        height: 110, borderRadius: 14,
        background: `linear-gradient(160deg, ${line.color}22, ${line.color}08)`,
        position: 'relative', overflow: 'hidden',
        marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <PalmWithLine line={line}/>
      </div>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 12px', borderRadius: 999,
        background: line.color, color: '#fff',
        fontSize: 12, fontWeight: 500, marginBottom: 12,
      }}>
        <Icon.sparkle size={11}/> {line.reading.tone}
      </div>

      <p style={{
        fontSize: 14, lineHeight: 1.7, color: 'var(--text-main)',
        textWrap: 'pretty', marginBottom: 12,
      }}>
        {line.reading.text}
      </p>

      <div style={{
        fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5,
        paddingTop: 12, borderTop: '1px dashed var(--border-soft)',
      }}>
        <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>เกี่ยวกับเส้นนี้ · </span>
        {line.hint}
      </div>
    </div>
  );
}

// Small palm SVG with the active line drawn over it (for the line card)
function PalmWithLine({ line }) {
  return (
    <svg viewBox="0 0 120 120" width="130" height="130" style={{ display: 'block' }}>
      <path
        d="M40 110 C30 110 25 100 25 90 L25 60 C25 56 28 53 32 53 C36 53 39 56 39 60 L39 70 L39 30 C39 26 42 23 46 23 C50 23 53 26 53 30 L53 60 L53 25 C53 21 56 18 60 18 C64 18 67 21 67 25 L67 60 L67 28 C67 24 70 21 74 21 C78 21 81 24 81 28 L81 64 L81 42 C81 38 84 35 88 35 C92 35 95 38 95 42 L95 80 C95 100 80 110 65 110 Z"
        fill="rgba(255,255,255,.7)" stroke="var(--text-soft)" strokeWidth="1.4" strokeLinejoin="round" opacity=".5"/>
      {/* the active line — animated dash to draw in */}
      <path d={line.pathD} fill="none" stroke={line.color}
        strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="200" strokeDashoffset="200">
        <animate attributeName="stroke-dashoffset" from="200" to="0" dur="1.4s" fill="freeze"/>
      </path>
      {/* sparkle endpoints */}
      <circle cx={line.pathD.split(' ')[1]} cy={line.pathD.split(' ')[2]}
        r="3" fill={line.color}>
        <animate attributeName="r" values="2;4;2" dur="2s" repeatCount="indefinite"/>
      </circle>
    </svg>
  );
}
// setup.tsx — Pre-Ritual Setup screen
// All ritual options on one calm page, two-column editorial layout.

function SetupScreen({ state, setState, onContinue }) {
  const pick = (key, value) => setState(s => ({ ...s, [key]: value }));
  const toggleMood = (m) => setState(s => ({
    ...s,
    moods: s.moods.includes(m) ? s.moods.filter(x => x !== m) : [...s.moods, m],
  }));
  const reset = () => setState({
    activity: null, feeling: '', moods: [], temple: 'thai',
    box: 'gold', category: 'work', music: 'bell',
  });

  const sel = (k, v) => state[k] === v;

  return (
    <AppShell step={0}>
      <div style={{
        position: 'absolute', inset: 0,
        overflowY: 'auto', padding: '0 48px 48px',
      }}>
        {/* Page header */}
        <div style={{ maxWidth: 1340, margin: '0 auto', paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
            <div style={{ maxWidth: 560 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>ขั้นตอนที่ ๑ · เตรียมพิธี</div>
              <h1 style={{ fontSize: 44, lineHeight: 1.15, marginBottom: 12, textWrap: 'pretty' }}>
                เตรียมใจก่อน<br/>เสี่ยงเซียมซี
              </h1>
              <p style={{ fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.55, maxWidth: 460 }}>
                เลือกบรรยากาศ ตั้งเจตนา และบันทึกความรู้สึกของคุณก่อนเริ่มพิธี เซียมซีจะเดินทางไปกับคุณอย่างนุ่มนวล
              </p>
            </div>
            <div className="glass" style={{ padding: 16, borderRadius: 20, display: 'flex', alignItems: 'center', gap: 12, maxWidth: 320 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14,
                background: 'var(--c-mint)', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon.lotus size={22} color="var(--text-main)"/>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                ทุกขั้นตอนเป็นไปอย่างนุ่มนวล คุณสามารถหยุดพักหรือกลับมาเริ่มใหม่ได้เสมอ
              </div>
            </div>
          </div>

          {/* Two-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 32 }}>
            {/* LEFT: scrollable option sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

              {/* 1) Activity */}
              <Section num="๑" title="กิจกรรมเตรียมใจ" hint="เลือกหนึ่งกิจกรรมก่อนเริ่มพิธี ใช้เวลา ๑ นาที">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {ACTIVITIES.map(a => (
                    <SelectCard key={a.id} active={sel('activity', a.id)} onClick={() => pick('activity', a.id)} padding={22}>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        <ActivityArt id={a.id} active={sel('activity', a.id)}/>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500 }}>{a.name}</span>
                            <span className="badge">๑ นาที</span>
                          </div>
                          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{a.desc}</p>
                        </div>
                      </div>
                    </SelectCard>
                  ))}
                </div>
              </Section>

              {/* 2) Pre-Ritual Feeling */}
              <Section num="๒" title="บันทึกความรู้สึก" hint="ก่อนเริ่มพิธี ตอนนี้คุณรู้สึกอย่างไร?">
                <div className="card" style={{ padding: 22 }}>
                  <textarea
                    value={state.feeling}
                    onChange={(e) => pick('feeling', e.target.value)}
                    placeholder="เช่น วันนี้รู้สึกกังวลเรื่องงาน อยากได้คำแนะนำบางอย่าง..."
                    style={{
                      width: '100%', minHeight: 92,
                      border: 'none', outline: 'none', resize: 'vertical',
                      background: 'transparent', fontFamily: 'inherit',
                      fontSize: 15, lineHeight: 1.6, color: 'var(--text-main)',
                    }}/>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                    {MOODS_PRE.map(m => (
                      <span key={m}
                        className={`chip ${state.moods.includes(m) ? 'active' : ''}`}
                        onClick={() => toggleMood(m)}>
                        {state.moods.includes(m) && <Icon.check size={12} sw={2.6}/>} {m}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 14, lineHeight: 1.5 }}>
                    ข้อความนี้จะถูกใช้เพื่อวิเคราะห์แนวโน้มความรู้สึก และปรับปรุงประสบการณ์ในอนาคต
                  </p>
                </div>
              </Section>

              {/* 3) Temple Style */}
              <Section num="๓" title="บรรยากาศวัด" hint="เลือกฉากที่อยากเสี่ยงเซียมซีในวันนี้">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {TEMPLES.map(t => (
                    <SelectCard key={t.id} active={sel('temple', t.id)} onClick={() => pick('temple', t.id)} padding={0}>
                      <TempleArt temple={t}/>
                      <div style={{ padding: '14px 18px 18px' }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, marginBottom: 4 }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>{t.sub}</div>
                      </div>
                    </SelectCard>
                  ))}
                </div>
              </Section>

              {/* 4) Box Selection */}
              <Section num="๔" title="กล่องเซียมซี" hint="เลือกลวดลายและสีของกล่องไม้">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {BOXES.map(b => (
                    <SelectCard key={b.id} active={sel('box', b.id)} onClick={() => pick('box', b.id)} padding={16}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                          width: 84, height: 72, borderRadius: 14,
                          background: 'linear-gradient(135deg, var(--bg-soft), var(--surface-soft))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <BoxPreview wood={b.wood} trim={b.trim} size={72}/>
                        </div>
                        <div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500 }}>{b.name}</div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                            <span style={{ width: 12, height: 12, borderRadius: 4, background: b.wood }}/>
                            <span style={{ width: 12, height: 12, borderRadius: 4, background: b.trim }}/>
                          </div>
                        </div>
                      </div>
                    </SelectCard>
                  ))}
                </div>
              </Section>

              {/* 5) Category */}
              <Section num="๕" title="หมวดคำทำนาย" hint="ตั้งใจว่าอยากได้คำแนะนำเรื่องอะไรเป็นพิเศษ">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                  {CATEGORIES.map(c => {
                    const IconC = Icon[c.icon];
                    return (
                      <SelectCard key={c.id} active={sel('category', c.id)} onClick={() => pick('category', c.id)} padding={20}>
                        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 14,
                            background: sel('category', c.id) ? 'var(--text-main)' : 'var(--bg-soft)',
                            color: sel('category', c.id) ? 'var(--text-on-dark)' : 'var(--text-main)',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all .2s',
                          }}>
                            <IconC size={22}/>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, marginBottom: 4 }}>{c.name}</div>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{c.desc}</p>
                          </div>
                        </div>
                      </SelectCard>
                    );
                  })}
                </div>
              </Section>

              {/* 6) Music */}
              <Section num="๖" title="เพลงประกอบพิธี" hint="เลือกเสียงที่จะช่วยให้ใจอยู่กับปัจจุบัน">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {MUSIC.map(m => (
                    <SelectCard key={m.id} active={sel('music', m.id)} onClick={() => pick('music', m.id)} padding={14}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span onClick={(e) => e.stopPropagation()} role="button" style={{
                          width: 38, height: 38, borderRadius: '50%',
                          background: sel('music', m.id) ? 'var(--text-main)' : 'var(--bg-soft)',
                          color: sel('music', m.id) ? 'var(--text-on-dark)' : 'var(--text-main)',
                          cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Icon.play size={14}/>
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 2 }}>{m.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.mood}</div>
                        </div>
                        <Waveform active={sel('music', m.id)}/>
                        <span style={{ fontSize: 11, color: 'var(--text-soft)', fontVariantNumeric: 'tabular-nums' }}>{m.duration}</span>
                      </div>
                    </SelectCard>
                  ))}
                </div>
              </Section>
            </div>

            {/* RIGHT: sticky summary */}
            <aside style={{ position: 'sticky', top: 8, alignSelf: 'start' }}>
              <SummaryPanel state={state} onContinue={onContinue} onReset={reset}/>
            </aside>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
window.SetupScreen = SetupScreen;

// ─────────────────────────────────────────────
function Section({ num, title, hint, children }) {
  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-soft)',
          fontVariantNumeric: 'tabular-nums', minWidth: 18 }}>{num}</span>
        <h3 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.01em' }}>{title}</h3>
      </div>
      {hint && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, marginLeft: 28 }}>{hint}</p>}
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────
function ActivityArt({ id, active }) {
  if (id === 'meditate') {
    return (
      <div style={{
        width: 64, height: 64, borderRadius: 18, flexShrink: 0,
        background: 'linear-gradient(135deg, var(--c-lavender), #F5E2EE)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <circle cx="22" cy="22" r="18" stroke="#fff" strokeWidth="1.5" opacity=".5"/>
          <circle cx="22" cy="22" r="12" stroke="#fff" strokeWidth="1.5" opacity=".7"/>
          <circle cx="22" cy="22" r="6" fill="#fff"/>
          <circle cx="22" cy="22" r="2.5" fill="var(--c-lavender-deep)"/>
        </svg>
      </div>
    );
  }
  return (
    <div style={{
      width: 64, height: 64, borderRadius: 18, flexShrink: 0,
      background: 'linear-gradient(135deg, var(--c-mint), #DCE9DD)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <path d="M6 32 Q22 28 38 32" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity=".7"/>
        <circle cx="12" cy="30" r="3" fill="#fff"/>
        <circle cx="22" cy="28" r="3.5" fill="#fff"/>
        <circle cx="32" cy="30" r="3" fill="#fff"/>
        <path d="M22 24v-4M22 16v-2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity=".6"/>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────
function TempleArt({ temple }) {
  const [c1, c2, c3] = temple.swatch;
  return (
    <div style={{
      height: 130, borderRadius: 'var(--radius-card) var(--radius-card) 0 0',
      background: `linear-gradient(160deg, ${c2}, ${c1})`,
      position: 'relative', overflow: 'hidden',
    }}>
      <TempleOrnament temple={temple.id} style={{ position: 'absolute', top: 8, left: 0, width: '100%', height: 30 }}/>
      {/* roof silhouette */}
      <svg width="100%" height="80" viewBox="0 0 200 80" style={{ position: 'absolute', bottom: 0 }}>
        {temple.id === 'thai' && (
          <>
            <path d="M0 80 L0 50 L40 50 L60 30 L100 8 L140 30 L160 50 L200 50 L200 80 Z" fill={temple.accent} opacity=".85"/>
            <path d="M100 8 L100 28 M85 26 L115 26" stroke="#FBF2EA" strokeWidth="2" strokeLinecap="round"/>
            <rect x="92" y="50" width="16" height="30" fill="#FBF2EA" opacity=".7"/>
          </>
        )}
        {temple.id === 'chinese' && (
          <>
            <path d="M0 80 L0 56 L20 56 L36 38 L46 30 L60 36 L80 36 L100 22 L120 36 L140 36 L154 30 L164 38 L180 56 L200 56 L200 80 Z" fill={temple.accent} opacity=".85"/>
            <circle cx="50" cy="48" r="6" fill="#FBF2EA" opacity=".8"/>
            <circle cx="150" cy="48" r="6" fill="#FBF2EA" opacity=".8"/>
            <rect x="50" y="42" width="2" height="14" fill="#FBF2EA" opacity=".6"/>
            <rect x="150" y="42" width="2" height="14" fill="#FBF2EA" opacity=".6"/>
          </>
        )}
        {temple.id === 'japanese' && (
          <>
            {/* torii */}
            <rect x="50" y="40" width="100" height="6" rx="2" fill={temple.accent}/>
            <rect x="44" y="32" width="112" height="6" rx="2" fill={temple.accent}/>
            <rect x="62" y="38" width="6" height="42" fill={temple.accent}/>
            <rect x="132" y="38" width="6" height="42" fill={temple.accent}/>
            <rect x="78" y="46" width="44" height="3" fill={temple.accent} opacity=".5"/>
          </>
        )}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────
function Waveform({ active }) {
  const heights = [6, 12, 16, 10, 18, 8, 14, 6, 10];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 18 }}>
      {heights.map((h, i) => (
        <span key={i} style={{
          width: 2, height: h, borderRadius: 1,
          background: active ? 'var(--text-main)' : 'var(--text-soft)',
          opacity: active ? 0.85 : 0.4,
          animation: active ? `float-y ${1 + (i % 3) * 0.3}s ease-in-out ${i * 0.08}s infinite` : 'none',
        }}/>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
function SummaryPanel({ state, onContinue, onReset }) {
  const t = TEMPLES.find(x => x.id === state.temple);
  const b = BOXES.find(x => x.id === state.box);
  const c = CATEGORIES.find(x => x.id === state.category);
  const m = MUSIC.find(x => x.id === state.music);
  const a = ACTIVITIES.find(x => x.id === state.activity);
  const ready = !!state.activity && !!state.feeling.trim();
  const rows = [
    { k: 'กิจกรรม', v: a ? a.name : '— ยังไม่เลือก', tone: a ? 'on' : 'muted' },
    { k: 'ความรู้สึกก่อนเริ่ม', v: state.feeling.trim() ? `${state.feeling.trim().slice(0, 38)}${state.feeling.length > 38 ? '…' : ''}` : '— ยังไม่บันทึก', tone: state.feeling.trim() ? 'on' : 'muted' },
    { k: 'สถานที่', v: t.name, tone: 'on', swatch: t.swatch[0] },
    { k: 'กล่องเซียมซี', v: b.name, tone: 'on', swatch: b.wood },
    { k: 'หมวดคำทำนาย', v: c.name, tone: 'on' },
    { k: 'เพลง', v: m.name, tone: 'on' },
  ];

  return (
    <div className="glass" style={{ padding: 24, borderRadius: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h3 style={{ fontSize: 18, fontWeight: 500 }}>สรุปพิธี</h3>
        <span className="eyebrow">Summary</span>
      </div>

      {/* mini scene preview */}
      <div style={{
        height: 130, borderRadius: 20,
        background: `linear-gradient(160deg, ${t.swatch[1]}, ${t.swatch[0]})`,
        marginBottom: 18, position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}>
        <Sparkles count={6} color="#FBF2EA"/>
        <div style={{ position: 'absolute', top: 12, left: 0, right: 0, height: 24 }}>
          <TempleOrnament temple={t.id}/>
        </div>
        <div style={{ marginBottom: 12 }}>
          <BoxPreview wood={b.wood} trim={b.trim} size={68}/>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.k}</span>
            <span style={{
              fontSize: 13, fontWeight: 500,
              color: r.tone === 'on' ? 'var(--text-main)' : 'var(--text-soft)',
              display: 'inline-flex', alignItems: 'center', gap: 6, textAlign: 'right',
            }}>
              {r.swatch && <span style={{ width: 10, height: 10, borderRadius: 3, background: r.swatch }}/>}
              {r.v}
            </span>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" disabled={!ready} onClick={onContinue}
        style={{ width: '100%', justifyContent: 'space-between', padding: '16px 22px', borderRadius: 18 }}>
        <span>เข้าสู่พิธีเสี่ยงเซียมซี</span>
        <Icon.arrowR size={18}/>
      </button>
      <button className="btn btn-tertiary" onClick={onReset}
        style={{ width: '100%', marginTop: 8, padding: 10 }}>
        ล้างค่าที่เลือก
      </button>

      {!ready && (
        <p style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 12, textAlign: 'center', lineHeight: 1.5 }}>
          กรุณาเลือกกิจกรรมและบันทึกความรู้สึกของคุณก่อน
        </p>
      )}
    </div>
  );
}
// meditation.tsx — Phase 2: 1-minute mindful activity
// Either breathing animation (meditate) or walking path (walk).

const BREATH_MIN_SCALE = 0.55;
const BREATH_MAX_SCALE = 0.86;
const easeBreath = (value) => 0.5 - Math.cos(Math.PI * Math.max(0, Math.min(1, value))) * 0.5;

function MeditationScreen({ state, onContinue, onBack }) {
  const total = 60;
  const [t, setT] = React.useState(0);
  const [running, setRunning] = React.useState(true);
  const ref = React.useRef(0);
  const autoContinueRef = React.useRef(false);

  React.useEffect(() => {
    let raf;
    let last = performance.now();
    const tick = (now) => {
      if (running) {
        const dt = (now - last) / 1000;
        ref.current = Math.min(total, ref.current + dt);
        setT(ref.current);
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const remaining = Math.max(0, total - t);
  const done = t >= total;
  const isMeditate = state.activity === 'meditate';

  React.useEffect(() => {
    if (!done || autoContinueRef.current) return;
    autoContinueRef.current = true;
    setRunning(false);
    onContinue?.();
  }, [done, onContinue]);

  // breath cycle: 4s in, 4s hold, 4s out, 4s rest
  const breathPhase = (() => {
    const cycle = t % 16;
    if (cycle < 4) {
      const progress = easeBreath(cycle / 4);
      return {
        key: 'inhale',
        label: 'หายใจเข้า',
        scale: BREATH_MIN_SCALE + (BREATH_MAX_SCALE - BREATH_MIN_SCALE) * progress,
        opacity: 0.68 + progress * 0.27,
        haloOpacity: 0.18 + progress * 0.22,
        centerOpacity: 0.78 + progress * 0.18,
      };
    }
    if (cycle < 8) {
      return {
        key: 'hold',
        label: 'กลั้นไว้',
        scale: BREATH_MAX_SCALE,
        opacity: 0.95,
        haloOpacity: 0.4,
        centerOpacity: 0.96,
      };
    }
    if (cycle < 12) {
      const progress = easeBreath((cycle - 8) / 4);
      return {
        key: 'exhale',
        label: 'หายใจออก',
        scale: BREATH_MAX_SCALE - (BREATH_MAX_SCALE - BREATH_MIN_SCALE) * progress,
        opacity: 0.95 - progress * 0.25,
        haloOpacity: 0.36 - progress * 0.18,
        centerOpacity: 0.94 - progress * 0.2,
      };
    }
    return {
      key: 'rest',
      label: 'พักหายใจ',
      scale: BREATH_MIN_SCALE,
      opacity: 0.32,
      haloOpacity: 0.08,
      centerOpacity: 0.58,
    };
  })();

  return (
    <AppShell step={1}>
      <div style={{
        position: 'absolute', inset: 0, paddingTop: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: 1200, maxWidth: '100%', padding: '0 48px', display: 'grid', gridTemplateColumns: '1fr 480px', gap: 64, alignItems: 'center' }}>

          {/* LEFT: copy + countdown */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 14 }}>ขั้นตอนที่ ๒ · เตรียมใจ</div>
            <h1 style={{ fontSize: 56, lineHeight: 1.1, marginBottom: 18, textWrap: 'balance' }}>
              {isMeditate ? 'หายใจช้า ๆ' : 'เดินอย่างมีสติ'}
              <br/>
              <span style={{ color: 'var(--text-muted)', fontWeight: 300 }}>
                ใช้เวลากับใจสักครู่
              </span>
            </h1>
            <p style={{ fontSize: 18, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 36, maxWidth: 440 }}>
              {isMeditate
                ? 'หลับตา หายใจเข้าและออกตามจังหวะของวงกลม ปล่อยทุกความคิดให้ผ่านไปเหมือนเมฆบนท้องฟ้า'
                : 'รับรู้ทุกก้าวที่คุณเดิน รับรู้ลมหายใจ รับรู้พื้นใต้ฝ่าเท้า ค่อย ๆ เดินก่อนเริ่มพิธี'}
            </p>

            {/* Countdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 32, marginBottom: 36 }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 72, fontWeight: 300,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1, letterSpacing: '-0.03em',
                color: 'var(--text-main)',
              }}>
                {String(Math.floor(remaining / 60)).padStart(1, '0')}:{String(Math.floor(remaining % 60)).padStart(2, '0')}
              </div>
              <div>
                <div className="eyebrow" style={{ marginBottom: 4 }}>เวลาที่เหลือ</div>
                <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                  {isMeditate ? breathPhase.label : (Math.floor(t / 4) % 2 === 0 ? 'ก้าวซ้าย' : 'ก้าวขวา')}
                </div>
              </div>
            </div>

            {/* progress bar */}
            <div style={{
              height: 6, borderRadius: 3, background: 'var(--bg-soft)',
              overflow: 'hidden', marginBottom: 36, maxWidth: 460,
            }}>
              <div style={{
                width: `${(t / total) * 100}%`, height: '100%',
                background: 'linear-gradient(90deg, var(--c-peach), var(--c-lavender), var(--c-mint))',
                transition: 'width .1s linear',
                borderRadius: 3,
              }}/>
            </div>

            {/* controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="btn btn-tertiary" onClick={onBack}>
                <Icon.arrowL size={16}/> ย้อนกลับ
              </button>
              <button className="btn btn-secondary" onClick={() => setRunning(r => !r)}
                style={{ padding: '12px 22px' }}>
                {running ? <><Icon.pause size={14}/> หยุดชั่วคราว</> : <><Icon.play size={14}/> ทำต่อ</>}
              </button>
              <button className="btn btn-primary" onClick={onContinue}
                style={{ marginLeft: 'auto', padding: '14px 28px' }}>
                ไปยังจุดเสี่ยงเซียมซี <Icon.arrowR size={16}/>
              </button>
            </div>

            {!done && (
              <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 14, lineHeight: 1.5 }}>
                ไปต่อได้ทันที หรืออยู่กับจังหวะนี้ให้ครบ ๑ นาทีก่อนเริ่มพิธี
              </p>
            )}
          </div>

          {/* RIGHT: visual */}
          <div style={{
            position: 'relative', width: '100%', aspectRatio: '1/1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isMeditate ? (
              <BreathingVisual phase={breathPhase}/>
            ) : (
              <WalkingVisual t={t}/>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
window.MeditationScreen = MeditationScreen;

// ─────────────────────────────────────────────
function BreathingVisual({ phase }) {
  const restTransition = phase.key === 'rest' ? 'opacity .45s ease' : 'opacity .18s linear';
  return (
    <div style={{ position: 'relative', width: 460, height: 460 }}>
      {/* outermost halo */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(242,181,160,.25), transparent 70%)',
        opacity: phase.haloOpacity,
        transform: `scale(${0.9 + phase.scale * 0.2})`,
        transition: restTransition,
        willChange: 'transform, opacity',
      }}/>
      {/* breathing ring stack */}
      {[1, 0.85, 0.7, 0.55, 0.4].map((s, i) => (
        <div key={i} style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          border: `${i === 0 ? 2 : 1.2}px solid var(--c-peach-deep)`,
          opacity: phase.opacity * (0.9 - i * 0.15),
          transform: `scale(${phase.scale * s})`,
          transition: restTransition,
          willChange: 'transform, opacity',
        }}/>
      ))}
      {/* lotus center */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 140, height: 140, marginTop: -70, marginLeft: -70,
        borderRadius: '50%',
        background: 'radial-gradient(circle, var(--c-peach), var(--c-lavender))',
        boxShadow: '0 0 60px rgba(242,181,160,.5)',
        opacity: phase.centerOpacity,
        transform: `scale(${0.85 + phase.scale * 0.15})`,
        transition: restTransition,
        willChange: 'transform, opacity',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon.lotus size={64} color="#FBF2EA" sw={1.4}/>
      </div>
      {/* floating sparkles */}
      <Sparkles count={14} color="var(--c-gold)" style={{ pointerEvents: 'none' }}/>
      {/* phase label */}
      <div style={{
        position: 'absolute', bottom: -10, left: 0, right: 0,
        textAlign: 'center',
        fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 400,
        color: 'var(--text-main)', letterSpacing: '0.04em',
      }}>{phase.label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────
function WalkingVisual({ t }) {
  // path of stepping stones around a soft pond
  const steps = 12;
  const cur = Math.floor(t / (60 / steps));
  return (
    <div style={{ position: 'relative', width: 460, height: 460 }}>
      <div style={{
        position: 'absolute', inset: 30, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(184,216,200,.4), rgba(184,216,200,.1) 60%)',
      }}/>
      <svg width="460" height="460" viewBox="0 0 460 460" style={{ position: 'absolute', inset: 0 }}>
        {/* spiral path */}
        <path d="M230 100 Q360 130 360 230 Q360 360 230 360 Q100 360 100 230 Q100 130 230 100 Q300 110 320 200"
          fill="none" stroke="var(--c-mint-deep)" strokeWidth="2"
          strokeDasharray="3 6" opacity=".5"/>

        {/* stepping stones */}
        {Array.from({ length: steps }).map((_, i) => {
          const angle = (i / steps) * Math.PI * 2 - Math.PI / 2;
          const r = 140 - i * 4;
          const cx = 230 + Math.cos(angle) * r;
          const cy = 230 + Math.sin(angle) * r;
          const active = i === cur;
          const done = i < cur;
          return (
            <g key={i}>
              {active && (
                <circle cx={cx} cy={cy} r={26} fill="var(--c-peach)" opacity=".35">
                  <animate attributeName="r" values="22;32;22" dur="2s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values=".5;0;.5" dur="2s" repeatCount="indefinite"/>
                </circle>
              )}
              <ellipse cx={cx} cy={cy} rx="18" ry="13"
                fill={active ? 'var(--c-peach)' : done ? 'var(--c-mint-deep)' : '#fff'}
                stroke="var(--text-main)" strokeWidth=".8" opacity={done || active ? 1 : .6}/>
              {active && (
                <circle cx={cx} cy={cy} r="4" fill="#fff"/>
              )}
            </g>
          );
        })}

        {/* center lotus */}
        <g transform="translate(230,230)">
          <circle r="34" fill="var(--c-mint)" opacity=".5"/>
          <circle r="22" fill="#fff"/>
          <circle r="6" fill="var(--c-mint-deep)"/>
        </g>
      </svg>
      <Sparkles count={10} color="var(--c-mint-deep)"/>
    </div>
  );
}

function EnergyGraphBackground({ samples, active, color = 'var(--c-gold)' }) {
  const gradientId = React.useId().replace(/:/g, '');
  const glowId = `${gradientId}-glow`;
  const { linePath, areaPath } = React.useMemo(() => {
    const points = samples.slice(-72);
    if (points.length < 2) return { linePath: '', areaPath: '' };
    const maxValue = Math.max(1.6, ...points.map(point => finiteNumber(point.value)));
    const step = points.length > 1 ? 100 / (points.length - 1) : 100;
    const path = points.map((point, index) => {
      const value = Math.max(0, finiteNumber(point.value));
      const x = index * step;
      const y = 88 - Math.min(1, value / maxValue) * 70;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
    return {
      linePath: path,
      areaPath: `${path} L 100 96 L 0 96 Z`,
    };
  }, [samples]);

  return (
    <div style={{
      position: 'absolute',
      left: '50%',
      top: '52%',
      width: 'min(820px, 76vw)',
      height: 'min(360px, 42vh)',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: 0,
      opacity: linePath ? (active ? 0.78 : 0.42) : 0,
      transition: 'opacity .28s ease',
      filter: 'saturate(1.15)',
    }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={color} stopOpacity="0.05"/>
            <stop offset="0.45" stopColor={color} stopOpacity="0.72"/>
            <stop offset="1" stopColor="var(--c-peach)" stopOpacity="0.18"/>
          </linearGradient>
          <filter id={glowId} x="-18%" y="-60%" width="136%" height="220%">
            <feGaussianBlur stdDeviation="1.9" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {[20, 40, 60, 80].map(y => (
          <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgba(255,255,255,.18)" strokeWidth="0.22"/>
        ))}
        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} opacity="0.28"/>}
        {linePath && (
          <>
            <path d={linePath} fill="none" stroke={color} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.2" filter={`url(#${glowId})`}/>
            <path d={linePath} fill="none" stroke={color} strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" opacity="0.92"/>
          </>
        )}
      </svg>
    </div>
  );
}
// shake.tsx — Phase 3: Real Three.js shake ritual scene
// Stylized low-poly temple diorama. Click box to shake; meter fills; one
// stick rises out. Plays a soft bell tone on completion.

const SHAKE_REVEAL_POPUP_DELAY_MS = 2100;
const SHAKE_RESULT_AUTO_ADVANCE_MS = 3000;

function ShakeScreen({ state, setState, onContinue, onBack, detail = 'med', vol = 0.5 }) {
  const mountRef = React.useRef(null);
  const sceneApiRef = React.useRef(null);
  const onShakeRef = React.useRef(null);
  const lastEnergyAtRef = React.useRef(0);
  const energyGraphRef = React.useRef([]);
  const lastEnergyGraphCommitRef = React.useRef(0);
  const shakeRecorderRef = React.useRef({ startedAt: null, startedAtMs: null, samples: [], complete: false });
  const [intentEnergy, setIntentEnergy] = React.useState(0);
  const [energyGraph, setEnergyGraph] = React.useState([]);
  const [phase, setPhase] = React.useState('ready'); // ready | shaking | revealed
  const [revealedStickNumber, setRevealedStickNumber] = React.useState(null);
  const [mqttStatus, setMqttStatus] = React.useState(window.__mqttStatus || 'connecting');
  const targetEnergy = 100;

  // Audio synth — single soft bell on completion. Built lazily on user
  // gesture so the AudioContext can resume.
  const audioRef = React.useRef(null);
  const playBell = React.useCallback(() => {
    try {
      if (!audioRef.current) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioRef.current = new AC();
      }
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.value = vol * 0.6;
      master.connect(ctx.destination);
      // Two-partial bell: fundamental + slight inharmonic
      [528, 792].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(i ? 0.18 : 0.34, now + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
        o.connect(g); g.connect(master);
        o.start(now); o.stop(now + 2.5);
      });
    } catch (e) {}
  }, [vol]);

  const pushEnergyGraphPoint = React.useCallback((data) => {
    const value = detectionAccelEuclidean(data);
    if (!Number.isFinite(value)) return;
    const next = [
      ...energyGraphRef.current,
      { t: performance.now(), value },
    ].slice(-72);
    energyGraphRef.current = next;

    const now = performance.now();
    if (now - lastEnergyGraphCommitRef.current < 48) return;
    lastEnergyGraphCommitRef.current = now;
    setEnergyGraph(next);
  }, []);

  // Init the Three.js scene
  React.useEffect(() => {
    if (!mountRef.current) return;
    const api = initShakeScene(mountRef.current, {
      temple: state.temple, box: state.box, detail,
      onBoxClick: () => onShakeRef.current && onShakeRef.current(),
    });
    sceneApiRef.current = api;
    return () => api.dispose();
  }, [state.temple, state.box, detail]);

  const onShake = React.useCallback(() => {
    const api = sceneApiRef.current;
    if (!api) return;
    api.shake();
  }, [playBell]);
  onShakeRef.current = onShake;

  const finishShakeSession = React.useCallback(() => {
    const recorder = shakeRecorderRef.current;
    if (recorder.complete) return state.shakeSession || null;
    recorder.complete = true;
    const samples = recorder.samples || [];
    const durationMs = samples.length ? samples[samples.length - 1].t_ms : 0;
    const valid = samples.length >= 8 && durationMs >= 300;
    const completedAt = new Date().toISOString();
    const siamseeStick = randomSiamseeStick();
    const luckyNumber = randomLuckyNumberForStick(siamseeStick?.stick_number, state.luckyNumber || state.shakeSession?.luckyNumber);
    setRevealedStickNumber(siamseeStick?.stick_number || null);
    const shakeSession = {
      status: 'complete',
      startedAt: recorder.startedAt || completedAt,
      completedAt,
      sampleCount: samples.length,
      durationMs,
      csvText: valid ? shakeSamplesToCsv(samples) : '',
      stickNumber: siamseeStick?.stick_number || null,
      luckyNumber,
    };
    const nextState = { ...state, shakeSession, siamseeStick, luckyNumber };
    setState?.((current) => ({ ...current, shakeSession, siamseeStick, luckyNumber }));
    startSiamseePrefetch(nextState, shakeSession);
    return shakeSession;
  }, [setState, state]);

  React.useEffect(() => {
    const handleShake = () => {
      if (!sceneApiRef.current) return;
      onShakeRef.current?.();
    };
    const handleDetection = (event) => {
      const energy = sceneApiRef.current?.applyDetection?.(event.detail);
      if (!energy?.isShaking || phase === 'revealed') return;
      pushEnergyGraphPoint(event.detail);
      const delta = Math.min(4.2, energy.energyDelta ?? energy.kineticEnergy * 0.18);
      if (delta <= 0.02) return;
      const d = event.detail || {};
      const sourceTime = finiteNumber(d.t_ms ?? d.timestamp_ms, performance.now());
      const recorder = shakeRecorderRef.current;
      if (recorder.startedAtMs == null) {
        recorder.startedAtMs = sourceTime;
        recorder.startedAt = new Date().toISOString();
        recorder.samples = [];
        recorder.complete = false;
      }
      const sample = shakeSampleFromDetection(d, recorder.startedAtMs);
      if (sample && !recorder.complete) recorder.samples.push(sample);
      lastEnergyAtRef.current = performance.now();
      setIntentEnergy((current) => {
        if (current >= targetEnergy) return current;
        const nextEnergy = Math.min(targetEnergy, current + delta);
        setPhase('shaking');
        if (nextEnergy >= targetEnergy) {
          finishShakeSession();
          sceneApiRef.current?.revealStick?.();
          playBell();
          setTimeout(() => setPhase('revealed'), SHAKE_REVEAL_POPUP_DELAY_MS);
        }
        return nextEnergy;
      });
    };
    const handleStatus = (event) => setMqttStatus(event.detail);
    window.addEventListener(MQTT_SHAKE_EVENT, handleShake);
    window.addEventListener(MQTT_DETECTION_EVENT, handleDetection);
    window.addEventListener(MQTT_STATUS_EVENT, handleStatus);
    return () => {
      window.removeEventListener(MQTT_SHAKE_EVENT, handleShake);
      window.removeEventListener(MQTT_DETECTION_EVENT, handleDetection);
      window.removeEventListener(MQTT_STATUS_EVENT, handleStatus);
    };
  }, [finishShakeSession, phase, playBell, pushEnergyGraphPoint]);

  React.useEffect(() => {
    if (phase === 'revealed') return;
    const id = window.setInterval(() => {
      const idleMs = performance.now() - lastEnergyAtRef.current;
      if (idleMs < 350) return;
      setIntentEnergy((current) => {
        if (current <= 0) return 0;
        const decay = idleMs > 1600 ? 1.6 : 0.8;
        const nextEnergy = Math.max(0, current - decay);
        if (nextEnergy <= 0.01) setPhase('ready');
        return nextEnergy;
      });
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  // Auto-advance to the result screen after the auspicious number popup.
  React.useEffect(() => {
    if (phase !== 'revealed') return;
    const id = setTimeout(() => { onContinue && onContinue(); }, SHAKE_RESULT_AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [phase, onContinue]);

  const pct = Math.min(1, intentEnergy / targetEnergy);
  const t = TEMPLES.find(x => x.id === state.temple);
  const displayStickNumber = revealedStickNumber || state.siamseeStick?.stick_number || state.shakeSession?.stickNumber || '—';

  return (
    <AppShell step={2}>
      <div style={{ position: 'absolute', inset: 0, paddingTop: 0 }}>

        {/* Three.js canvas — fullbleed */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at center top, ${t.swatch[1]}, ${t.swatch[0]} 60%, ${t.accent}99 100%)`,
          overflow: 'hidden',
        }}>
          <EnergyGraphBackground samples={energyGraph} active={phase === 'shaking' || phase === 'revealed'} color={t.accent}/>
          <div ref={mountRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }}/>
        </div>

        {phase === 'revealed' && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 5,
              display: 'grid',
              placeItems: 'center',
              padding: 24,
              pointerEvents: 'none',
            }}>
            <div className="glass" style={{
              position: 'relative',
              width: 'min(440px, calc(100vw - 48px))',
              padding: '28px 30px 30px',
              borderRadius: 28,
              textAlign: 'center',
              background: 'rgba(255,255,255,.84)',
              border: '1px solid rgba(255,255,255,.78)',
              boxShadow: '0 26px 70px rgba(61,46,42,.24), inset 0 1px 0 rgba(255,255,255,.8)',
              overflow: 'hidden',
              animation: 'float-up .42s cubic-bezier(.3,.7,.4,1.2) both',
            }}>
              <Sparkles count={10} color="var(--c-gold)" style={{ inset: -18 }}/>
              <div className="eyebrow" style={{ marginBottom: 10, color: 'var(--c-coral)' }}>หมายเลขที่ได้</div>
              <div style={{
                position: 'relative',
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(76px, 16vw, 126px)',
                lineHeight: 0.95,
                fontWeight: 800,
                color: 'var(--text-main)',
                fontVariantNumeric: 'tabular-nums',
                textShadow: '0 10px 32px rgba(242,169,0,.22)',
              }}>
                {displayStickNumber}
              </div>
              <div style={{
                position: 'relative',
                marginTop: 14,
                fontSize: 15,
                color: 'var(--text-muted)',
                fontWeight: 500,
              }}>
                กำลังพาไปหน้าผลคำทำนาย...
              </div>
            </div>
          </div>
        )}

        {/* Overlay UI — left copy panel */}
        <div style={{
          position: 'absolute', top: 116, left: 48, maxWidth: 360, zIndex: 4,
        }}>
          <div className="glass" style={{ padding: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>ขั้นตอนที่ ๓ · พิธีเขย่า</div>
            <h2 style={{ fontSize: 28, lineHeight: 1.2, marginBottom: 10 }}>
              {phase === 'revealed' ? 'ไม้เซียมซีออกมาแล้ว' : 'คลิกเพื่อเขย่าเซียมซี'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.55 }}>
              {phase === 'revealed'
                ? 'หยิบไม้ที่ออกมาเพื่อดูคำทำนายของคุณ'
                : 'ตั้งจิตให้นิ่ง แล้วค่อย ๆ เขย่าไปทีละครั้ง รับรู้ทุกการเคลื่อนไหว'}
            </p>
          </div>
        </div>

        {/* Overlay UI — right detail panel */}
        <div style={{
          position: 'absolute', top: 116, right: 48, width: 280, zIndex: 4,
        }}>
          <div className="glass" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span className="eyebrow">ฉาก</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</span>
            </div>
            <div style={{ height: 1, background: 'var(--border-soft)', margin: '0 -22px 14px' }}/>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span className="eyebrow">เพลง</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Waveform2 active={phase !== 'revealed'}/>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{MUSIC.find(m => m.id === state.music)?.name}</span>
              </div>
            </div>
            <div style={{ height: 1, background: 'var(--border-soft)', margin: '0 -22px 14px' }}/>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="eyebrow">หมวด</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{CATEGORIES.find(c => c.id === state.category)?.name}</span>
            </div>
            <div style={{ height: 1, background: 'var(--border-soft)', margin: '14px -22px' }}/>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span className="eyebrow">MQTT</span>
              <span title={`${REALTIME_URL} · ${MQTT_SHAKE_TOPIC} · ${MQTT_DETECTION_TOPIC}`} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minWidth: 0,
                fontSize: 12,
                color: mqttStatus === 'connected' ? 'var(--c-mint-deep)' : 'var(--text-muted)',
              }}>
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: mqttStatus === 'connected' ? 'var(--c-mint-deep)' : 'var(--c-coral)',
                  flexShrink: 0,
                }}/>
                {mqttStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Center HUD — shake meter */}
        <div style={{
          position: 'absolute', bottom: 44, left: '50%', transform: 'translateX(-50%)',
          zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
        }}>
          {/* meter */}
          <div className="glass" style={{
            padding: '18px 28px',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            background: 'rgba(255,255,255,.86)',
            border: '1px solid rgba(61,46,42,.18)',
            boxShadow: '0 14px 42px rgba(61,46,42,.22)',
          }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>พลังแห่งเจตนา</span>
            <div style={{
              width: 420,
              height: 18,
              borderRadius: 999,
              background: 'rgba(61,46,42,.26)',
              overflow: 'hidden',
              boxShadow: 'inset 0 1px 3px rgba(61,46,42,.32), 0 0 0 1px rgba(61,46,42,.18)',
            }}>
              <div style={{
                width: `${pct * 100}%`, height: '100%',
                background: pct >= 1
                  ? 'linear-gradient(90deg, #F2A900, #D94F2B)'
                  : 'linear-gradient(90deg, #D94F2B, #7A3FE0)',
                transition: 'width .3s cubic-bezier(.3,.7,.4,1.4)',
                boxShadow: '0 0 14px rgba(217,79,43,.45)',
              }}/>
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', minWidth: 48 }}>
              {Math.round(pct * 100)}%
            </span>
          </div>

          <button className="btn btn-tertiary" onClick={onBack} style={{ padding: '6px 14px' }}>
            <Icon.arrowL size={14}/> กลับไปเตรียมใจ
          </button>
        </div>

        {/* tiny cue on first click */}
        {intentEnergy === 0 && (
          <div style={{
            position: 'absolute', bottom: 220, left: '50%', transform: 'translateX(-50%)',
            zIndex: 4, fontSize: 13, color: 'rgba(61,46,42,.5)',
            animation: 'float-y 2s ease-in-out infinite',
          }}>
            เขย่าจากการเคลื่อนไหวของอุปกรณ์
          </div>
        )}
      </div>
    </AppShell>
  );
}
window.ShakeScreen = ShakeScreen;

// small waveform variant
function Waveform2({ active }) {
  const heights = [4, 8, 12, 6, 14, 5, 10];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 14 }}>
      {heights.map((h, i) => (
        <span key={i} style={{
          width: 2, height: h, borderRadius: 1,
          background: 'var(--text-main)',
          opacity: active ? 0.85 : 0.3,
          animation: active ? `float-y ${1 + (i % 3) * 0.3}s ease-in-out ${i * 0.1}s infinite` : 'none',
        }}/>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// initShakeScene — vanilla Three.js
// ─────────────────────────────────────────────
function initShakeScene(container, opts) {
  const THREE = window.THREE;
  if (!THREE) {
    container.innerHTML = '<div style="padding:40px;color:#888">Three.js failed to load</div>';
    return { dispose: () => {}, shake: () => {}, revealStick: () => {} };
  }

  const temple = TEMPLES.find(t => t.id === opts.temple) || TEMPLES[0];
  const box = BOXES.find(b => b.id === opts.box) || BOXES[0];

  const w = container.clientWidth, h = container.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(w, h);
  renderer.shadowMap.enabled = opts.detail !== 'low';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.inset = '0';
  renderer.domElement.style.zIndex = '1';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // colored fog tint
  scene.fog = new THREE.Fog(new THREE.Color(temple.swatch[0]), 14, 26);

  const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
  camera.position.set(0, 4.2, 7.5);
  camera.lookAt(0, 0.4, 0);

  // ── Lights ─────────────────────────────────
  const hemi = new THREE.HemisphereLight(0xfff0e0, new THREE.Color(temple.swatch[2]), 0.7);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff0e0, 1.4);
  key.position.set(4, 8, 5);
  key.castShadow = opts.detail !== 'low';
  if (key.castShadow) {
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 22;
    key.shadow.camera.top = 6;  key.shadow.camera.bottom = -6;
    key.shadow.camera.left = -6; key.shadow.camera.right = 6;
    key.shadow.bias = -0.0005;
  }
  scene.add(key);

  const fill = new THREE.PointLight(new THREE.Color(temple.accent), 0.8, 12);
  fill.position.set(-3, 2, 3);
  scene.add(fill);

  const rim = new THREE.PointLight(0xffe4c4, 0.5, 10);
  rim.position.set(0, 3, -3);
  scene.add(rim);

  // ── Fortune box ────────────────────────────
  const boxGroup = new THREE.Group();
  scene.add(boxGroup);

  const woodCol = new THREE.Color(box.wood);
  const trimCol = new THREE.Color(box.trim);
  const darkWoodCol = woodCol.clone().lerp(new THREE.Color('#1F1714'), 0.48);
  const shadeCol = woodCol.clone().lerp(new THREE.Color('#1F1714'), 0.34);
  const grainCol = trimCol.clone().lerp(woodCol, 0.45);
  const bambooMat = new THREE.MeshStandardMaterial({
    color: woodCol,
    roughness: 0.85, metalness: 0,
  });
  const bambooNodeMat = new THREE.MeshStandardMaterial({
    color: trimCol,
    roughness: 0.78, metalness: 0.05,
  });
  // Inner cavity (visible from above) is darker to read as hollow bamboo
  const bambooInner = new THREE.MeshStandardMaterial({
    color: darkWoodCol,
    roughness: 0.95, side: THREE.DoubleSide,
  });
  // Keep trimMat for the existing stick tip code
  const trimMat = new THREE.MeshStandardMaterial({
    color: trimCol, roughness: 0.5, metalness: 0.2,
    emissive: trimCol.clone().multiplyScalar(0.15), emissiveIntensity: 0.5,
  });

  // Main bamboo body — smooth tall cylinder, more radial segments for roundness
  const bodyShape = new THREE.CylinderGeometry(0.66, 0.66, 1.42, 36, 1, true);
  const body = new THREE.Mesh(bodyShape, bambooMat);
  body.position.y = 0.71;
  body.castShadow = true; body.receiveShadow = true;
  boxGroup.add(body);

  // Inner hollow wall (so the rim shows depth)
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.64, 0.64, 1.42, 36, 1, true),
    bambooInner,
  );
  inner.position.y = 0.71;
  inner.material.side = THREE.BackSide;
  boxGroup.add(inner);

  // Solid bamboo base so the cup does not read as transparent when tilted.
  const bottom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.64, 0.64, 0.08, 36, 1, false),
    bambooNodeMat,
  );
  bottom.position.y = 0.04;
  bottom.castShadow = true;
  bottom.receiveShadow = true;
  boxGroup.add(bottom);

  const innerBottom = new THREE.Mesh(
    new THREE.CircleGeometry(0.58, 36),
    bambooInner,
  );
  innerBottom.rotation.x = -Math.PI / 2;
  innerBottom.position.y = 0.11;
  innerBottom.receiveShadow = true;
  boxGroup.add(innerBottom);

  // Bamboo node rings (joints) — slight bulges around the body at intervals.
  // Use Lathe sweeps via TorusGeometry for the bead profile.
  const NODE_HEIGHTS = [0.06, 0.46, 0.92, 1.36];
  NODE_HEIGHTS.forEach((y) => {
    const node = new THREE.Mesh(
      new THREE.TorusGeometry(0.685, 0.055, 14, 40),
      bambooNodeMat,
    );
    node.position.y = y;
    node.rotation.x = Math.PI / 2;
    node.castShadow = true;
    boxGroup.add(node);
    // a softer darker line right under each node ring for shading
    const shade = new THREE.Mesh(
      new THREE.TorusGeometry(0.682, 0.018, 8, 40),
      bambooNodeMat,
    );
    shade.position.y = y - 0.06; shade.rotation.x = Math.PI / 2;
    shade.material = shade.material.clone();
    shade.material.color = shadeCol;
    boxGroup.add(shade);
  });

  // Subtle vertical grain lines for bamboo texture
  const grainMat = new THREE.MeshBasicMaterial({
    color: grainCol, transparent: true, opacity: 0.45,
  });
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const line = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0035, 0.0035, 1.36, 3),
      grainMat,
    );
    line.position.set(Math.cos(angle) * 0.662, 0.71, Math.sin(angle) * 0.662);
    boxGroup.add(line);
  }

  // ── Hands holding the box (first-person perspective, with elbows) ──
  // Anatomical arms: shoulder → upper arm → elbow joint → forearm → wrist → hand.
  // Pale/white skin tone. Hands grip the box tightly.
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xF6E4D2, roughness: 0.62, metalness: 0.02,
  });
  const skinShadow = new THREE.MeshStandardMaterial({
    color: 0xE5CCB5, roughness: 0.68, metalness: 0.02,
  });
  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x3D2E2A, roughness: 0.85,
  });

  const armModelLoader = new GLTFLoader();
  const importedArmRig = {
    loading: false,
    loaded: false,
    scene: null,
    instance: null,
    targets: null,
    waiting: [],
  };
  const ENABLE_IMPORTED_ARM_RIG = false;

  // Helper: build a tapered cylinder segment between two world points
  function buildLimb(from, to, rTop, rBot, mat) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBot, 1, 18),
      mat,
    );
    m.castShadow = true;
    updateLimb(m, from, to);
    return m;
  }

  function updateLimb(mesh, from, to) {
    const len = Math.max(0.001, from.distanceTo(to));
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(to, from).normalize();
    mesh.scale.y = len;
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    mesh.position.copy(mid);
  }

  function solveTwoBoneIK(shoulder, target, side, previousElbow) {
    const upperLen = 2.05;
    const lowerLen = 1.78;
    const minFlex = 0.22;
    const maxFlex = 2.28;
    const toTarget = new THREE.Vector3().subVectors(target, shoulder);
    const minDistance = Math.sqrt(upperLen * upperLen + lowerLen * lowerLen - 2 * upperLen * lowerLen * Math.cos(maxFlex));
    const maxDistance = Math.sqrt(upperLen * upperLen + lowerLen * lowerLen - 2 * upperLen * lowerLen * Math.cos(minFlex));
    const distance = Math.min(Math.max(toTarget.length(), minDistance), maxDistance);
    const dir = toTarget.clone().normalize();
    const bendHint = new THREE.Vector3(side * 0.4, -0.92, 0.38).normalize();
    const planeNormal = new THREE.Vector3().crossVectors(dir, bendHint).normalize();
    const bendDir = new THREE.Vector3().crossVectors(planeNormal, dir).normalize();
    const along = (upperLen * upperLen - lowerLen * lowerLen + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(0, upperLen * upperLen - along * along));
    const solved = new THREE.Vector3()
      .copy(shoulder)
      .add(dir.multiplyScalar(along))
      .add(bendDir.multiplyScalar(height));
    if (!previousElbow) return solved;
    const minX = side > 0 ? 0.42 : -1.95;
    const maxX = side > 0 ? 1.95 : -0.42;
    solved.x = clampValue(solved.x, minX, maxX);
    solved.y = clampValue(solved.y, 0.34, 2.1);
    solved.z = clampValue(solved.z, 0.75, 3.5);
    return solved;
  }

  function aimBoneLikeObject(object, from, to) {
    const dir = new THREE.Vector3().subVectors(to, from).normalize();
    object.position.copy(from);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }

  function normalizeArmModel(model, side) {
    const wrapper = new THREE.Group();
    wrapper.name = side < 0 ? 'imported-static-arm-left' : 'imported-static-arm-right';
    wrapper.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const longest = Math.max(size.x, size.y, size.z) || 1;
    model.scale.setScalar(2.95 / longest);
    model.position.sub(center.multiplyScalar(model.scale.x));
    model.rotation.y = side < 0 ? Math.PI : 0;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m) => { m.transparent = false; m.opacity = 1; });
          else { child.material.transparent = false; child.material.opacity = 1; }
        }
      }
    });
    return wrapper;
  }

  function fitCombinedArmRig(model) {
    const wrapper = new THREE.Group();
    wrapper.name = 'imported-combined-human-arms';
    wrapper.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const longest = Math.max(size.x, size.y, size.z) || 1;
    model.scale.setScalar(3.85 / longest);
    model.position.sub(center.multiplyScalar(model.scale.x));
    model.position.y += 0.18;
    model.position.z += 0.08;
    wrapper.rotation.x = Math.PI;
    wrapper.position.y = 0.48;
    wrapper.position.z = 0.1;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m) => { m.transparent = false; m.opacity = 1; });
          else { child.material.transparent = false; child.material.opacity = 1; }
        }
      }
    });
    return wrapper;
  }

  function findRigTargets(root) {
    const targets = {};
    root.traverse((child) => {
      if (!child.name) return;
      targets[child.name] = child;
    });
    return {
      leftWristIk: targets['wrist_ik.l'] || null,
      rightWristIk: targets['wrist_ik.r'] || null,
      leftArmTarget: targets['arm_target.l'] || null,
      rightArmTarget: targets['arm_target.r'] || null,
      leftShoulder: targets['shoulder.l'] || null,
      rightShoulder: targets['shoulder.r'] || null,
      leftBicep: targets['bicep.l'] || null,
      rightBicep: targets['bicep.r'] || null,
      leftWrist: targets['wrist.l'] || null,
      rightWrist: targets['wrist.r'] || null,
      leftForearm: targets['forearm.l'] || null,
      rightForearm: targets['forearm.r'] || null,
    };
  }

  function setObjectWorldPosition(object, position) {
    if (!object || !object.parent) return;
    object.parent.updateMatrixWorld(true);
    object.position.copy(object.parent.worldToLocal(position.clone()));
  }

  function setBoneWorldAim(bone, from, to, roll = 0) {
    if (!bone || !bone.parent) return;
    const dir = new THREE.Vector3().subVectors(to, from);
    if (dir.lengthSq() < 0.000001) return;
    dir.normalize();
    bone.parent.updateMatrixWorld(true);
    const desiredWorldQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    if (roll) desiredWorldQuat.multiply(new THREE.Quaternion().setFromAxisAngle(dir, roll));
    const parentWorldQuat = new THREE.Quaternion();
    bone.parent.getWorldQuaternion(parentWorldQuat);
    bone.quaternion.copy(parentWorldQuat.invert().multiply(desiredWorldQuat));
    bone.updateMatrixWorld(true);
  }

  function setBoneWorldPosition(bone, position) {
    if (!bone || !bone.parent) return;
    bone.parent.updateMatrixWorld(true);
    bone.position.copy(bone.parent.worldToLocal(position.clone()));
    bone.updateMatrixWorld(true);
  }

  function attachCombinedArmRig(ik) {
    if (!importedArmRig.scene) return false;
    if (!importedArmRig.instance) {
      importedArmRig.instance = fitCombinedArmRig(importedArmRig.scene);
      importedArmRig.targets = findRigTargets(importedArmRig.instance);
      scene.add(importedArmRig.instance);
    }
    ik.importedModel = importedArmRig.instance;
    ik.fallbackRoot.visible = false;
    return true;
  }

  function loadCombinedArmRig(ik) {
    if (!ENABLE_IMPORTED_ARM_RIG) {
      ik.fallbackRoot.visible = true;
      return false;
    }
    if (importedArmRig.loaded) return attachCombinedArmRig(ik);
    importedArmRig.waiting.push(ik);
    if (importedArmRig.loading) return true;
    importedArmRig.loading = true;
    const tryPaths = ['/models/arms.glb', '/models/human-arms.glb'];
    const tryNext = (index) => {
      if (index >= tryPaths.length) {
        importedArmRig.waiting.splice(0).forEach((waitingIk) => {
          loadStaticArmModel(waitingIk.side, waitingIk, waitingIk.fallbackRoot);
        });
        return;
      }
      armModelLoader.load(
        tryPaths[index],
        (gltf) => {
          importedArmRig.loaded = true;
          importedArmRig.scene = gltf.scene;
          importedArmRig.waiting.splice(0).forEach((waitingIk) => {
            attachCombinedArmRig(waitingIk);
          });
        },
        undefined,
        () => tryNext(index + 1),
      );
    };
    tryNext(0);
    return true;
  }

  function loadStaticArmModel(side, ik, fallbackRoot) {
    const sideName = side < 0 ? 'left' : 'right';
    armModelLoader.load(
      `/models/human-arm-${sideName}.glb`,
      (gltf) => {
        const imported = normalizeArmModel(gltf.scene, side);
        imported.visible = true;
        ik.modelRoot.add(imported);
        ik.importedModel = imported;
        fallbackRoot.visible = false;
      },
      undefined,
      () => {
        fallbackRoot.visible = true;
      },
    );
  }

  function buildHand(side) {
    const g = new THREE.Group();
    const fallbackRoot = new THREE.Group();
    g.add(fallbackRoot);

    // Joint positions in boxGroup-local coords. Hand position is at the
    // palm; fingertips land ON the cylinder's front surface so the camera
    // sees them gripping the visible side of the box.
    const shoulderAt = new THREE.Vector3(side * 1.55, 2.25, 4.35);
    const elbowAt    = new THREE.Vector3(side * 1.20, 1.05, 2.10);
    const wristAt    = new THREE.Vector3(side * 0.95, 0.78, 0.30);
    const palmAt     = new THREE.Vector3(side * 0.76, 0.78, 0.22);
    const modelRoot = new THREE.Group();
    modelRoot.position.copy(wristAt);
    g.add(modelRoot);

    const shoulderBone = new THREE.Bone();
    shoulderBone.name = side < 0 ? 'left_shoulder_ik' : 'right_shoulder_ik';
    const elbowBone = new THREE.Bone();
    elbowBone.name = side < 0 ? 'left_elbow_hinge_ik' : 'right_elbow_hinge_ik';
    const wristBone = new THREE.Bone();
    wristBone.name = side < 0 ? 'left_wrist_target_ik' : 'right_wrist_target_ik';
    shoulderBone.add(elbowBone);
    elbowBone.add(wristBone);
    g.add(shoulderBone);

    // ── Upper arm ───────────────────────────
    const upperArm = buildLimb(shoulderAt, elbowAt, 0.21, 0.17, skinShadow);
    fallbackRoot.add(upperArm);
    const shoulder = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 14, 12), skinShadow,
    );
    shoulder.position.copy(shoulderAt);
    fallbackRoot.add(shoulder);

    // ── Elbow joint ─────────────────────────
    const elbow = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 14, 12), skinShadow,
    );
    elbow.position.copy(elbowAt);
    elbow.castShadow = true;
    fallbackRoot.add(elbow);

    // ── Forearm ─────────────────────────────
    const forearm = buildLimb(elbowAt, wristAt, 0.16, 0.13, skinMat);
    fallbackRoot.add(forearm);

    // ── Sleeve cuff (dark band where shirt ends at wrist) ──
    const cuffDir = new THREE.Vector3().subVectors(wristAt, elbowAt).normalize();
    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.16, 0.14, 18), sleeveMat,
    );
    cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), cuffDir);
    cuff.position.copy(wristAt).add(cuffDir.clone().multiplyScalar(-0.10));
    fallbackRoot.add(cuff);

    const handMesh = new THREE.Group();
    handMesh.position.copy(wristAt);
    fallbackRoot.add(handMesh);

    // ── Palm — block, oriented so its thin axis lies along radius ──
    // Default BoxGeometry axes after rotation.y = ±π/2: width(X) becomes depth(Z).
    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.34, 0.20), skinMat,
    );
    palm.position.set(0, 0, 0);
    palm.rotation.y = side * Math.PI * 0.5; // thin face toward box (radial)
    palm.castShadow = true;
    palm.receiveShadow = true;
    handMesh.add(palm);

    // Knuckle bumps on the back-of-hand (camera-facing side, +Z direction)
    for (let i = 0; i < 4; i++) {
      const k = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 10, 8), skinShadow,
      );
      k.position.set(
        side * -0.02, // slightly inboard so they read on back
        0.13 - i * 0.07,
        0.14,
      );
      handMesh.add(k);
    }

    // ── Thumb — base on top-inner of palm, wraps over the top edge of the
    // box and reaches forward. Two segments + tip sphere.
    const thumbBase = new THREE.Vector3(side * 0.62 - palmAt.x, 0.18, 0.02);
    const thumbMid  = new THREE.Vector3(side * 0.40 - palmAt.x, 0.32, 0.20);
    const thumbTipP = new THREE.Vector3(side * 0.16 - palmAt.x, 0.30, 0.42);
    handMesh.add(buildLimb(thumbBase, thumbMid, 0.070, 0.062, skinMat));
    handMesh.add(buildLimb(thumbMid,  thumbTipP, 0.062, 0.055, skinMat));
    const thumbJ = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), skinMat);
    thumbJ.position.copy(thumbMid); handMesh.add(thumbJ);
    const thumbTipS = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skinMat);
    thumbTipS.position.copy(thumbTipP); handMesh.add(thumbTipS);

    // ── 4 fingers — curled around the side of the bamboo without entering
    // the cup wall. Keep every point outside radius 0.66 to avoid clipping
    // through the bamboo rings when the cup tilts.
    const Y_OFFS   = [0.10, 0.03, -0.05, -0.14];
    Y_OFFS.forEach((yOff, i) => {
      const spread = (i - 1.5) * 0.035;
      const knuckPos = new THREE.Vector3(
        side * (0.83 + Math.abs(spread) * 0.25) - palmAt.x,
        yOff,
        0.18 + spread - palmAt.z,
      );
      const midPos = new THREE.Vector3(
        side * 0.78 - palmAt.x,
        yOff - 0.015,
        -0.06 + spread - palmAt.z,
      );
      const fingerEndPos = new THREE.Vector3(
        side * 0.72 - palmAt.x,
        yOff - 0.025,
        -0.22 + spread * 0.7 - palmAt.z,
      );
      handMesh.add(buildLimb(knuckPos, midPos, 0.055, 0.05, skinMat));
      handMesh.add(buildLimb(midPos, fingerEndPos, 0.05, 0.043, skinMat));
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.060, 10, 8), skinMat);
      k.position.copy(knuckPos); handMesh.add(k);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skinMat);
      tip.position.copy(fingerEndPos); handMesh.add(tip);
    });

    g.userData.ik = {
      side,
      shoulderAt,
      shoulder,
      elbow,
      upperArm,
      forearm,
      cuff,
      cuffDir,
      palm,
      handMesh,
      palmLocal: palmAt.clone(),
      gripLocal: new THREE.Vector3(side * 0.76, 0.78, 0.22),
      modelRoot,
      fallbackRoot,
      shoulderBone,
      elbowBone,
      wristBone,
      smoothWrist: wristAt.clone(),
      smoothElbow: elbowAt.clone(),
      smoothQuat: new THREE.Quaternion(),
      hingeLimits: { minFlex: 0.22, maxFlex: 2.28 },
    };
    loadCombinedArmRig(g.userData.ik);
    return g;
  }

  const handL = buildHand(-1);
  const handR = buildHand(+1);
  scene.add(handL);
  scene.add(handR);
  // ── Fortune scrolls (ม้วนคำทำนาย) inside the bamboo ───────────
  // Each scroll = cream paper cylinder with a colored ribbon top.
  const stickMat = new THREE.MeshStandardMaterial({
    color: 0xf3e5c4, roughness: 0.9, metalness: 0,
  });
  const stickTipMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(temple.accent), roughness: 0.5,
    emissive: new THREE.Color(temple.accent), emissiveIntensity: 0.2,
  });
  const stickFootMat = new THREE.MeshStandardMaterial({
    color: 0xd9c3a0, roughness: 0.85,
  });
  const sticks = [];
  const STICK_COUNT = opts.detail === 'high' ? 22 : opts.detail === 'low' ? 8 : 14;

  // Scroll dimensions — rolled paper cylinder. The cup interior runs from
  // roughly y=0.1 to y=1.42, so start the rolls near the base and let them
  // protrude above the rim instead of floating in the top half.
  const STICK_BASE_Y = 0.16;
  const STICK_LEN = 1.86;
  const SCROLL_R  = 0.052;

  for (let i = 0; i < STICK_COUNT; i++) {
    const s = new THREE.Group();
    const len = STICK_LEN + (Math.random() - 0.5) * 0.08;

    // Paper body — cylinder
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(SCROLL_R, SCROLL_R, len, 14),
      stickMat,
    );
    body.position.y = len / 2;
    body.castShadow = true;

    // Bottom end cap (slightly wider, paper edge)
    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(SCROLL_R * 1.12, SCROLL_R * 1.12, 0.04, 14),
      stickFootMat,
    );
    foot.position.y = 0.02;

    // Top end cap — colored ribbon end (this is the "tip" that glows on reveal)
    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(SCROLL_R * 1.18, SCROLL_R * 1.18, 0.07, 14),
      stickTipMat,
    );
    tip.position.y = len - 0.035;

    // Small dot on the very top (paper, like a sealed scroll end)
    const seal = new THREE.Mesh(
      new THREE.CylinderGeometry(SCROLL_R * 0.78, SCROLL_R * 0.78, 0.01, 14),
      stickMat,
    );
    seal.position.y = len + 0.005;

    s.add(body, foot, tip, seal);

    // random offset within the cup, fanned at random Y rotations. Keep the
    // radius and tilt conservative because the longer rolls reach the bottom.
    const r = Math.random() * 0.32;
    const a = Math.random() * Math.PI * 2;
    s.position.set(Math.cos(a) * r, STICK_BASE_Y, Math.sin(a) * r);
    s.rotation.set(
      (Math.random() - 0.5) * 0.22,
      Math.random() * Math.PI,
      (Math.random() - 0.5) * 0.22,
    );
    s.userData = {
      home: s.position.clone(),
      homeRot: s.rotation.clone(),
      vel: new THREE.Vector3(),
      angularVel: new THREE.Vector3(),
      wiggle: 0,
      special: false,
    };
    boxGroup.add(s);
    sticks.push(s);
  }
  // Pick the "special" stick that will pop out
  const special = sticks[Math.floor(Math.random() * sticks.length)];
  special.userData.special = true;

  // ── Floating particles (sparkles) ──────────
  const partGeo = new THREE.BufferGeometry();
  const PCOUNT = opts.detail === 'low' ? 60 : opts.detail === 'high' ? 220 : 140;
  const pos = new Float32Array(PCOUNT * 3);
  const partData = [];
  for (let i = 0; i < PCOUNT; i++) {
    const x = (Math.random() - 0.5) * 12;
    const y = Math.random() * 5;
    const z = (Math.random() - 0.5) * 8;
    pos[i*3] = x; pos[i*3+1] = y; pos[i*3+2] = z;
    partData.push({ vy: 0.003 + Math.random() * 0.005, phase: Math.random() * Math.PI * 2 });
  }
  partGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const partMat = new THREE.PointsMaterial({
    color: new THREE.Color(temple.accent),
    size: 0.05, transparent: true, opacity: 0.65,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const particles = new THREE.Points(partGeo, partMat);
  scene.add(particles);

  // Click-on-box hit area: invisible larger box for easier targeting
  const hitArea = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 3, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitArea.position.y = 1.2;
  hitArea.userData.isBoxHit = true;
  boxGroup.add(hitArea);

  const clampValue = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));
  const identityQuat = new THREE.Quaternion();
  const MAX_CUP_TILT_RAD = Math.PI / 4;

  function limitCupTilt(quat) {
    const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
    const tilt = Math.hypot(euler.x, euler.z);
    if (tilt <= MAX_CUP_TILT_RAD) return quat;
    const scale = MAX_CUP_TILT_RAD / tilt;
    euler.x *= scale;
    euler.z *= scale;
    quat.setFromEuler(euler);
    return quat;
  }

  // Shake state
  const state = {
    shakeTime: 0,
    shakeIntensity: 0,
    motionForce: 0,
    accelBaseline: null,
    sensorVelocity: { x: 0, y: 0, z: 0 },
    lastDetectionMs: null,
    orientationSamples: [],
    gyroRot: { x: 0, y: 0, z: 0 },
    targetQuat: new THREE.Quaternion(),
    currentQuat: new THREE.Quaternion(),
    impulseQuat: new THREE.Quaternion(),
    vel: { x: 0, y: 0, z: 0 },
    angularVel: { x: 0, y: 0, z: 0 },
    revealing: false,
    revealTime: 0,
    glowStrength: 0,
  };

  // Click handler — raycast against the box
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const onMouse = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([hitArea]);
    if (hits.length && typeof opts.onBoxClick === 'function') opts.onBoxClick();
  };
  renderer.domElement.addEventListener('click', onMouse);
  renderer.domElement.style.cursor = 'pointer';

  // Resize
  const onResize = () => {
    const W = container.clientWidth, H = container.clientHeight;
    renderer.setSize(W, H);
    camera.aspect = W / H; camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);
  const ro = new ResizeObserver(onResize);
  ro.observe(container);

  // Animate
  let raf, t = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    t += 0.016;

    // gentle camera orbit
    camera.position.x = Math.sin(t * 0.15) * 0.5;
    camera.lookAt(0, 0.6, 0);

    // particles drift
    const arr = partGeo.attributes.position.array;
    for (let i = 0; i < PCOUNT; i++) {
      arr[i*3+1] += partData[i].vy;
      arr[i*3] += Math.sin(t + partData[i].phase) * 0.001;
      if (arr[i*3+1] > 5.5) arr[i*3+1] = 0;
    }
    partGeo.attributes.position.needsUpdate = true;

    // lantern float (chinese)
    scene.traverse(o => {
      if (o.userData && o.userData.float) {
        o.position.y = o.userData.float.base + Math.sin(t * 1.2 + o.userData.float.phase) * 0.06;
      }
    });

    // IMU-driven orientation. Detection samples are averaged before setting
    // targetQuat, then the cup uses slerp so orientation changes are smooth.
    state.currentQuat.slerp(state.targetQuat, 0.06);
    state.motionForce *= 0.82;
    state.vel.x = (state.vel.x - boxGroup.position.x * 0.09) * 0.82;
    state.vel.y = (state.vel.y - boxGroup.position.y * 0.08) * 0.84;
    state.vel.z = (state.vel.z - boxGroup.position.z * 0.09) * 0.82;
    boxGroup.position.x = clampValue(boxGroup.position.x + state.vel.x, -0.34, 0.34);
    boxGroup.position.y = clampValue(boxGroup.position.y + state.vel.y, -0.16, 0.22);
    boxGroup.position.z = clampValue(boxGroup.position.z + state.vel.z, -0.22, 0.22);
    state.angularVel.x *= 0.86;
    state.angularVel.y *= 0.88;
    state.angularVel.z *= 0.86;
    const angularStep = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      state.angularVel.x,
      state.angularVel.y,
      state.angularVel.z,
    ));
    state.impulseQuat.multiply(angularStep).normalize();
    state.impulseQuat.slerp(identityQuat, 0.05);

    // shake animation
    const jitter = state.shakeIntensity + state.motionForce;
    if (jitter > 0.001) {
      state.shakeIntensity *= 0.88;
    }
    sticks.forEach((s) => {
      if (s.userData.special && state.revealing) return;
      const h = s.userData.home;
      const hr = s.userData.homeRot;
      const v = s.userData.vel;
      const av = s.userData.angularVel;
      const cupImpulseX = state.vel.x * 0.35 + state.angularVel.z * 0.18;
      const cupImpulseZ = state.vel.z * 0.35 - state.angularVel.x * 0.18;

      v.x += -cupImpulseX + (Math.random() - 0.5) * jitter * 0.012;
      v.z += -cupImpulseZ + (Math.random() - 0.5) * jitter * 0.012;
      v.y += Math.abs(cupImpulseX + cupImpulseZ) * 0.012 + jitter * 0.004;
      v.x += (h.x - s.position.x) * 0.08;
      v.z += (h.z - s.position.z) * 0.08;
      v.y += (h.y - s.position.y) * 0.12;
      v.multiplyScalar(0.82);

      s.position.add(v);
      s.position.y = clampValue(s.position.y, 0.92, 1.2);
      const radius = Math.hypot(s.position.x, s.position.z);
      const maxRadius = 0.49;
      if (radius > maxRadius) {
        const scale = maxRadius / radius;
        s.position.x *= scale;
        s.position.z *= scale;
        v.x *= -0.35;
        v.z *= -0.35;
      }

      av.x += v.z * 0.18 + state.angularVel.x * 0.08;
      av.z += -v.x * 0.18 + state.angularVel.z * 0.08;
      av.y += state.angularVel.y * 0.04;
      av.multiplyScalar(0.78);

      s.rotation.x = clampValue(s.rotation.x + av.x + (hr.x - s.rotation.x) * 0.08, hr.x - 0.32, hr.x + 0.32);
      s.rotation.y = hr.y + clampValue((s.rotation.y - hr.y + av.y) * 0.9, -0.22, 0.22);
      s.rotation.z = clampValue(s.rotation.z + av.z + (hr.z - s.rotation.z) * 0.08, hr.z - 0.32, hr.z + 0.32);
    });
    boxGroup.quaternion.copy(state.currentQuat).multiply(state.impulseQuat);
    limitCupTilt(boxGroup.quaternion);
    if (jitter > 0.001) {
      const jitterQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        (Math.random() - 0.5) * jitter * 0.08,
        (Math.random() - 0.5) * jitter * 0.08,
        (Math.random() - 0.5) * jitter * 0.22,
      ));
      boxGroup.quaternion.multiply(jitterQuat);
      limitCupTilt(boxGroup.quaternion);
    }

    [handL, handR].forEach((hand) => {
      const ik = hand.userData.ik;
      const shoulder = ik.shoulderAt;
      const targetWrist = boxGroup.localToWorld(ik.gripLocal.clone());
      ik.smoothWrist.lerp(targetWrist, 0.18);
      const elbowPos = solveTwoBoneIK(shoulder, ik.smoothWrist, ik.side, ik.smoothElbow);
      ik.smoothElbow.lerp(elbowPos, 0.16);

      updateLimb(ik.upperArm, shoulder, ik.smoothElbow);
      updateLimb(ik.forearm, ik.smoothElbow, ik.smoothWrist);
      ik.shoulder.position.copy(shoulder);
      ik.elbow.position.copy(ik.smoothElbow);

      const forearmDir = new THREE.Vector3().subVectors(ik.smoothWrist, ik.smoothElbow).normalize();
      ik.cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), forearmDir);
      ik.cuff.position.copy(ik.smoothWrist).add(forearmDir.clone().multiplyScalar(-0.1));

      const upperDir = new THREE.Vector3().subVectors(ik.smoothElbow, shoulder).normalize();
      const lowerDir = new THREE.Vector3().subVectors(ik.smoothWrist, ik.smoothElbow).normalize();
      const upperQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), upperDir);
      const lowerQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), lowerDir);
      ik.shoulderBone.position.copy(shoulder);
      ik.shoulderBone.quaternion.copy(upperQuat);
      ik.elbowBone.position.set(0, shoulder.distanceTo(ik.smoothElbow), 0);
      ik.elbowBone.quaternion.copy(upperQuat.clone().invert().multiply(lowerQuat));
      ik.wristBone.position.set(0, ik.smoothElbow.distanceTo(ik.smoothWrist), 0);
      ik.wristBone.quaternion.identity();

      ik.smoothQuat.slerp(boxGroup.quaternion, 0.2);
      if (importedArmRig.instance && ik.importedModel === importedArmRig.instance) {
        const targets = importedArmRig.targets;
        const shoulderBone = ik.side < 0 ? targets?.leftShoulder : targets?.rightShoulder;
        const bicepBone = ik.side < 0 ? targets?.leftBicep : targets?.rightBicep;
        const forearmBone = ik.side < 0 ? targets?.leftForearm : targets?.rightForearm;
        const wristBone = ik.side < 0 ? targets?.leftWrist : targets?.rightWrist;
        const wristTarget = ik.side < 0 ? targets?.leftWristIk : targets?.rightWristIk;
        const armTarget = ik.side < 0 ? targets?.leftArmTarget : targets?.rightArmTarget;
        const shoulderOffset = new THREE.Vector3(ik.side * -0.24, -0.18, -0.08);
        const modelShoulder = shoulder.clone().add(shoulderOffset);
        const modelElbow = ik.smoothElbow.clone().add(new THREE.Vector3(ik.side * -0.12, -0.04, -0.02));
        const modelWrist = ik.smoothWrist.clone().add(new THREE.Vector3(ik.side * -0.04, 0.02, 0.02));
        const elbowHint = modelElbow.clone().add(new THREE.Vector3(ik.side * 0.25, -0.08, 0.15));
        importedArmRig.instance.updateMatrixWorld(true);
        setBoneWorldPosition(shoulderBone, modelShoulder);
        setBoneWorldPosition(bicepBone, modelShoulder);
        setBoneWorldPosition(forearmBone, modelElbow);
        setBoneWorldPosition(wristBone, modelWrist);
        setBoneWorldAim(bicepBone, modelShoulder, modelElbow, ik.side * 0.04);
        setBoneWorldAim(forearmBone, modelElbow, modelWrist, ik.side * -0.1);
        setBoneWorldAim(wristBone, modelWrist, modelWrist.clone().add(new THREE.Vector3(ik.side * -0.08, 0.08, -0.35)), ik.side * 0.2);
        setObjectWorldPosition(wristTarget, modelWrist);
        setObjectWorldPosition(armTarget, elbowHint);
      } else {
        ik.modelRoot.position.copy(ik.smoothWrist);
        ik.modelRoot.quaternion.copy(ik.smoothQuat);
        ik.modelRoot.rotation.y += ik.side * Math.PI * 0.5;
      }

      ik.handMesh.position.copy(ik.smoothWrist);
      ik.handMesh.quaternion.copy(ik.smoothQuat);
    });

    // reveal animation: special stick rises out, then falls to the ground
    if (state.revealing) {
      state.revealTime += 0.016;
      const RISE = 0.40;
      const FALL = 1.60;
      const t = state.revealTime;

      const home    = special.userData.revealHome || special.userData.home;
      const homeRot = special.userData.revealHomeRot || special.userData.homeRot;
      const yPeak   = 2.0;
      // Scroll lies on its side — cylinder radius 0.052 — yLand keeps the
      // scroll just above the dais (top of ground at y=0).
      const yLand   = 0.06;
      const xLand   = (Math.sign(home.x) || 1) * 0.35;
      const zLand   = 1.20;
      // Random tumble axis cached once so it stays stable across frames
      if (special.userData.tumble === undefined) {
        special.userData.tumble = (Math.random() - 0.5) * 0.6;
      }

      if (t < RISE) {
        // Rise: stick climbs above the box opening, tilting outward
        const k = t / RISE;
        const e = k * k * (3 - 2 * k);
        special.position.set(
          home.x + e * 0.10,
          home.y + e * (yPeak - home.y),
          home.z + e * 0.40,
        );
        special.rotation.x = homeRot.x + e * 0.5;
        special.rotation.z = homeRot.z + e * 0.25;
        special.rotation.y = homeRot.y;
      } else {
        // Fall: parabolic descent + rotation until stick lies flat on ground
        const k = Math.min(1, (t - RISE) / FALL);
        const eY = k * k;                     // accelerating fall (gravity-like)
        const eXZ = 1 - Math.pow(1 - k, 2);   // ease-out horizontal drift
        const fromX = home.x + 0.10;
        const fromZ = home.z + 0.40;
        special.position.set(
          fromX + (xLand - fromX) * eXZ,
          yPeak - (yPeak - yLand) * eY,
          fromZ + (zLand - fromZ) * eXZ,
        );
        // Rotate to lying flat — wide face DOWN, not on its edge.
        // rotation.y is the stick's spin around its long axis (after X tilt),
        // so fade it to 0 to lock the wide face parallel to the ground.
        special.rotation.x = (homeRot.x + 0.5) + (Math.PI / 2 - (homeRot.x + 0.5)) * eXZ;
        special.rotation.y = homeRot.y * (1 - eXZ);
        special.rotation.z = homeRot.z + 0.25 + special.userData.tumble * eXZ;
      }

      stickTipMat.emissiveIntensity = 0.2 + Math.min(1, t * 1.2) * 1.0;

      // Remaining sticks sink slightly inside the box
      sticks.forEach((s) => {
        if (s.userData.special) return;
        s.position.y = s.userData.home.y - Math.min(1, t * 1.4) * 0.08;
      });
    }

    renderer.render(scene, camera);
  };
  tick();

  return {
    dispose: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      renderer.domElement.removeEventListener('click', onMouse);
      renderer.dispose();
      container.removeChild(renderer.domElement);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
    },
    shake: () => { state.shakeIntensity = Math.min(0.35, state.shakeIntensity + 0.12); },
    applyDetection: (d) => {
      if (!d) return;
      const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));
      const accelX = clamp(d.accel_x_g, -2, 2);
      const accelY = clamp(d.accel_y_g, -2, 2);
      const accelZ = clamp(d.accel_z_g, -2, 2);
      const gyroX = clamp(d.gyro_x_dps, -720, 720);
      const gyroY = clamp(d.gyro_y_dps, -720, 720);
      const gyroZ = clamp(d.gyro_z_dps, -720, 720);

      if (!state.accelBaseline) {
        state.accelBaseline = { x: accelX, y: accelY, z: accelZ };
      }
      const baselineAlpha = d.is_shaking ? 0.004 : 0.03;
      state.accelBaseline.x += (accelX - state.accelBaseline.x) * baselineAlpha;
      state.accelBaseline.y += (accelY - state.accelBaseline.y) * baselineAlpha;
      state.accelBaseline.z += (accelZ - state.accelBaseline.z) * baselineAlpha;

      const deltaAccelX = accelX - state.accelBaseline.x;
      const deltaAccelY = accelY - state.accelBaseline.y;
      const deltaAccelZ = accelZ - state.accelBaseline.z;
      const deltaAccelMagnitude = Math.hypot(deltaAccelX, deltaAccelY, deltaAccelZ);
      const accelForce = Math.max(0, deltaAccelMagnitude - 0.025) / 0.55;
      const gyroMagnitude = clamp(d.gyro_magnitude_dps ?? Math.hypot(gyroX, gyroY, gyroZ), 0, 720) / 720;
      const gyroForce = Math.max(0, gyroMagnitude - 0.004) * 0.18;
      const force = Math.max(accelForce, gyroForce);

      const dead = (value, threshold) => Math.abs(value) < threshold ? 0 : value;
      const filteredAccelX = dead(deltaAccelX, 0.025);
      const filteredAccelY = dead(deltaAccelY, 0.025);
      const filteredAccelZ = dead(deltaAccelZ, 0.025);
      const filteredGyroX = dead(gyroX, 2.0);
      const filteredGyroY = dead(gyroY, 2.0);
      const filteredGyroZ = dead(gyroZ, 2.0);
      const sampleMs = Number(d.t_ms) || performance.now();
      const dt = state.lastDetectionMs == null
        ? 0.02
        : clamp((sampleMs - state.lastDetectionMs) / 1000, 0.005, 0.08);
      state.lastDetectionMs = sampleMs;
      const accelToMeters = 9.80665;
      state.sensorVelocity.x = (state.sensorVelocity.x + filteredAccelX * accelToMeters * dt) * 0.88;
      state.sensorVelocity.y = (state.sensorVelocity.y + filteredAccelY * accelToMeters * dt) * 0.88;
      state.sensorVelocity.z = (state.sensorVelocity.z + filteredAccelZ * accelToMeters * dt) * 0.88;
      const velocitySq = (
        state.sensorVelocity.x * state.sensorVelocity.x +
        state.sensorVelocity.y * state.sensorVelocity.y +
        state.sensorVelocity.z * state.sensorVelocity.z
      );
      const omegaSq = (
        Math.pow(filteredGyroX * Math.PI / 180, 2) +
        Math.pow(filteredGyroY * Math.PI / 180, 2) +
        Math.pow(filteredGyroZ * Math.PI / 180, 2)
      );
      // Kinetic-energy proxy: translational 1/2*m*v^2 plus rotational
      // 1/2*I*w^2. The constants are tuned to the cup scale, not real mass.
      const kineticEnergy = 0.5 * 0.36 * velocitySq + 0.5 * 0.018 * omegaSq;
      const normalizedEnergy = clamp((kineticEnergy - 0.0008) / 0.045, 0, 1.8);
      const energyDelta = d.is_shaking ? normalizedEnergy * dt * 11 : 0;

      state.gyroRot.x = clamp((state.gyroRot.x + filteredGyroX * 0.000045) * 0.9, -0.16, 0.16);
      state.gyroRot.y = clamp((state.gyroRot.y + filteredGyroY * 0.00003) * 0.9, -0.1, 0.1);
      state.gyroRot.z = clamp((state.gyroRot.z + filteredGyroZ * 0.000045) * 0.9, -0.16, 0.16);

      state.orientationSamples.push({
        x: clamp(-filteredAccelY * 0.16 + filteredAccelZ * 0.025 + state.gyroRot.x, -0.22, 0.22),
        y: state.gyroRot.y,
        z: clamp(filteredAccelX * 0.16 + state.gyroRot.z, -0.22, 0.22),
      });
      if (state.orientationSamples.length > 18) state.orientationSamples.shift();
      const avg = state.orientationSamples.reduce((acc, sample) => {
        acc.x += sample.x;
        acc.y += sample.y;
        acc.z += sample.z;
        return acc;
      }, { x: 0, y: 0, z: 0 });
      avg.x /= state.orientationSamples.length;
      avg.y /= state.orientationSamples.length;
      avg.z /= state.orientationSamples.length;
      state.targetQuat.setFromEuler(new THREE.Euler(avg.x, avg.y, avg.z, 'YXZ'));

      state.vel.x += filteredAccelY * 0.018 * (1 + accelForce);
      state.vel.y += filteredAccelZ * 0.008 * (1 + accelForce);
      state.vel.z += filteredAccelX * -0.014 * (1 + accelForce);
      state.angularVel.x += filteredAccelZ * 0.012 + filteredGyroX * 0.00008;
      state.angularVel.y += filteredGyroY * 0.00004;
      state.angularVel.z += -filteredAccelX * 0.018 + filteredGyroZ * 0.00008;
      state.motionForce = Math.min(0.26, Math.max(state.motionForce, force * (d.is_shaking ? 0.32 : 0.07)));
      return { isShaking: Boolean(d.is_shaking), kineticEnergy: normalizedEnergy, energyDelta };
    },
    revealStick: () => {
      if (state.revealing) return;
      boxGroup.updateMatrixWorld(true);
      scene.updateMatrixWorld(true);
      scene.attach(special);
      special.userData.revealHome = special.position.clone();
      special.userData.revealHomeRot = special.rotation.clone();
      state.revealing = true;
      state.revealTime = 0;
    },
  };
}



function SentimentEvaluation({ sentiment, status, error, compact = false }) {
  const score = sentiment?.score ?? null;
  const scoreLabel = score == null ? 'รอข้อมูล' : score >= 8 ? 'มั่นคงดี' : score >= 5 ? 'กลาง ๆ มีเรื่องให้ดูแล' : 'ต้องประคองใจ';
  const color = score == null ? 'var(--c-gold)' : score >= 8 ? 'var(--c-mint-deep)' : score >= 5 ? 'var(--c-gold)' : 'var(--c-coral)';
  const percent = score == null ? 0 : Math.max(0, Math.min(100, score * 10));
  return (
    <div className="card card-soft" style={{ padding: compact ? 16 : 26 }}>
      <div className="eyebrow" style={{ marginBottom: compact ? 8 : 10 }}>วิเคราะห์อารมณ์</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: compact ? 12 : 18 }}>
        <h3 style={{ fontSize: compact ? 18 : 22, fontWeight: 500 }}>สภาวะปัจจุบัน</h3>
        <span style={{ color, fontWeight: 600 }}>{scoreLabel}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: compact ? 8 : 14, marginBottom: compact ? 12 : 18 }}>
        <SentimentMetric label="อารมณ์" score={sentiment?.feeling_now} compact={compact}/>
        <SentimentMetric label="ชีวิตตอนนี้" score={sentiment?.wellbeing_now} compact={compact}/>
        <SentimentMetric label="คะแนนรวม" score={sentiment?.score} highlight compact={compact}/>
      </div>
      <div style={{ height: compact ? 8 : 10, borderRadius: 999, background: 'rgba(61,46,42,.08)', overflow: 'hidden' }}>
        <div style={{ width: `${percent}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, var(--c-peach), ${color})`, transition: 'width .25s ease' }}/>
      </div>
      {(sentiment?.reason_th || status === 'loading' || error) && (
        <p style={{ fontSize: compact ? 12 : 13, color: error ? 'var(--c-coral)' : 'var(--text-main)', lineHeight: 1.55, marginTop: compact ? 10 : 14 }}>
          {error || (status === 'loading' ? 'กำลังวิเคราะห์ด้วย LLM...' : sentiment.reason_th)}
        </p>
      )}
      <p style={{ fontSize: compact ? 11 : 12, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: compact ? 10 : 14 }}>
        คะแนนนี้วิเคราะห์จากข้อความอธิษฐานบนสเกล 1-10 ไม่ใช่การวินิจฉัยทางการแพทย์
      </p>
    </div>
  );
}

function SentimentMetric({ label, score, highlight = false, compact = false }) {
  return (
    <div style={{ border: '1px solid var(--border-soft)', borderRadius: compact ? 14 : 18, padding: compact ? 10 : 16, background: 'rgba(255,255,255,.45)' }}>
      <div className="eyebrow" style={{ marginBottom: compact ? 4 : 6 }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: compact ? (highlight ? 28 : 26) : (highlight ? 38 : 34),
        fontWeight: 500,
        color: highlight ? 'var(--c-coral)' : 'var(--text-main)',
        marginBottom: compact ? 4 : 8,
      }}>
        {score ?? '-'}
      </div>
      <span className="badge">เต็ม 10</span>
    </div>
  );
}

const SIAMSEE_CONDITION_LABELS = {
  excited: 'ตื่นตัว',
  focus: 'โฟกัส',
  relax: 'สงบ',
  hesitate: 'ลังเล',
};

function PersonalSiamseeCard({ fortune, siamsee, status, error, fallbackStick = null }) {
  const isComplete = status === 'complete' && siamsee?.reading;
  const isLoading = status === 'loading';
  const label = SIAMSEE_CONDITION_LABELS[siamsee?.predicted_condition] || 'พื้นฐาน';
  const stick = siamsee?.siamsee_stick || fallbackStick;
  const lines = isComplete
    ? String(siamsee.reading).split('\n').filter(Boolean)
    : [];

  return (
    <div className="card card-soft" style={{ padding: 26, transition: 'opacity .35s ease, transform .35s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div className="eyebrow">{isComplete ? 'คำทำนายเฉพาะคุณ' : 'คำแนะนำ'}</div>
        <span className="badge" style={{ opacity: isLoading ? 0.65 : 1 }}>
          {isLoading ? 'กำลังอ่าน...' : `ใบที่ ${stick?.stick_number || '-'} · ${label}`}
        </span>
      </div>

      {stick?.title && (
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 500, marginBottom: 10 }}>
          {stick.title}
        </div>
      )}

      {isLoading && (
        <div style={{ display: 'grid', gap: 10, padding: '4px 0' }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{
              height: 14,
              width: `${92 - i * 7}%`,
              borderRadius: 999,
              background: 'linear-gradient(90deg, rgba(255,255,255,.35), rgba(255,255,255,.75), rgba(255,255,255,.35))',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.2s ease-in-out infinite',
            }}/>
          ))}
        </div>
      )}

      {isComplete && (
        <div style={{ display: 'grid', gap: 8, animation: 'float-up .45s cubic-bezier(.3,.7,.4,1.2) both' }}>
          {lines.map((line, i) => (
            <p key={i} style={{
              fontSize: 16,
              lineHeight: 1.55,
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              textWrap: 'pretty',
            }}>
              {line}
            </p>
          ))}
        </div>
      )}

      {!isLoading && !isComplete && (
        <>
          <p style={{ fontSize: 17, lineHeight: 1.55, fontFamily: 'var(--font-display)', fontWeight: 400, textWrap: 'pretty' }}>
            “{fortune.advice}”
          </p>
          {(error || status === 'fallback' || status === 'error') && (
            <p style={{ fontSize: 11, color: 'var(--text-soft)', lineHeight: 1.45, marginTop: 12 }}>
              ใช้คำทำนายพื้นฐานสำหรับรอบนี้
            </p>
          )}
        </>
      )}
    </div>
  );
}
// result.tsx — Phase 4: Fortune stick result
// Paper-slip oracle card with prediction, advice, reflection question, lucky #.

function ResultScreen({ state, onRestart, onBack, onShop, onDonate, onSaveReading }) {
  const baseFortune = FORTUNES[state.category] || FORTUNES.work;
  const cat = CATEGORIES.find(c => c.id === state.category);
  const t = TEMPLES.find(x => x.id === state.temple);
  const IconC = Icon[cat.icon];

  const [wishText, setWishText] = React.useState(state.feeling || '');
  const [sentiment, setSentiment] = React.useState(null);
  const [sentimentStatus, setSentimentStatus] = React.useState('idle');
  const [sentimentError, setSentimentError] = React.useState('');
  const [siamsee, setSiamsee] = React.useState(null);
  const [siamseeStatus, setSiamseeStatus] = React.useState('idle');
  const [siamseeError, setSiamseeError] = React.useState('');
  const displayedSiamseeStick = state.siamseeStick || getSiamseeStick(state.shakeSession?.stickNumber);
  const fortune = fortuneFromSiamseeStick(
    displayedSiamseeStick,
    baseFortune,
    state.category,
    state.luckyNumber || state.shakeSession?.luckyNumber,
  );

  React.useEffect(() => {
    const text = wishText.trim();
    if (!text) {
      setSentiment(null);
      setSentimentStatus('idle');
      setSentimentError('');
      return;
    }
    let cancelled = false;
    setSentimentStatus('loading');
    setSentimentError('');
    const timer = window.setTimeout(() => {
      analyzeSentiment({ text })
        .then((result) => {
          if (cancelled) return;
          setSentiment(result);
          setSentimentStatus('complete');
        })
        .catch((error) => {
          if (cancelled) return;
          setSentimentStatus('error');
          setSentimentError(error?.message || 'วิเคราะห์อารมณ์ด้วย LLM ไม่สำเร็จ');
        });
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wishText]);

  React.useEffect(() => {
    const palmReading = state?.user?.palmReading;
    const shakeSession = state?.shakeSession;
    const stateWithStick = state?.siamseeStick || !shakeSession?.stickNumber
      ? state
      : { ...state, siamseeStick: getSiamseeStick(shakeSession.stickNumber) };
    const key = makeSiamseeCacheKey(stateWithStick, shakeSession);
    if (!palmReading || !Object.keys(palmReading).length) {
      setSiamsee(makeFallbackSiamsee('fallback', stateWithStick?.siamseeStick || null));
      setSiamseeStatus('fallback');
      setSiamseeError('');
      return;
    }

    let cancelled = false;
    setSiamseeStatus('loading');
    setSiamseeError('');

    const cached = window.__nimiddSiamseeResult;
    const entry = cached?.key === key ? cached : startSiamseePrefetch(stateWithStick, shakeSession);
    const pending = entry?.promise || Promise.resolve(entry?.result || makeFallbackSiamsee('fallback', stateWithStick?.siamseeStick || null));
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      setSiamsee(makeFallbackSiamsee('fallback', stateWithStick?.siamseeStick || null));
      setSiamseeStatus('fallback');
    }, 12000);

    pending
      .then((result) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setSiamsee(result);
        setSiamseeStatus(result?.status === 'complete' ? 'complete' : 'fallback');
      })
      .catch((error) => {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setSiamsee(makeFallbackSiamsee('error', stateWithStick?.siamseeStick || null));
        setSiamseeStatus('error');
        setSiamseeError(error?.message || 'อ่านคำทำนายเฉพาะคุณไม่สำเร็จ');
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [state]);

  return (
    <AppShell step={3}>
      <div style={{
        position: 'absolute', inset: 0, paddingTop: 100,
        overflowY: 'auto', padding: '100px 48px 48px',
      }}>
        <div style={{ maxWidth: 1340, margin: '0 auto' }}>

          {/* Title row */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>ขั้นตอนที่ ๔ · ผลคำทำนาย</div>
            <h1 style={{ fontSize: 44, lineHeight: 1.15, marginBottom: 10 }}>
              ผลเซียมซีของคุณ
            </h1>
            <p style={{ fontSize: 15, color: 'var(--text-muted)' }}>
              อ่านด้วยใจที่เปิดรับ คำทำนายเป็นเพียงเสียงนุ่ม ๆ ที่ชวนให้ทบทวน
            </p>
          </div>

          {/* Two-column: paper slip + advice / actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', gap: 36, alignItems: 'start' }}>

            {/* LEFT column — paper slip + sentiment */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'float-up .6s cubic-bezier(.3,.7,.4,1.4) both' }}>
              <FortuneSlip fortune={fortune} cat={cat} temple={t}/>
              <SentimentEvaluation
                sentiment={sentiment}
                status={sentimentStatus}
                error={sentimentError}
                compact/>
            </div>

            {/* RIGHT panel — interpretation, advice, actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Category strip */}
              <div className="card" style={{
                padding: 20,
                display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 18,
                alignItems: 'center',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 18,
                  background: 'var(--text-main)', color: 'var(--text-on-dark)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IconC size={26}/>
                </div>
                <div>
                  <div className="eyebrow">หมวด</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500 }}>{cat.name}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div className="eyebrow">หมายเลข</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, color: 'var(--text-main)' }}>
                    {fortune.num}
                  </div>
                </div>
                <div style={{
                  paddingLeft: 22, marginLeft: 4, borderLeft: '1px solid var(--border-soft)',
                }}>
                  <div className="eyebrow">ฉาก</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{t.name}</div>
                </div>
              </div>

              <PersonalSiamseeCard
                fortune={fortune}
                siamsee={siamsee}
                status={siamseeStatus}
                error={siamseeError}
                fallbackStick={displayedSiamseeStick}/>

              {/* Reflection question */}
              <div className="card" style={{ padding: 26, display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12,
                  background: 'var(--c-mint)', color: 'var(--text-main)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon.lotus size={20}/>
                </div>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>คำถามชวนทบทวน</div>
                  <p style={{ fontSize: 16, lineHeight: 1.55, color: 'var(--text-main)' }}>
                    {fortune.question}
                  </p>
                </div>
              </div>

              {/* Lucky number */}
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <div className="eyebrow" style={{ marginBottom: 4 }}>เลขนำโชค</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>ใช้เป็นเครื่องเตือนใจเล็ก ๆ ในวันนี้</div>
                  </div>
                  <Icon.sparkle size={18} color="var(--c-gold)"/>
                </div>
                <div style={{
                  padding: '28px 0', textAlign: 'center',
                  borderRadius: 22,
                  background: 'linear-gradient(160deg, var(--c-peach), var(--c-lavender))',
                  color: 'var(--text-main)',
                  fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <Sparkles count={8} color="#FBF2EA"/>
                  <span style={{ position: 'relative' }}>{fortune.luck[0]}</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                <button className="btn btn-primary" onClick={() => onSaveReading(sentiment, siamsee || makeFallbackSiamsee(siamseeStatus === 'error' ? 'error' : 'fallback', displayedSiamseeStick || null))} style={{ padding: '14px 22px', flex: '1 1 auto' }}>
                  <Icon.bell size={16}/> บันทึกผลเซียมซี
                </button>
                <button className="btn btn-secondary" onClick={onDonate} style={{ padding: '14px 22px' }}>
                  <Icon.coin size={16}/> ไปทำบุญออนไลน์
                </button>
                <button className="btn btn-secondary" onClick={onShop} style={{ padding: '14px 22px' }}>
                  <Icon.compass size={16}/> ซื้อของมงคล
                </button>
                <button className="btn btn-tertiary" onClick={onRestart} style={{ padding: '12px 18px' }}>
                  <Icon.refresh size={14}/> เริ่มใหม่
                </button>
              </div>

              {/* Privacy note */}
              <p style={{ fontSize: 11, color: 'var(--text-soft)', lineHeight: 1.55, marginTop: 6 }}>
                คำทำนายเป็นการสะท้อนความคิดเชิงสร้างสรรค์เท่านั้น ไม่ได้รับประกันผลลัพธ์ใด ๆ
                โปรดใช้ดุลพินิจประกอบกับสิ่งที่คุณรู้สึกในใจ
              </p>
            </div>
          </div>

          {/* ── Wish sentiment ───────────────────── */}
          <div style={{ marginTop: 44 }}>
            <div style={{
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
              marginBottom: 18, gap: 16, paddingTop: 28,
              borderTop: '1px dashed var(--border-soft)',
            }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>ข้อความอธิษฐาน · Sentiment</div>
                <h2 style={{ fontSize: 28, lineHeight: 1.2 }}>สภาวะใจปัจจุบันของคุณ</h2>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 460, lineHeight: 1.55 }}>
                ข้อความนี้ใช้วิเคราะห์อารมณ์และคุณภาพชีวิตปัจจุบัน เพื่อบันทึกภาพรวมของพิธีครั้งนี้ให้ชัดขึ้น
              </p>
            </div>

            <div style={{ display: 'grid', gap: 20 }}>
              {/* Wish text input */}
              <div className="card" style={{ padding: 26 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 12,
                    background: 'var(--c-lavender)', color: 'var(--text-main)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon.pencil size={18}/>
                  </div>
                  <div>
                    <div className="eyebrow" style={{ marginBottom: 2 }}>ข้อความอธิษฐาน</div>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>ตอนนี้คุณกำลังขอหรือกังวลเรื่องอะไร?</div>
                  </div>
                </div>
                <textarea
                  value={wishText}
                  onChange={(e) => setWishText(e.target.value)}
                  placeholder="เช่น ขอให้ปีนี้มีเงินใช้พอ ไม่ลำบากเหมือนที่ผ่านมา..."
                  style={{
                    width: '100%', minHeight: 100,
                    border: '1px solid var(--border-soft)',
                    borderRadius: 14, padding: '12px 14px',
                    outline: 'none', resize: 'vertical',
                    background: 'var(--bg-main)', fontFamily: 'inherit',
                    fontSize: 14, lineHeight: 1.6, color: 'var(--text-main)',
                  }}/>
                <p style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 14, lineHeight: 1.5 }}>
                  หากไม่แก้ไข ระบบจะใช้ข้อความที่คุณบันทึกไว้ก่อนเริ่มพิธี
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
window.ResultScreen = ResultScreen;

// ─────────────────────────────────────────────
// FortuneSlip — paper oracle card with tear-edge top and seal stamp
// ─────────────────────────────────────────────
function FortuneSlip({ fortune, cat, temple }) {
  const cTint = temple.accent;
  return (
    <div style={{
      background: 'linear-gradient(180deg, #FBF2EA, #FFF8F0)',
      borderRadius: '20px 20px 28px 28px',
      boxShadow: '0 30px 80px rgba(61,46,42,.15), 0 0 0 1px rgba(61,46,42,.05)',
      padding: '36px 36px 40px',
      position: 'relative',
      overflow: 'hidden',
    }} className="paper-grain">
      {/* tear edge at top */}
      <svg viewBox="0 0 440 12" preserveAspectRatio="none"
        style={{ position: 'absolute', top: -1, left: 0, right: 0, width: '100%', height: 14 }}>
        <path d="M0 0 L0 6 L20 4 L40 8 L60 3 L80 7 L100 4 L120 9 L140 5 L160 8 L180 3 L200 7 L220 4 L240 8 L260 3 L280 7 L300 4 L320 8 L340 3 L360 7 L380 4 L400 8 L420 3 L440 6 L440 0 Z" fill="var(--bg-main)"/>
      </svg>

      {/* top decorative ornament */}
      <div style={{ height: 30, marginBottom: 14 }}>
        <TempleOrnament temple={temple.id}/>
      </div>

      {/* Number — big chinese-style numeral */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, paddingBottom: 20,
        borderBottom: '1px dashed var(--border-medium)',
      }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>หมายเลขที่ได้</div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 80, fontWeight: 500, lineHeight: 1,
            letterSpacing: '-0.04em', color: 'var(--text-main)',
          }}>
            {fortune.num}
          </div>
        </div>
        {/* seal */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: cTint, opacity: 0.85,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#FBF2EA', fontFamily: 'var(--font-display)', fontSize: 14,
          textAlign: 'center', lineHeight: 1.1,
          boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.4)',
          transform: 'rotate(-6deg)',
          letterSpacing: '0.05em',
        }}>
          NIMID<br/>D
        </div>
      </div>

      {/* prediction */}
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 24, fontWeight: 500, lineHeight: 1.3,
        marginBottom: 16, textWrap: 'pretty',
      }}>
        {fortune.title}
      </h2>
      <p style={{
        fontSize: 14.5, lineHeight: 1.75, color: 'var(--text-main)',
        textWrap: 'pretty', marginBottom: 22,
      }}>
        {fortune.text}
      </p>

      {/* footer mark */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 18, borderTop: '1px dashed var(--border-medium)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo/>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>วัด · {temple.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>หมวด · {cat.name}</div>
          </div>
        </div>
        <Sparkles count={3} color={cTint} style={{ position: 'relative', width: 60, height: 24 }}/>
      </div>
    </div>
  );
}
// shop.tsx — Lucky Wallpaper Shop
// Browsable grid of mock mutelu wallpapers, filterable by category.
// Click → detail sheet with phone preview + buy CTA → mock QR success.

// Each wallpaper is a CSS+SVG composition — phone aspect ratio.
const WALLPAPERS = [
  {
    id: 'lotus-gold',  name: 'ดอกบัวสีทอง',      cat: 'love',
    desc: 'บัวบานเหนือผิวน้ำ สื่อถึงใจที่บริสุทธิ์และอ่อนโยน',
    price: 39, palette: ['#F2C68A', '#E59180', '#C9853F'],
    art: 'lotus',
  },
  {
    id: 'crescent',     name: 'พระจันทร์แห่งหวัง', cat: 'love',
    desc: 'จันทร์เสี้ยวเหนือเมฆ พกความหวังติดตัวทุกวัน',
    price: 39, palette: ['#E8C8E0', '#C9A4C4', '#9A7CAA'],
    art: 'moon',
  },
  {
    id: 'lanterns',     name: 'โคมแห่งโชคลาภ',     cat: 'money',
    desc: 'โคมแดงลอยกลางคืน พลังงานแห่งความรุ่งเรือง',
    price: 49, palette: ['#F2A296', '#D97A6C', '#B85A4D'],
    art: 'lanterns',
  },
  {
    id: 'coins',        name: 'เหรียญเงินไหลริน',  cat: 'money',
    desc: 'สายเหรียญทองค่อย ๆ ไหลรินเหมือนน้ำที่ไม่สิ้นสุด',
    price: 49, palette: ['#F5E1B0', '#E0B570', '#A68040'],
    art: 'coins',
  },
  {
    id: 'compass',      name: 'เข็มทิศและขุนเขา',  cat: 'work',
    desc: 'เข็มทิศเหนือทิวเขา ทุกการเดินทางมีจุดหมาย',
    price: 39, palette: ['#B8CFD8', '#7A99A8', '#3D5566'],
    art: 'compass',
  },
  {
    id: 'bamboo',       name: 'ไผ่ในสายลม',         cat: 'work',
    desc: 'ไผ่อ่อนแต่ไม่หัก คือพลังของผู้ปรับตัว',
    price: 39, palette: ['#C8D9B8', '#7BA890', '#4A7A60'],
    art: 'bamboo',
  },
  {
    id: 'wave',         name: 'คลื่นแห่งสมดุล',    cat: 'health',
    desc: 'คลื่นน้ำซ้อนชั้น เตือนใจให้หายใจเข้าออกอย่างนุ่มนวล',
    price: 39, palette: ['#C8DBE8', '#7A99B5', '#4A6F8F'],
    art: 'wave',
  },
  {
    id: 'leaf',         name: 'ใบไม้พลังธรรมชาติ',  cat: 'health',
    desc: 'ใบไม้สีเขียวสด คืนพลังให้กายและใจในทุกวันที่เหนื่อย',
    price: 39, palette: ['#D4E8C4', '#87B59E', '#4A7A60'],
    art: 'leaf',
  },
];

const SHOP_CATS = [
  { id: 'all',    name: 'ทั้งหมด' },
  { id: 'love',   name: 'ความรัก' },
  { id: 'money',  name: 'การเงิน' },
  { id: 'work',   name: 'การงาน' },
  { id: 'health', name: 'สุขภาพ' },
];

window.WALLPAPERS = WALLPAPERS;
window.SHOP_CATS  = SHOP_CATS;

// ─────────────────────────────────────────────
function ShopScreen({ state, onBack, suggestedCat }) {
  const [activeCat, setActiveCat] = React.useState(suggestedCat || 'all');
  const [selected, setSelected] = React.useState(null);
  const visible = WALLPAPERS.filter(w => activeCat === 'all' || w.cat === activeCat);

  return (
    <AppShell step={3}>
      <div style={{ position: 'absolute', inset: 0, paddingTop: 0, overflowY: 'auto', padding: '92px 48px 64px' }}>
        <div style={{ maxWidth: 1340, margin: '0 auto' }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, gap: 24 }}>
            <div style={{ maxWidth: 620 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>ร้านของมงคล · Lucky Shop</div>
              <h1 style={{ fontSize: 44, lineHeight: 1.15, marginBottom: 12, textWrap: 'pretty' }}>
                วอลเปเปอร์เสริมพลังใจ<br/>
                <span style={{ color: 'var(--text-muted)', fontWeight: 300 }}>สำหรับมือถือของคุณ</span>
              </h1>
              <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                เลือกภาพพื้นหลังที่สื่อถึงสิ่งที่คุณกำลังตั้งจิต ภาพหนึ่งภาพอาจเปลี่ยนใจของคุณได้ในทุกครั้งที่หยิบโทรศัพท์
              </p>
            </div>
            <button className="btn btn-tertiary" onClick={onBack}>
              <Icon.arrowL size={16}/> กลับไปยังผลทำนาย
            </button>
          </div>

          {/* Category filter */}
          <div style={{
            display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginRight: 6 }}>
              กรอง
            </span>
            {SHOP_CATS.map(c => (
              <span key={c.id}
                className={`chip ${activeCat === c.id ? 'active' : ''}`}
                onClick={() => setActiveCat(c.id)}>
                {c.name}
                {c.id !== 'all' && (
                  <span style={{
                    marginLeft: 4, opacity: .6, fontSize: 11,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {WALLPAPERS.filter(w => w.cat === c.id).length}
                  </span>
                )}
              </span>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
              พบ {visible.length} วอลเปเปอร์
            </span>
          </div>

          {/* Grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22,
          }}>
            {visible.map(w => (
              <WallpaperCard key={w.id} w={w} onClick={() => setSelected(w)}/>
            ))}
          </div>

          {/* Shop assurances */}
          <div style={{
            marginTop: 36, padding: 22, borderRadius: 22,
            background: 'var(--surface-soft)',
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22,
          }}>
            {[
              { i: Icon.sparkle, t: 'ดาวน์โหลดได้ทันที', s: 'ส่งไฟล์ความละเอียดสูงให้คุณภายในไม่กี่วินาที' },
              { i: Icon.lotus,   t: 'ออกแบบโดยศิลปินไทย', s: 'ทุกภาพถูกออกแบบให้สอดคล้องกับความเชื่อแบบไทย' },
              { i: Icon.bell,    t: 'รายได้สนับสนุนวัด',   s: 'ส่วนหนึ่งของรายได้ทำบุญถวายที่วัดในเครือข่าย' },
            ].map((r, i) => {
              const I = r.i;
              return (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 12,
                    background: 'var(--surface-card)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, boxShadow: 'var(--shadow-soft)',
                  }}>
                    <I size={18}/>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{r.t}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{r.s}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail sheet */}
      {selected && (
        <WallpaperDetail w={selected} onClose={() => setSelected(null)}/>
      )}
    </AppShell>
  );
}
window.ShopScreen = ShopScreen;

// ─────────────────────────────────────────────
function WallpaperCard({ w, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'var(--surface-card)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--radius-card)',
      padding: 14, textAlign: 'left', cursor: 'pointer',
      boxShadow: 'var(--shadow-soft)',
      transition: 'transform .18s cubic-bezier(.3,.7,.4,1.4), box-shadow .18s',
      fontFamily: 'inherit', color: 'inherit',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 14px 30px rgba(61,46,42,.10)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--shadow-soft)'; }}>
      <PhonePreview w={w} height={300}/>
      <div style={{ padding: '14px 4px 2px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, marginBottom: 2 }}>{w.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            หมวด · {SHOP_CATS.find(c => c.id === w.cat)?.name}
          </div>
        </div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500,
          fontVariantNumeric: 'tabular-nums', color: 'var(--text-main)',
        }}>฿{w.price}</div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────
function WallpaperDetail({ w, onClose }) {
  const [phase, setPhase] = React.useState('detail'); // detail | paying | done
  return (
    <div onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 30,
        background: 'rgba(24,20,16,.5)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 32, animation: 'float-up .25s ease both',
      }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-card)',
          borderRadius: 32, padding: 32, maxWidth: 880, width: '100%',
          boxShadow: '0 30px 80px rgba(0,0,0,.3)',
          display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 36,
          alignItems: 'center',
          position: 'relative',
        }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 18, right: 18,
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--bg-soft)', border: 'none', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: 16,
        }}>×</button>

        <PhonePreview w={w} height={420} showStatusBar/>

        {phase === 'detail' && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              ของมงคล · {SHOP_CATS.find(c => c.id === w.cat)?.name}
            </div>
            <h2 style={{ fontSize: 32, lineHeight: 1.2, marginBottom: 12 }}>{w.name}</h2>
            <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 22 }}>
              {w.desc}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 22 }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: 4 }}>ราคา</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500 }}>
                  ฿{w.price}
                </div>
              </div>
              <div style={{ height: 40, width: 1, background: 'var(--border-soft)' }}/>
              <div>
                <div className="eyebrow" style={{ marginBottom: 4 }}>ความละเอียด</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>1170 × 2532 px</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>เหมาะกับมือถือทุกรุ่น</div>
              </div>
              <div style={{ height: 40, width: 1, background: 'var(--border-soft)' }}/>
              <div>
                <div className="eyebrow" style={{ marginBottom: 4 }}>ไฟล์</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>JPG · PNG</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ส่งทาง email</div>
              </div>
            </div>

            {/* palette swatches */}
            <div style={{ marginBottom: 26 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>โทนสี</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {w.palette.map((c, i) => (
                  <div key={i} style={{
                    flex: 1, height: 38, borderRadius: 12,
                    background: c, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.04)',
                  }}/>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setPhase('paying')} className="btn btn-primary"
                style={{ flex: 1, padding: '16px 22px', justifyContent: 'space-between', borderRadius: 18 }}>
                <span><Icon.coin size={16}/> ซื้อ wallpaper · ฿{w.price}</span>
                <Icon.arrowR size={16}/>
              </button>
              <button onClick={onClose} className="btn btn-secondary" style={{ padding: '14px 22px' }}>
                บันทึกไว้ดูทีหลัง
              </button>
            </div>

            <p style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 14, lineHeight: 1.55 }}>
              QR Code ในขั้นตอนต่อไปเป็นข้อมูลจำลองสำหรับต้นแบบเท่านั้น ไม่มีการตัดเงินจริง
            </p>
          </div>
        )}

        {phase === 'paying' && (
          <div style={{ textAlign: 'center', padding: '20px 10px' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>ชำระเงิน · Mock QR</div>
            <h2 style={{ fontSize: 26, lineHeight: 1.2, marginBottom: 16 }}>สแกนเพื่อชำระ ฿{w.price}</h2>
            <MockQR seed={w.id}/>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 16, marginBottom: 22 }}>
              {['PromptPay', 'TrueMoney', 'KBank'].map(b => (
                <span key={b} className="badge">{b}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setPhase('done')} className="btn btn-primary"
                style={{ padding: '14px 22px' }}>
                <Icon.check size={16}/> ชำระเรียบร้อย (สาธิต)
              </button>
              <button onClick={() => setPhase('detail')} className="btn btn-tertiary">
                <Icon.arrowL size={14}/> ย้อนกลับ
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--c-coral)', marginTop: 14 }}>
              QR Code นี้เป็นข้อมูลจำลองสำหรับต้นแบบเท่านั้น
            </p>
          </div>
        )}

        {phase === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 10px' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--c-mint)', margin: '0 auto 18px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-main)',
            }}>
              <Icon.check size={36} sw={2.2}/>
            </div>
            <h2 style={{ fontSize: 26, lineHeight: 1.2, marginBottom: 12 }}>ขอบคุณที่อุดหนุนร้านของเรา</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 22, maxWidth: 340, marginInline: 'auto' }}>
              เราได้ส่งไฟล์วอลเปเปอร์ <b>{w.name}</b> ไปยังอีเมลของคุณแล้ว ขอให้ใจคุณสงบและมีพลังในวันนี้
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={onClose} className="btn btn-primary" style={{ padding: '14px 22px' }}>
                กลับไปเลือกของเพิ่ม
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PhonePreview — phone-shape SVG with the wallpaper art inside
// ─────────────────────────────────────────────
function PhonePreview({ w, height = 300, showStatusBar = false }) {
  const ar = 9 / 19.5;
  const width = height * ar;
  return (
    <div style={{
      width, height, borderRadius: height * 0.07,
      background: '#1a1612', padding: height * 0.018,
      position: 'relative', flexShrink: 0,
      boxShadow: '0 18px 40px rgba(61,46,42,.18), 0 0 0 1px rgba(0,0,0,.4)',
    }}>
      <div style={{
        width: '100%', height: '100%',
        borderRadius: height * 0.06, overflow: 'hidden',
        background: `linear-gradient(180deg, ${w.palette[0]}, ${w.palette[2] || w.palette[1]})`,
        position: 'relative',
      }}>
        <WallpaperArt id={w.art} palette={w.palette} name={w.name}/>
        {showStatusBar && (
          <>
            <div style={{
              position: 'absolute', top: 8, left: 0, right: 0,
              display: 'flex', justifyContent: 'space-between', padding: '0 16px',
              color: '#fff', fontSize: 11, fontWeight: 500, opacity: .9,
            }}>
              <span>9:41</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: 1, background: '#fff' }}/>
                <span style={{ width: 12, height: 6, borderRadius: 1, background: '#fff' }}/>
              </span>
            </div>
            <div style={{
              position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
              width: '38%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,.7)',
            }}/>
          </>
        )}
      </div>
      {/* notch */}
      <div style={{
        position: 'absolute', top: height * 0.018 + 2, left: '50%', transform: 'translateX(-50%)',
        width: '32%', height: height * 0.025, borderRadius: 999, background: '#0a0806',
      }}/>
    </div>
  );
}

// ─────────────────────────────────────────────
// WallpaperArt — different stylized vector compositions per wallpaper.
// ─────────────────────────────────────────────
function WallpaperArt({ id, palette, name }) {
  const [c1, c2, c3] = palette;
  const common = {
    width: '100%', height: '100%',
    viewBox: '0 0 200 400', preserveAspectRatio: 'xMidYMid slice',
    style: { position: 'absolute', inset: 0 },
  };
  return (
    <>
      {id === 'lotus' && (
        <svg {...common}>
          <defs>
            <radialGradient id="lg1" cx=".5" cy=".4" r=".6">
              <stop offset="0" stopColor="#fff" stopOpacity=".6"/>
              <stop offset="1" stopColor={c3} stopOpacity="0"/>
            </radialGradient>
          </defs>
          <rect width="200" height="400" fill={c1}/>
          <rect width="200" height="400" fill="url(#lg1)"/>
          {/* sunburst rays */}
          {Array.from({ length: 18 }).map((_, i) => (
            <path key={i} d="M100 200 L 110 -20 L 90 -20 Z" fill="#fff" opacity=".08"
              transform={`rotate(${i * 20} 100 200)`}/>
          ))}
          {/* lotus */}
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
            const cx = 100 + Math.cos(a) * 26;
            const cy = 200 + Math.sin(a) * 26;
            return <ellipse key={i} cx={cx} cy={cy} rx="22" ry="34" fill={c3} opacity=".85"
              transform={`rotate(${(a * 180 / Math.PI) + 90} ${cx} ${cy})`}/>;
          })}
          <circle cx="100" cy="200" r="22" fill="#fff" opacity=".95"/>
          <circle cx="100" cy="200" r="10" fill={c3}/>
          {/* water ripples */}
          <ellipse cx="100" cy="320" rx="80" ry="6" fill="#fff" opacity=".25"/>
          <ellipse cx="100" cy="335" rx="60" ry="4" fill="#fff" opacity=".18"/>
        </svg>
      )}

      {id === 'moon' && (
        <svg {...common}>
          <rect width="200" height="400" fill={c1}/>
          <rect width="200" height="400" fill={`url(#mgrad-${id})`}/>
          <defs>
            <linearGradient id={`mgrad-${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={c3} stopOpacity=".25"/>
              <stop offset="1" stopColor={c1} stopOpacity="0"/>
            </linearGradient>
          </defs>
          {/* stars */}
          {Array.from({ length: 30 }).map((_, i) => (
            <circle key={i} cx={((i * 47) % 200)} cy={((i * 91) % 400)} r={Math.random() * 1.5 + .5}
              fill="#fff" opacity={Math.random() * 0.6 + 0.3}/>
          ))}
          {/* clouds */}
          <ellipse cx="40" cy="250" rx="60" ry="14" fill="#fff" opacity=".18"/>
          <ellipse cx="160" cy="290" rx="70" ry="12" fill="#fff" opacity=".14"/>
          {/* crescent moon */}
          <g transform="translate(100 160)">
            <circle r="48" fill="#fff" opacity=".95"/>
            <circle cx="18" r="48" fill={c1}/>
          </g>
        </svg>
      )}

      {id === 'lanterns' && (
        <svg {...common}>
          <rect width="200" height="400" fill={c2}/>
          {/* fog */}
          <rect width="200" height="180" y="220" fill={c3} opacity=".35"/>
          {/* hanging lanterns */}
          {[{x:50,y:130,s:.8},{x:100,y:90,s:1},{x:150,y:140,s:.85}].map((l, i) => (
            <g key={i} transform={`translate(${l.x} ${l.y}) scale(${l.s})`}>
              <line x1="0" y1="-100" x2="0" y2="-20" stroke="#3a2218" strokeWidth="1.5"/>
              <ellipse cx="0" cy="10" rx="22" ry="28" fill={c1}/>
              <rect x="-22" y="6" width="44" height="2" fill="#fff" opacity=".5"/>
              <rect x="-3" y="38" width="6" height="14" fill={c3}/>
              <line x1="0" y1="52" x2="-6" y2="68" stroke={c3} strokeWidth="1"/>
              <line x1="0" y1="52" x2="6" y2="68" stroke={c3} strokeWidth="1"/>
            </g>
          ))}
          {/* sparkles */}
          {Array.from({ length: 14 }).map((_, i) => (
            <circle key={i} cx={(i * 31) % 200} cy={(i * 53) % 250 + 100} r="1.5"
              fill="#fff" opacity={Math.random() * 0.7 + 0.3}/>
          ))}
        </svg>
      )}

      {id === 'coins' && (
        <svg {...common}>
          <rect width="200" height="400" fill={c1}/>
          <rect width="200" height="200" y="200" fill={c2} opacity=".5"/>
          {/* falling coins */}
          {Array.from({ length: 22 }).map((_, i) => {
            const x = (i * 37) % 180 + 10;
            const y = (i * 61) % 360 + 20;
            return (
              <g key={i} transform={`translate(${x} ${y})`}>
                <ellipse rx="10" ry="3" fill={c3} opacity=".3"/>
                <circle r="10" fill={c2}/>
                <circle r="8" fill={c1} opacity=".7"/>
                <text textAnchor="middle" dy="3" fontFamily="serif" fontSize="10" fontWeight="700" fill={c3}>福</text>
              </g>
            );
          })}
        </svg>
      )}

      {id === 'compass' && (
        <svg {...common}>
          <rect width="200" height="400" fill={c1}/>
          {/* mountains */}
          <path d="M0 320 L 50 240 L 90 280 L 130 220 L 170 290 L 200 250 L 200 400 L 0 400 Z" fill={c3}/>
          <path d="M0 350 L 40 290 L 80 320 L 120 270 L 170 320 L 200 290 L 200 400 L 0 400 Z" fill={c3} opacity=".5"/>
          {/* sun */}
          <circle cx="140" cy="100" r="30" fill="#fff" opacity=".7"/>
          {/* compass */}
          <g transform="translate(100 180)">
            <circle r="48" fill="none" stroke="#fff" strokeWidth="1.5" opacity=".8"/>
            <circle r="40" fill="none" stroke="#fff" strokeWidth=".6" opacity=".5"/>
            {/* N/S/E/W ticks */}
            {[0, 90, 180, 270].map(a => (
              <line key={a} x1="0" y1="-44" x2="0" y2="-36" stroke="#fff" strokeWidth="1.4"
                transform={`rotate(${a})`}/>
            ))}
            {/* needle */}
            <polygon points="0,-32 6,0 0,32 -6,0" fill={c3}/>
            <polygon points="0,-32 6,0 0,0" fill="#fff" opacity=".9"/>
            <circle r="3" fill="#fff"/>
          </g>
        </svg>
      )}

      {id === 'bamboo' && (
        <svg {...common}>
          <rect width="200" height="400" fill={c1}/>
          {/* bamboo stalks */}
          {[40, 90, 140, 175].map((x, i) => (
            <g key={i}>
              <rect x={x - 6} y="-20" width="12" height="440" fill={c3} opacity={.6 + i * 0.05}/>
              {[20, 80, 140, 200, 260, 320, 380].map(y => (
                <ellipse key={y} cx={x} cy={y} rx="8" ry="4" fill={c2}/>
              ))}
              {/* leaves */}
              {[50, 180, 300].map((y, k) => (
                <g key={y} transform={`translate(${x} ${y}) rotate(${(i + k) * 30})`}>
                  <ellipse cx="14" cy="0" rx="14" ry="3" fill={c2}/>
                </g>
              ))}
            </g>
          ))}
        </svg>
      )}

      {id === 'wave' && (
        <svg {...common}>
          <rect width="200" height="400" fill={c1}/>
          {/* layered waves */}
          {[120, 170, 220, 270, 320].map((y, i) => (
            <path key={y}
              d={`M0 ${y} Q 50 ${y - 20 + i * 4} 100 ${y} T 200 ${y} L 200 400 L 0 400 Z`}
              fill={i % 2 ? c2 : c3} opacity={0.4 + i * 0.1}/>
          ))}
          {/* moon */}
          <circle cx="150" cy="80" r="22" fill="#fff" opacity=".85"/>
          <circle cx="150" cy="80" r="22" fill="none" stroke="#fff" strokeWidth="1" opacity=".4"/>
        </svg>
      )}

      {id === 'leaf' && (
        <svg {...common}>
          <rect width="200" height="400" fill={c1}/>
          {/* leaves */}
          {[{x:50,y:80,r:30,s:1},{x:140,y:160,r:-20,s:1.3},{x:60,y:250,r:60,s:1.1},{x:150,y:330,r:-10,s:.9}].map((l, i) => (
            <g key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.r}) scale(${l.s})`}>
              <path d="M0 0 Q 20 -30 40 0 Q 20 30 0 0 Z" fill={c3} opacity=".85"/>
              <path d="M0 0 L 40 0" stroke={c1} strokeWidth="1" opacity=".5"/>
            </g>
          ))}
          {/* dewdrops */}
          {Array.from({ length: 12 }).map((_, i) => (
            <circle key={i} cx={(i * 41) % 180 + 10} cy={(i * 79) % 380 + 10} r="2"
              fill="#fff" opacity={Math.random() * 0.6 + 0.3}/>
          ))}
        </svg>
      )}

      {/* corner brand mark */}
      <div style={{
        position: 'absolute', bottom: 12, left: 0, right: 0,
        textAlign: 'center', color: '#fff', opacity: 0.7,
        fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '.16em',
        textTransform: 'uppercase',
      }}>
        NIMID D · {name}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// MockQR — pseudo QR pattern generated from a seed
// ─────────────────────────────────────────────
function MockQR({ seed = 'siamsi', size = 180 }) {
  const grid = 25;
  const cells = React.useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    const out = [];
    for (let i = 0; i < grid * grid; i++) {
      h = (h * 1103515245 + 12345) | 0;
      out.push(((h >> 16) & 1) === 1);
    }
    return out;
  }, [seed]);
  const cs = size / grid;
  // finder squares (top-left, top-right, bottom-left)
  const finders = [[0,0],[grid-7,0],[0,grid-7]];
  const inFinder = (x, y) => finders.some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);

  return (
    <div style={{
      width: size + 28, height: size + 28, padding: 14,
      borderRadius: 18, background: '#fff', display: 'inline-block',
      boxShadow: '0 8px 22px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.04)',
    }}>
      <svg width={size} height={size}>
        {/* random data cells */}
        {cells.map((on, i) => {
          if (!on) return null;
          const x = i % grid, y = (i / grid) | 0;
          if (inFinder(x, y)) return null;
          return <rect key={i} x={x * cs} y={y * cs} width={cs} height={cs} fill="#1a1612"/>;
        })}
        {/* finder patterns */}
        {finders.map(([fx, fy], i) => (
          <g key={i} transform={`translate(${fx * cs} ${fy * cs})`}>
            <rect width={cs * 7} height={cs * 7} fill="#1a1612"/>
            <rect x={cs} y={cs} width={cs * 5} height={cs * 5} fill="#fff"/>
            <rect x={cs * 2} y={cs * 2} width={cs * 3} height={cs * 3} fill="#1a1612"/>
          </g>
        ))}
        {/* center logo */}
        <g transform={`translate(${size/2 - cs * 3} ${size/2 - cs * 3})`}>
          <rect width={cs * 6} height={cs * 6} rx="4" fill="#fff"/>
          <rect x={cs * 0.5} y={cs * 0.5} width={cs * 5} height={cs * 5} rx="3" fill="var(--c-peach)"/>
          <g transform={`translate(${cs * 3} ${cs * 3}) scale(${cs * 0.25})`}>
            <path d="M0 8 C -6 8 -10 4 -10 -2 C -10 -6 -6 -8 0 -6 C 6 -8 10 -6 10 -2 C 10 4 6 8 0 8 Z" fill="#fff"/>
          </g>
        </g>
      </svg>
    </div>
  );
}
window.MockQR = MockQR;
// donation.tsx — Online donation page
// Shows an illustrated wooden alms box (ตู้บริจาค) with a Thai QR Payment
// card pasted on the front. User picks a donation purpose + amount.

const DONATION_PURPOSES = [
{ id: 'temple', name: 'บูรณะวัด', desc: 'ร่วมบำรุงรักษาศาสนสถาน' },
{ id: 'monks', name: 'ถวายภัตตาหารพระสงฆ์', desc: 'อาหารถวายพระในแต่ละวัน' },
{ id: 'edu', name: 'การศึกษาเยาวชน', desc: 'ทุนการศึกษาสำหรับเด็กในชุมชน' },
{ id: 'medi', name: 'ค่ารักษาพยาบาล', desc: 'ผู้ป่วยยากไร้ในชุมชนวัด' }];


const DONATION_AMOUNTS = [20, 50, 100, 200, 500, 1000];

function DonationScreen({ state, onBack }) {
  const t = TEMPLES.find((x) => x.id === state.temple) || TEMPLES[0];

  return (
    <AppShell step={3}>
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '92px 48px 48px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, gap: 24 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 12 }}>ทำบุญออนไลน์ · Online Donation</div>
              <h1 style={{ fontSize: 36, lineHeight: 1.2, marginBottom: 8, textWrap: 'pretty' }}>
                ร่วมทำบุญกับ {t.name}
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                สแกน QR Code บนตู้บริจาคเพื่อร่วมทำบุญตามจิตศรัทธา
              </p>
            </div>
            <button className="btn btn-tertiary" onClick={onBack}>
              <Icon.arrowL size={16} /> กลับไปยังผลทำนาย
            </button>
          </div>

          {/* Centered donation box */}
          <DonationBox temple={t} amount={0} purpose={{ id: 'temple', name: 'ร่วมทำบุญ' }} />

          {/* Mock disclaimer */}
          <div style={{
            marginTop: 18, padding: 16, borderRadius: 18,
            background: 'var(--surface-soft)', fontSize: 12, color: 'var(--text-muted)',
            lineHeight: 1.55, display: 'flex', gap: 10, alignItems: 'flex-start'
          }}>
            <Icon.bell size={16} color="var(--c-coral)" />
            <div>
              <b style={{ color: 'var(--text-main)' }}>QR Code นี้เป็นข้อมูลจำลองสำหรับต้นแบบเท่านั้น</b><br />
              ในการใช้งานจริง ระบบจะสร้าง QR PromptPay พร้อมข้อมูลของวัดให้อัตโนมัติ
            </div>
          </div>
        </div>
      </div>
    </AppShell>);

}
window.DonationScreen = DonationScreen;

// ─────────────────────────────────────────────
// DonationBox — illustration of a METAL alms box with QR card on the front
// ─────────────────────────────────────────────
function DonationBox({ temple, amount, purpose }) {
  return (
    <div style={{
      position: 'relative',
      borderRadius: 32, padding: 28,
      background: `linear-gradient(165deg, ${temple.swatch[1]}, ${temple.swatch[2]})`,
      overflow: 'hidden',
      minHeight: 540
    }}>
      <Sparkles count={14} color="#FBF2EA" />

      {/* Temple ornament header */}
      <div style={{ position: 'absolute', top: 14, left: 0, right: 0, height: 30, opacity: 0.65 }}>
        <TempleOrnament temple={temple.id} />
      </div>

      {/* SVG isometric donation box — METAL finish */}
      <div style={{
        position: 'absolute', top: 60, left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <svg viewBox="0 0 420 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
        style={{ filter: 'drop-shadow(0 20px 30px rgba(61,46,42,.30))', width: "720px" }}>
          <defs>
            {/* Brushed-steel gradient for the front face */}
            <linearGradient id="metal-front" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#D8DAD8" />
              <stop offset="0.4" stopColor="#9FA4A6" />
              <stop offset="0.7" stopColor="#8A8F92" />
              <stop offset="1" stopColor="#5E6366" />
            </linearGradient>
            {/* Sheen highlight across the middle */}
            <linearGradient id="metal-sheen" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity=".22" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            {/* Top of the box (lid surface) — slightly brighter */}
            <linearGradient id="metal-top" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#E5E7E5" />
              <stop offset="1" stopColor="#A8ACAE" />
            </linearGradient>
            {/* Brass trim (warm metallic gold) */}
            <linearGradient id="brass-trim" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#F4D58A" />
              <stop offset="0.5" stopColor="#D0A14A" />
              <stop offset="1" stopColor="#8A6A2E" />
            </linearGradient>
          </defs>

          {/* Ground shadow */}
          <ellipse cx="210" cy="450" rx="150" ry="14" fill="rgba(0,0,0,.20)" />

          {/* Brass pediment / temple-style top */}
          <g transform="translate(60, 50)">
            <path d="M-10 60 L150 -10 L310 60 L290 70 L150 10 L10 70 Z" fill="url(#brass-trim)" />
            <path d="M150 -10 L150 30 M120 22 L180 22" stroke="#5C381F" strokeWidth="3" strokeLinecap="round" />
            <circle cx="150" cy="-10" r="6" fill="#5C381F" />
            {/* Lotus crown */}
            <g transform="translate(150 28)">
              {[0, 60, 120, 180, 240, 300].map((a) =>
              <ellipse key={a} cx="0" cy="-6" rx="3" ry="8" fill="#F2D08C"
              transform={`rotate(${a})`} />
              )}
              <circle r="3" fill="#5C381F" />
            </g>
          </g>

          {/* Box body — front face (metal) */}
          <rect x="60" y="120" width="300" height="280" rx="6" fill="url(#metal-front)" />
          {/* Vertical sheen */}
          <rect x="60" y="120" width="300" height="280" rx="6" fill="url(#metal-sheen)" />

          {/* Brushed-metal horizontal grain */}
          <g opacity=".3" stroke="#5C6366" strokeWidth="0.5" fill="none">
            {Array.from({ length: 40 }).map((_, i) =>
            <line key={i} x1="62" y1={125 + i * 7} x2="358" y2={125 + i * 7} />
            )}
          </g>

          {/* Top-edge brass trim band */}
          <rect x="56" y="116" width="308" height="14" rx="3" fill="url(#brass-trim)" />
          {/* Bottom-edge brass trim band */}
          <rect x="56" y="392" width="308" height="14" rx="3" fill="url(#brass-trim)" />
          {/* Vertical side highlights / shadows */}
          <rect x="60" y="130" width="8" height="262" fill="rgba(0,0,0,.18)" />
          <rect x="352" y="130" width="8" height="262" fill="rgba(255,255,255,.16)" />

          {/* Four corner rivets (brass) */}
          {[[78, 138], [342, 138], [78, 380], [342, 380]].map(([x, y], i) =>
          <g key={i}>
              <circle cx={x} cy={y} r="5" fill="url(#brass-trim)" />
              <circle cx={x - 1} cy={y - 1} r="1.6" fill="#F8E2A6" />
            </g>
          )}

          {/* Coin slot — metallic top with darker recessed slot */}
          <g transform="translate(60, 100)">
            <rect width="300" height="22" rx="4" fill="url(#metal-top)" />
            <rect x="110" y="6" width="80" height="8" rx="2" fill="#1A1612" stroke="#3A3E40" strokeWidth="1" />
            <rect x="112" y="7" width="76" height="2" fill="#000" opacity=".6" />
          </g>

          {/* Engraved inscription */}
          <text x="210" y="160" textAnchor="middle"
          fontFamily="var(--font-display)" fontWeight="600" fontSize="15"
          fill="#3D2E2A" letterSpacing="6" opacity=".75">
            ทำบุญ
          </text>
          <text x="210" y="161" textAnchor="middle"
          fontFamily="var(--font-display)" fontWeight="600" fontSize="15"
          fill="#fff" letterSpacing="6" opacity=".45">
            ทำบุญ
          </text>

          {/* Tape strips holding the QR card */}
          <rect x="108" y="194" width="32" height="10" rx="1" fill="#F4EAD8" opacity=".85" transform="rotate(-3 124 199)" />
          <rect x="280" y="194" width="32" height="10" rx="1" fill="#F4EAD8" opacity=".85" transform="rotate(2 296 199)" />

          {/* QR Card — pasted on the front of the box */}
          <foreignObject x="100" y="200" width="220" height="200">
            <div style={{
              width: 220, height: '100%',
              background: '#FFFFFF', borderRadius: 8,
              overflow: 'hidden', boxShadow: '0 8px 22px rgba(0,0,0,.45), 0 0 0 2px rgba(255,255,255,.6)',
              fontFamily: 'var(--font-body)',
              transform: 'rotate(-1.4deg)'
            }}>
              <ThaiQRCard amount={amount} purpose={purpose} temple={temple} />
            </div>
          </foreignObject>
        </svg>
      </div>
    </div>);

}

// ─────────────────────────────────────────────
// ThaiQRCard — replica of a typical Thai QR Payment / PromptPay card
// (header band, QR, account info, K+ footer). Mock data only.
// ─────────────────────────────────────────────
function ThaiQRCard({ amount, purpose, temple }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 9 }}>
      {/* Header band — teal */}
      <div style={{
        background: '#1E5F70', color: '#fff',
        padding: '8px 10px',
        display: 'flex', alignItems: 'center', gap: 6
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 4,
          background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <svg viewBox="0 0 22 22" width="14" height="14">
            <path d="M3 18 L3 4 L11 8 L19 4 L19 18 L11 14 Z" fill="#1E5F70" />
            <path d="M3 18 L11 14 L19 18" fill="#5BA88F" />
          </svg>
        </div>
        <div style={{ flex: 1, lineHeight: 1.05 }}>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.04em' }}>THAI QR</div>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.04em' }}>PAYMENT</div>
        </div>
      </div>

      <div style={{ padding: '8px 10px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', gap: 4 }}>
        {/* PromptPay logo box */}
        <div style={{
          padding: '2px 6px', border: '1px solid #1E5F70', borderRadius: 3,
          fontSize: 7, fontWeight: 700, color: '#1E5F70', position: 'relative'
        }}>
          <span style={{
            position: 'absolute', top: -7, right: 2, fontSize: 6, color: '#1E5F70'
          }}>พร้อมเพย์</span>
          Prompt<span style={{ background: '#1E5F70', color: '#fff', padding: '0 2px' }}>Pay</span>
        </div>

        {/* Small QR */}
        <div style={{ marginTop: 2 }}>
          <CompactQR seed={`donate-${purpose.id}-${amount}-${temple.id}`} size={92} />
        </div>

        {/* Account info */}
        <div style={{
          color: '#1E5F70', fontWeight: 700, fontSize: 7.5, marginTop: 4, textAlign: 'center',
          lineHeight: 1.3
        }}>
          สแกน QR เพื่อโอนเข้าบัญชี
        </div>
        <div style={{ fontSize: 7, color: '#3D2E2A', textAlign: 'center', lineHeight: 1.3 }}>
          ชื่อ: วัด{temple.name === 'วัดไทย' ? 'พุทธสามัคคี' : temple.name === 'วัดจีน' ? 'มังกรบุปผา' : 'สากุระประดิษฐ์'}<br />
          บัญชี: xxx-x-x{(1000 + Math.abs(temple.name.length) * 137 + amount) % 10000}-x
        </div>
        <div style={{ fontSize: 6.5, color: '#8A7570' }}>
          เลขที่อ้างอิง: {String(Date.now() % 100000000000).padStart(11, '0')}
        </div>
      </div>

      {/* K+ footer */}
      <div style={{
        background: '#F5F5F5', padding: '4px 8px',
        borderTop: '2px solid #5BA88F',
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 6.5, color: '#3D2E2A'
      }}>
        <span style={{
          background: '#3D2E2A', color: '#fff', padding: '1px 4px',
          fontSize: 7, fontWeight: 700, borderRadius: 1
        }}>K+</span>
        <span style={{ fontWeight: 600, color: '#3D2E2A' }}>Accepts all banks</span>
        <span style={{ color: '#5BA88F' }}>| รับเงินได้จากทุกธนาคาร</span>
      </div>
    </div>);

}

// Compact QR pattern (smaller than shop's MockQR, for the card)
function CompactQR({ seed, size = 100 }) {
  const grid = 21;
  const cells = React.useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i) | 0;
    const out = [];
    for (let i = 0; i < grid * grid; i++) {
      h = h * 1103515245 + 12345 | 0;
      out.push((h >> 16 & 1) === 1);
    }
    return out;
  }, [seed]);
  const cs = size / grid;
  const finders = [[0, 0], [grid - 7, 0], [0, grid - 7]];
  const inFinder = (x, y) => finders.some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);

  return (
    <svg width={size} height={size}>
      {cells.map((on, i) => {
        if (!on) return null;
        const x = i % grid,y = i / grid | 0;
        if (inFinder(x, y)) return null;
        return <rect key={i} x={x * cs} y={y * cs} width={cs} height={cs} fill="#1a1612" />;
      })}
      {finders.map(([fx, fy], i) =>
      <g key={i} transform={`translate(${fx * cs} ${fy * cs})`}>
          <rect width={cs * 7} height={cs * 7} fill="#1a1612" />
          <rect x={cs} y={cs} width={cs * 5} height={cs * 5} fill="#fff" />
          <rect x={cs * 2} y={cs * 2} width={cs * 3} height={cs * 3} fill="#1a1612" />
        </g>
      )}
      {/* center logo */}
      <g transform={`translate(${size / 2 - cs * 2.2} ${size / 2 - cs * 2.2})`}>
        <rect width={cs * 4.4} height={cs * 4.4} fill="#fff" />
        <g transform={`translate(${cs * 2.2} ${cs * 2.2})`}>
          <path d="M-4 4 L-4 -3 L0 -1 L4 -3 L4 4 L0 2 Z" fill="#1E5F70" transform={`scale(${cs * 0.4})`} />
        </g>
      </g>
    </svg>);

}

// ─────────────────────────────────────────────
function DonationSuccess({ amount, purpose, temple, onClose, onBack }) {
  return (
    <div className="card" style={{ padding: 36, textAlign: 'center' }}>
      <div style={{
        width: 88, height: 88, borderRadius: '50%',
        background: 'linear-gradient(160deg, var(--c-peach), var(--c-lavender))',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 22px',
        position: 'relative'
      }}>
        <Icon.check size={44} sw={2.4} color="#fff" />
        <Sparkles count={8} color="var(--c-gold)" style={{ inset: -10 }} />
      </div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>ขอบคุณที่ร่วมทำบุญ</div>
      <h2 style={{ fontSize: 30, lineHeight: 1.2, marginBottom: 12 }}>
        บุญของท่านได้ถูกส่งมอบแล้ว
      </h2>
      <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 24, maxWidth: 420, marginInline: 'auto' }}>
        ขอบคุณที่ร่วมทำบุญ <b>"{purpose.name}"</b> จำนวน <b>฿{amount.toLocaleString()}</b> กับ{temple.name}
        ขอให้บุญที่ท่านทำในวันนี้ ส่งผลให้ท่านมีความสุขกายสุขใจตลอดไป
      </p>

      <div style={{
        background: 'var(--surface-soft)', borderRadius: 18, padding: 20,
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24
      }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>วัด</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{temple.name}</div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>หมายเลขใบอนุโมทนา</div>
          <div style={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
            #{String(Date.now() % 100000).padStart(5, '0')}
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>วันที่</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>
            {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={onClose} style={{ padding: '14px 22px' }}>
          ทำบุญอีกครั้ง
        </button>
        <button className="btn btn-secondary" onClick={onBack} style={{ padding: '14px 22px' }}>
          กลับไปยังผลทำนาย
        </button>
      </div>
    </div>);

}// app.tsx — wires everything into a Design Canvas with Tweaks.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "radius": 28,
  "season": "spring",
  "detail": "med",
  "musicVol": 50
}/*EDITMODE-END*/;

const DEFAULT_RITUAL = {
  user: null, // { name, dob, palm }
  activity: 'meditate',
  feeling: '',
  moods: [],
  temple: 'thai',
  box: 'gold',
  category: 'work',
  music: 'bell',
  shakeSession: null,
  siamseeStick: null,
  luckyNumber: null,
};

const SEASON_PALETTES = {
  spring: ['#F2B5A0', '#E8C8E0', '#B8D8C8'],
  summer: ['#F5C26B', '#D8C8A0', '#C4D49C'],
  autumn: ['#E89976', '#C7A89A', '#C8C49C'],
  winter: ['#C9B8E0', '#D5C4E3', '#B8CFD8'],
};

// Each artboard runs PhaseHost — it owns its own ritual state so the four
// artboards feel like four screens of the same product, but stay independent
// for review.
function PhaseHost({ initialPhase, ritualPatch = {}, focus, loginProps = {} }) {
  const [phase, setPhase] = React.useState(initialPhase);
  const [ritual, setRitual] = React.useState({ ...DEFAULT_RITUAL, ...ritualPatch });
  const tweaks = window.__tweaks || TWEAK_DEFAULTS;
  usePalmReadingEvents(ritual, setRitual);
  usePendingPalmReading(ritual);

  // Listen for tweak changes
  const [, setBump] = React.useState(0);
  React.useEffect(() => {
    const h = () => setBump(n => n + 1);
    window.addEventListener('tweakchange', h);
    return () => window.removeEventListener('tweakchange', h);
  }, []);

  // apply tokens
  React.useEffect(() => {
    document.documentElement.style.setProperty('--radius-card', tweaks.radius + 'px');
    document.documentElement.style.setProperty('--radius-chip', Math.max(8, tweaks.radius * 0.5) + 'px');
    document.documentElement.style.setProperty('--radius-input', Math.max(10, tweaks.radius * 0.6) + 'px');
    document.documentElement.setAttribute('data-season', tweaks.season);
  }, [tweaks.radius, tweaks.season]);

  // Phase routing per artboard. For focused single-phase artboards, the
  // user can advance/retreat within that artboard's own state too — gives
  // each frame its full flow once focused, while staying labeled by its
  // primary phase on the canvas.
  if (phase === 'login') {
    return <LoginScreen initial={{ ...loginProps, ...(ritual.user || {}) }}
      onContinue={(u) => { setRitual(r => ({ ...r, user: u })); setPhase('setup'); }}/>;
  }
  if (phase === 'setup') {
    return <SetupScreen state={ritual} setState={setRitual} onContinue={() => setPhase('meditation')}/>;
  }
  if (phase === 'meditation') {
    return <MeditationScreen state={ritual}
      onContinue={() => setPhase('shake')}
      onBack={() => setPhase('setup')}/>;
  }
  if (phase === 'shake') {
    return <ShakeScreen state={ritual} setState={setRitual}
      detail={tweaks.detail} vol={tweaks.musicVol / 100}
      onContinue={() => setPhase('result')}
      onBack={() => setPhase('meditation')}/>;
  }
  if (phase === 'shop') {
    return <ShopScreen state={ritual}
      suggestedCat={ritual.category}
      onBack={() => setPhase('result')}/>;
  }
  if (phase === 'donate') {
    return <DonationScreen state={ritual}
      onBack={() => setPhase('result')}/>;
  }
  return <ResultScreen state={ritual}
    onRestart={() => { setRitual(r => ({ ...DEFAULT_RITUAL, ...ritualPatch, user: r.user })); setPhase('setup'); }}
    onBack={() => setPhase('shake')}
    onShop={() => setPhase('shop')}
    onDonate={() => setPhase('donate')}/>;
}

// ─────────────────────────────────────────────
// Demo ritual states — fills the focused phase so each artboard looks
// "real" without needing the previous phases to be played through.
// ─────────────────────────────────────────────
const DEMO_FOR_PHASE = {
  login:      { /* fresh */ },
  setup:      { user: { name: 'ปลายฟ้า', dob: '1995-06-12', palm: null },
                feeling: 'วันนี้รู้สึกเหนื่อย ๆ อยากได้คำแนะนำให้กลับมาตั้งหลักกับงานอีกครั้ง',
                moods: ['เหนื่อย', 'อยากได้คำแนะนำ'], activity: 'meditate' },
  meditation: { activity: 'meditate', feeling: 'พร้อมแล้ว', temple: 'japanese' },
  shake:      { activity: 'meditate', feeling: 'พร้อมแล้ว', temple: 'chinese', box: 'red', category: 'love' },
  result:     { activity: 'meditate', feeling: 'พร้อมแล้ว', temple: 'thai', box: 'gold', category: 'work' },
  shop:       { activity: 'meditate', feeling: 'พร้อมแล้ว', temple: 'thai', box: 'gold', category: 'work' },
  donate:     { activity: 'meditate', feeling: 'พร้อมแล้ว', temple: 'thai', box: 'gold', category: 'work' },
};

function DesignCanvasApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  // expose so PhaseHost (in another script scope) can read latest values
  React.useEffect(() => { window.__tweaks = t; }, [t]);

  return (
    <>
      <DesignCanvas>
        <DCSection id="ritual" title="พิธีเซียมซี" subtitle="Mindful Fortune Stick Ritual · 6 frames">
          <DCArtboard id="login" label="00a · ลงทะเบียน · First visit" width={1440} height={900}>
            <PhaseHost initialPhase="login" ritualPatch={DEMO_FOR_PHASE.login}
              loginProps={{ forceRegister: true }}/>
          </DCArtboard>
          <DCArtboard id="login-back" label="00b · สวัสดีกลับมา · Welcome back" width={1440} height={900}>
            <PhaseHost initialPhase="login" ritualPatch={DEMO_FOR_PHASE.login}
              loginProps={{ user: { name: 'ปลายฟ้า', dob: '1995-06-12', palm: null } }}/>
          </DCArtboard>
          <DCArtboard id="setup" label="01 · เตรียมใจ · Setup" width={1440} height={900}>
            <PhaseHost initialPhase="setup" ritualPatch={DEMO_FOR_PHASE.setup}/>
          </DCArtboard>
          <DCArtboard id="meditation" label="02 · เตรียมใจ · 1 นาที" width={1440} height={900}>
            <PhaseHost initialPhase="meditation" ritualPatch={DEMO_FOR_PHASE.meditation}/>
          </DCArtboard>
          <DCArtboard id="shake" label="03 · เขย่าเซียมซี · Three.js" width={1440} height={900}>
            <PhaseHost initialPhase="shake" ritualPatch={DEMO_FOR_PHASE.shake}/>
          </DCArtboard>
          <DCArtboard id="result" label="04 · ผลคำทำนาย · Fortune slip" width={1440} height={900}>
            <PhaseHost initialPhase="result" ritualPatch={DEMO_FOR_PHASE.result}/>
          </DCArtboard>
          <DCArtboard id="shop" label="05 · ร้านของมงคล · Lucky Shop" width={1440} height={900}>
            <PhaseHost initialPhase="shop" ritualPatch={DEMO_FOR_PHASE.shop}/>
          </DCArtboard>
          <DCArtboard id="donate" label="06 · ตู้บริจาค · Donation" width={1440} height={900}>
            <PhaseHost initialPhase="donate" ritualPatch={DEMO_FOR_PHASE.donate}/>
          </DCArtboard>
        </DCSection>

        <DCPostIt top={-12} left={1500} rotate={3} width={220}>
          เปิด <b>Tweaks</b> เพื่อสลับโทนสี ฤดูกาล หรือระดับรายละเอียดของ 3D
        </DCPostIt>
      </DesignCanvas>

      <TweaksPanel title="Tweaks · พิธีเซียมซี">
        <TweakSection label="โทนสี / ฤดู">
          <TweakColor label="พาเล็ตต์"
            value={SEASON_PALETTES[t.season]}
            options={Object.values(SEASON_PALETTES)}
            onChange={(arr) => {
              const key = Object.keys(SEASON_PALETTES).find(k => SEASON_PALETTES[k].join() === arr.join());
              if (key) setTweak('season', key);
            }}/>
          <TweakRadio label="Season" value={t.season}
            options={[
              { value: 'spring', label: 'ใบไม้ผลิ' },
              { value: 'summer', label: 'ฤดูร้อน' },
              { value: 'autumn', label: 'ใบไม้ร่วง' },
              { value: 'winter', label: 'ฤดูหนาว' },
            ]}
            onChange={(v) => setTweak('season', v)}/>
        </TweakSection>

        <TweakSection label="รูปทรงการ์ด">
          <TweakSlider label="ขอบโค้งของการ์ด" value={t.radius}
            min={8} max={48} step={2} unit="px"
            onChange={(v) => setTweak('radius', v)}/>
        </TweakSection>

        <TweakSection label="ฉาก 3D">
          <TweakRadio label="ระดับรายละเอียด" value={t.detail}
            options={[
              { value: 'low', label: 'ต่ำ' },
              { value: 'med', label: 'ปานกลาง' },
              { value: 'high', label: 'สูง' },
            ]}
            onChange={(v) => setTweak('detail', v)}/>
        </TweakSection>

        <TweakSection label="เสียง">
          <TweakSlider label="ระดับเสียงเพลง" value={t.musicVol}
            min={0} max={100} step={5} unit="%"
            onChange={(v) => setTweak('musicVol', v)}/>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// one-page.tsx — Single-page stacked view of all 4 phases.
// Sticky side rail jumps between phases; each phase fills the viewport.

const OP_PHASES = [
  { id: 'login',      num: '๐', label: 'ลงทะเบียน',       sub: 'Login',          patch: {} },
  { id: 'setup',      num: '๑', label: 'เตรียมใจ',       sub: 'Setup',          patch: { feeling: 'วันนี้รู้สึกเหนื่อย ๆ อยากได้คำแนะนำให้กลับมาตั้งหลักกับงานอีกครั้ง', moods: ['เหนื่อย', 'อยากได้คำแนะนำ'] } },
  { id: 'meditation', num: '๒', label: 'สมาธิ ๑ นาที',   sub: 'Mindful Minute', patch: { activity: 'meditate' } },
  { id: 'shake',      num: '๓', label: 'เขย่าเซียมซี',    sub: 'Three.js Ritual', patch: { temple: 'chinese', box: 'red', category: 'love' } },
  { id: 'result',     num: '๔', label: 'ผลคำทำนาย',     sub: 'Fortune Slip',   patch: { temple: 'thai', box: 'gold', category: 'work' } },
  { id: 'shop',       num: '๕', label: 'ร้านของมงคล',     sub: 'Lucky Shop',     patch: { temple: 'thai', box: 'gold', category: 'work' } },
  { id: 'donate',     num: '๖', label: 'ตู้บริจาค',       sub: 'Donation',       patch: { temple: 'thai', box: 'gold', category: 'work' } },
];

const OP_DEFAULTS = TWEAK_DEFAULTS;
const OP_DEFAULT_RITUAL = DEFAULT_RITUAL;
const OP_SEASON_PALETTES = SEASON_PALETTES;

// ─────────────────────────────────────────────
// PhaseStage — wraps each phase in a fixed 1440x900 frame, scaled to fit
// the viewport width, so layouts don't squish on smaller displays.
// ─────────────────────────────────────────────
function PhaseStage({ phaseDef, children, id }) {
  const wrapRef = React.useRef(null);
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const W = wrap.clientWidth;
      // design width 1440 — scale down so it fits, never up
      const s = Math.min(1, W / 1440);
      setScale(s);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  return (
    <section id={id} data-screen-label={phaseDef.label} style={{
      position: 'relative',
      minHeight: 900 * scale + 80,
      padding: '40px 0',
      scrollMarginTop: 24,
    }}>
      {/* Phase chapter heading */}
      <div style={{
        maxWidth: 1280, margin: '0 auto 20px', padding: '0 32px',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 24,
      }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '6px 14px', borderRadius: 999,
            background: 'var(--surface-card)', boxShadow: 'var(--shadow-soft)',
            fontSize: 12, fontWeight: 500, color: 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-main)' }}>
              ขั้นตอนที่ {phaseDef.num}
            </span>
            · {phaseDef.sub}
          </div>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 500,
            letterSpacing: '-0.01em', color: 'var(--text-main)',
          }}>
            {phaseDef.label}
          </h2>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-soft)', textAlign: 'right' }}>
          1440 × 900 · {Math.round(scale * 100)}%
        </div>
      </div>

      {/* scaled frame */}
      <div ref={wrapRef} style={{
        width: '100%', maxWidth: 1440, margin: '0 auto',
        padding: '0 32px', position: 'relative',
      }}>
        <div style={{
          width: 1440, height: 900,
          transform: `scale(${scale})`, transformOrigin: 'top left',
          borderRadius: 28, overflow: 'hidden',
          boxShadow: '0 30px 80px rgba(61,46,42,.12), 0 0 0 1px rgba(61,46,42,.04)',
          background: 'var(--bg-main)',
        }}>
          {children}
        </div>
        {/* invisible spacer so layout reflects scaled height */}
        <div style={{ height: 900 * scale, width: 1, pointerEvents: 'none' }}/>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────
// SidebarNav — sticky on the left, jumps between phases
// ─────────────────────────────────────────────
function SidebarNav({ active, setActive, visible }) {
  const go = (id) => {
    setActive(id);
    const el = document.getElementById('phase-' + id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <aside style={{
      position: 'fixed', left: 24, top: '50%',
      transform: `translateY(-50%) translateX(${visible ? 0 : -24}px)`,
      opacity: visible ? 1 : 0,
      pointerEvents: visible ? 'auto' : 'none',
      transition: 'opacity .3s ease, transform .3s cubic-bezier(.3,.7,.4,1.4)',
      zIndex: 20,
      padding: 16, borderRadius: 28,
      background: 'rgba(255,255,255,.78)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      border: '1px solid rgba(255,255,255,.7)',
      boxShadow: 'var(--shadow-soft)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {OP_PHASES.map((p, i) => {
        const on = p.id === active;
        return (
          <button key={p.id} onClick={() => go(p.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', border: 'none',
            background: on ? 'var(--text-main)' : 'transparent',
            color: on ? 'var(--text-on-dark)' : 'var(--text-main)',
            borderRadius: 999, cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: 13,
            transition: 'all .18s', textAlign: 'left',
            minWidth: 168,
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: on ? 'var(--c-peach)' : 'var(--bg-soft)',
              color: 'var(--text-main)',
              fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 500,
              flexShrink: 0,
            }}>{p.num}</span>
            <span style={{ flex: 1, fontWeight: on ? 500 : 400 }}>{p.label}</span>
            <span style={{
              width: 4, height: 4, borderRadius: '50%',
              background: on ? 'var(--c-mint)' : 'transparent',
            }}/>
          </button>
        );
      })}
      {/* progress connector */}
      <div style={{
        position: 'absolute', left: 27, top: 30, bottom: 30, width: 2,
        background: 'linear-gradient(to bottom, var(--c-peach), var(--c-lavender), var(--c-mint), var(--c-gold))',
        opacity: 0.2, borderRadius: 1, zIndex: -1,
      }}/>
    </aside>
  );
}

// ─────────────────────────────────────────────
// OnePageHero — landing title above the stacked phases
// ─────────────────────────────────────────────
function OnePageHero({ onStart, heroRef }) {
  return (
    <header ref={heroRef} style={{
      position: 'relative',
      padding: '80px 32px 60px',
      maxWidth: 1280, margin: '0 auto',
      textAlign: 'center',
    }}>
      <Sparkles count={20}/>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <Logo/>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500 }}>NIMID D</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Mindful Ritual</div>
        </div>
      </div>
      <div className="eyebrow" style={{ marginBottom: 14 }}>One-Page Journey · ฉบับเลื่อนดูเต็มเรื่อง</div>
      <h1 style={{
        fontFamily: 'var(--font-display)', fontWeight: 500,
        fontSize: 64, lineHeight: 1.1, letterSpacing: '-0.02em',
        marginBottom: 18, textWrap: 'balance',
      }}>
        พิธีเสี่ยงเซียมซีออนไลน์<br/>
        <span style={{ color: 'var(--text-muted)', fontWeight: 300 }}>ที่อยู่กับใจคุณ</span>
      </h1>
      <p style={{
        fontSize: 17, color: 'var(--text-muted)', lineHeight: 1.6,
        maxWidth: 560, margin: '0 auto 32px', textWrap: 'pretty',
      }}>
        ทั้ง ๗ ขั้นตอนของพิธีเซียมซี เรียงร้อยเป็นหน้าเดียวให้คุณเลื่อนดูได้ตามจังหวะของตัวเอง
      </p>
      <div style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={onStart} style={{ padding: '16px 28px' }}>
          เริ่มอ่านพิธี <Icon.arrowR size={18}/>
        </button>
        <a href="index.html" className="btn btn-tertiary" style={{ padding: '12px 18px', textDecoration: 'none' }}>
          กลับสู่ Design Canvas
        </a>
      </div>

      {/* phase tiles preview */}
      <div style={{
        marginTop: 56, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10,
        maxWidth: 1280, margin: '56px auto 0',
      }}>
        {OP_PHASES.map((p, i) => (
          <a key={p.id} href={`#phase-${p.id}`} style={{
            textDecoration: 'none',
            padding: 20, borderRadius: 24,
            background: 'var(--surface-card)',
            boxShadow: 'var(--shadow-soft)',
            color: 'var(--text-main)', textAlign: 'left',
            display: 'flex', flexDirection: 'column', gap: 6,
            transition: 'transform .18s, box-shadow .18s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 14px 30px rgba(61,46,42,.10)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--shadow-soft)'; }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500,
              color: 'var(--text-soft)',
            }}>{p.num}</span>
            <span style={{ fontSize: 15, fontWeight: 500 }}>{p.label}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{p.sub}</span>
          </a>
        ))}
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────
// OnePageApp — top-level
// ─────────────────────────────────────────────
function OnePageApp() {
  const [t, setTweak] = useTweaks(OP_DEFAULTS);
  const [ritual, setRitual] = React.useState(OP_DEFAULT_RITUAL);
  const [active, setActive] = React.useState('login');
  const [navVisible, setNavVisible] = React.useState(false);
  const heroRef = React.useRef(null);
  usePalmReadingEvents(ritual, setRitual);
  usePendingPalmReading(ritual);

  // apply tokens
  React.useEffect(() => {
    document.documentElement.style.setProperty('--radius-card', t.radius + 'px');
    document.documentElement.style.setProperty('--radius-chip', Math.max(8, t.radius * 0.5) + 'px');
    document.documentElement.style.setProperty('--radius-input', Math.max(10, t.radius * 0.6) + 'px');
    document.documentElement.setAttribute('data-season', t.season);
  }, [t.radius, t.season]);

  // observe sections to update active tab
  React.useEffect(() => {
    const opts = { rootMargin: '-40% 0px -55% 0px', threshold: 0 };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const id = e.target.id.replace('phase-', '');
          setActive(id);
          break;
        }
      }
    }, opts);
    OP_PHASES.forEach(p => {
      const el = document.getElementById('phase-' + p.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  // hide sidebar while hero is in view to avoid overlapping the headline
  React.useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        // show nav only once at least 70% of the hero has scrolled off
        setNavVisible(e.intersectionRatio < 0.3);
      }
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // build a phase-specific ritual once so the scene doesn't re-init on each parent re-render
  const ritualFor = React.useCallback((p) => ({ ...ritual, ...p.patch }), [ritual]);

  const goStart = () => {
    document.getElementById('phase-login')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-main)',
      color: 'var(--text-main)',
      fontFamily: 'var(--font-body)',
    }}>
      <OnePageHero onStart={goStart} heroRef={heroRef}/>

      <SidebarNav active={active} setActive={setActive} visible={navVisible}/>

      <main style={{ paddingBottom: 80 }}>
        <PhaseStage id="phase-login" phaseDef={OP_PHASES[0]}>
          <LoginScreen initial={ritual.user || {}}
            onContinue={(u) => { setRitual(r => ({ ...r, user: u })); document.getElementById('phase-setup')?.scrollIntoView({ behavior: 'smooth' }); }}/>
        </PhaseStage>

        <PhaseStage id="phase-setup" phaseDef={OP_PHASES[1]}>
          <SetupScreen state={ritualFor(OP_PHASES[1])} setState={setRitual}
            onContinue={() => document.getElementById('phase-meditation')?.scrollIntoView({ behavior: 'smooth' })}/>
        </PhaseStage>

        <PhaseStage id="phase-meditation" phaseDef={OP_PHASES[2]}>
          <MeditationScreen state={ritualFor(OP_PHASES[2])}
            onContinue={() => document.getElementById('phase-shake')?.scrollIntoView({ behavior: 'smooth' })}
            onBack={() => document.getElementById('phase-setup')?.scrollIntoView({ behavior: 'smooth' })}/>
        </PhaseStage>

        <PhaseStage id="phase-shake" phaseDef={OP_PHASES[3]}>
          <ShakeScreen state={ritualFor(OP_PHASES[3])} setState={setRitual}
            detail={t.detail} vol={t.musicVol / 100}
            onContinue={() => document.getElementById('phase-result')?.scrollIntoView({ behavior: 'smooth' })}
            onBack={() => document.getElementById('phase-meditation')?.scrollIntoView({ behavior: 'smooth' })}/>
        </PhaseStage>

        <PhaseStage id="phase-result" phaseDef={OP_PHASES[4]}>
          <ResultScreen state={ritualFor(OP_PHASES[4])}
            onRestart={() => document.getElementById('phase-login')?.scrollIntoView({ behavior: 'smooth' })}
            onBack={() => document.getElementById('phase-shake')?.scrollIntoView({ behavior: 'smooth' })}
            onShop={() => document.getElementById('phase-shop')?.scrollIntoView({ behavior: 'smooth' })}
            onDonate={() => document.getElementById('phase-donate')?.scrollIntoView({ behavior: 'smooth' })}/>
        </PhaseStage>

        <PhaseStage id="phase-shop" phaseDef={OP_PHASES[5]}>
          <ShopScreen state={ritualFor(OP_PHASES[5])}
            suggestedCat={ritualFor(OP_PHASES[5]).category}
            onBack={() => document.getElementById('phase-result')?.scrollIntoView({ behavior: 'smooth' })}/>
        </PhaseStage>

        <PhaseStage id="phase-donate" phaseDef={OP_PHASES[6]}>
          <DonationScreen state={ritualFor(OP_PHASES[6])}
            onBack={() => document.getElementById('phase-result')?.scrollIntoView({ behavior: 'smooth' })}/>
        </PhaseStage>

        {/* outro */}
        <section style={{
          maxWidth: 720, margin: '40px auto 0', padding: '60px 32px',
          textAlign: 'center',
        }}>
          <Icon.lotus size={48} color="var(--c-peach-deep)"/>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 500, marginTop: 18, marginBottom: 10 }}>
            ขอบคุณที่ใช้เวลากับใจในวันนี้
          </h3>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            เริ่มใหม่อีกครั้งได้เสมอ — ความสงบของคุณคือจุดเริ่มต้นของทุกการทำนาย
          </p>
          <button className="btn btn-secondary" onClick={goStart}
            style={{ marginTop: 24, padding: '14px 22px' }}>
            <Icon.refresh size={16}/> เริ่มใหม่
          </button>
        </section>
      </main>

      <TweaksPanel title="Tweaks · พิธีเซียมซี">
        <TweakSection label="โทนสี / ฤดู">
          <TweakColor label="พาเล็ตต์"
            value={OP_SEASON_PALETTES[t.season]}
            options={Object.values(OP_SEASON_PALETTES)}
            onChange={(arr) => {
              const key = Object.keys(OP_SEASON_PALETTES).find(k => OP_SEASON_PALETTES[k].join() === arr.join());
              if (key) setTweak('season', key);
            }}/>
          <TweakRadio label="ฤดู" value={t.season}
            options={[
              { value: 'spring', label: 'ใบไม้ผลิ' },
              { value: 'summer', label: 'ฤดูร้อน' },
              { value: 'autumn', label: 'ใบไม้ร่วง' },
              { value: 'winter', label: 'ฤดูหนาว' },
            ]}
            onChange={(v) => setTweak('season', v)}/>
        </TweakSection>

        <TweakSection label="รูปทรงการ์ด">
          <TweakSlider label="ขอบโค้งของการ์ด" value={t.radius}
            min={8} max={48} step={2} unit="px"
            onChange={(v) => setTweak('radius', v)}/>
        </TweakSection>

        <TweakSection label="ฉาก 3D">
          <TweakRadio label="ระดับรายละเอียด" value={t.detail}
            options={[
              { value: 'low', label: 'ต่ำ' },
              { value: 'med', label: 'ปานกลาง' },
              { value: 'high', label: 'สูง' },
            ]}
            onChange={(v) => setTweak('detail', v)}/>
        </TweakSection>

        <TweakSection label="เสียง">
          <TweakSlider label="ระดับเสียงเพลง" value={t.musicVol}
            min={0} max={100} step={5} unit="%"
            onChange={(v) => setTweak('musicVol', v)}/>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

const RITUAL_STATE_KEY = 'siamsi:ritual';
const READINGS_STATE_KEY = 'siamsi:readings';

function readReadingHistory() {
  try {
    const raw = localStorage.getItem(READINGS_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeReadingHistory(readings) {
  try { localStorage.setItem(READINGS_STATE_KEY, JSON.stringify(readings)); } catch {}
}

function makeReadingRecord(ritual, sentiment = null, siamsee = null) {
  const baseFortune = FORTUNES[ritual.category] || FORTUNES.work;
  const fortune = fortuneFromSiamseeStick(ritual.siamseeStick, baseFortune, ritual.category || 'work', ritual.luckyNumber || ritual.shakeSession?.luckyNumber);
  const record = {
    id: `reading_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    user: ritual.user || null,
    ritual: {
      activity: ritual.activity || null,
      feeling: ritual.feeling || '',
      moods: Array.isArray(ritual.moods) ? ritual.moods : [],
      temple: ritual.temple || 'thai',
      box: ritual.box || 'gold',
      category: ritual.category || 'work',
      music: ritual.music || 'bell',
      siamseeStick: ritual.siamseeStick || null,
      luckyNumber: ritual.luckyNumber || ritual.shakeSession?.luckyNumber || null,
    },
    fortune: {
      category: ritual.category || 'work',
      num: fortune.num,
      title: fortune.title,
      text: fortune.text,
      advice: fortune.advice,
      question: fortune.question,
      luck: fortune.luck,
    },
  };
  if (sentiment) record.sentiment = sentiment;
  if (siamsee) record.siamsee = siamsee;
  return record;
}

function saveReadingRecord(ritual, sentiment = null, siamsee = null) {
  const record = makeReadingRecord(ritual, sentiment, siamsee);
  writeReadingHistory([record, ...readReadingHistory()]);
  return record;
}

function useRitualState() {
  const [ritual, setRitual] = React.useState(() => {
    try {
      const raw = localStorage.getItem(RITUAL_STATE_KEY);
      return raw ? { ...DEFAULT_RITUAL, ...JSON.parse(raw) } : DEFAULT_RITUAL;
    } catch {
      return DEFAULT_RITUAL;
    }
  });

  React.useEffect(() => {
    try { localStorage.setItem(RITUAL_STATE_KEY, JSON.stringify(ritual)); } catch {}
  }, [ritual]);

  return [ritual, setRitual];
}

function useSharedTweaks() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    window.__tweaks = t;
    window.dispatchEvent(new Event('tweakchange'));
    document.documentElement.style.setProperty('--radius-card', t.radius + 'px');
    document.documentElement.style.setProperty('--radius-chip', Math.max(8, t.radius * 0.5) + 'px');
    document.documentElement.style.setProperty('--radius-input', Math.max(10, t.radius * 0.6) + 'px');
    document.documentElement.setAttribute('data-season', t.season);
  }, [t]);

  return [t, setTweak];
}

function RitualPages() {
  const navigate = useNavigate();
  const location = useLocation();
  const [ritual, setRitual] = useRitualState();
  const [readings, setReadings] = React.useState(() => readReadingHistory());
  const [readingsLoading, setReadingsLoading] = React.useState(true);
  const [readingsError, setReadingsError] = React.useState('');
  const [readingsSource, setReadingsSource] = React.useState('local');
  const [t, setTweak] = useSharedTweaks();
  const hydratedSession = React.useRef(false);
  const showPageTweaks = !['/journey', '/canvas'].includes(location.pathname);
  usePalmReadingEvents(ritual, setRitual);
  usePendingPalmReading(ritual);

  const useLocalReadingsFallback = React.useCallback((message) => {
    setReadings(readReadingHistory());
    setReadingsSource('local');
    setReadingsError(message);
  }, []);

  const refreshReadings = React.useCallback(async () => {
    setReadingsLoading(true);
    setReadingsError('');
    try {
      const payload = await getReadings();
      const nextReadings = Array.isArray(payload?.readings) ? payload.readings : [];
      writeReadingHistory(nextReadings);
      setReadings(nextReadings);
      setReadingsSource('backend');
      return nextReadings;
    } catch (error) {
      useLocalReadingsFallback(error?.message || 'โหลดข้อมูลจากระบบไม่สำเร็จ กำลังแสดงข้อมูลบนเครื่องนี้');
      return null;
    } finally {
      setReadingsLoading(false);
    }
  }, [useLocalReadingsFallback]);

  React.useEffect(() => {
    let cancelled = false;
    setReadingsLoading(true);
    setReadingsError('');
    getSessionSnapshot()
      .then((snapshot) => {
        if (cancelled) return;
        hydratedSession.current = true;
        if (!snapshot?.authenticated) {
          useLocalReadingsFallback('ยังไม่ได้เชื่อมต่อบัญชี กำลังแสดงข้อมูลบนเครื่องนี้');
          return;
        }
        if (snapshot.user) {
          try { localStorage.setItem(LS_USER_KEY, JSON.stringify(snapshot.user)); } catch {}
        }
        if (snapshot.ritual) {
          setRitual((current) => ({ ...current, ...snapshot.ritual, user: snapshot.user || snapshot.ritual.user || current.user }));
        } else if (snapshot.user) {
          setRitual((current) => ({ ...current, user: snapshot.user }));
        }
        if (Array.isArray(snapshot.readings)) {
          writeReadingHistory(snapshot.readings);
          setReadings(snapshot.readings);
          setReadingsSource('backend');
          setReadingsError('');
        }
      })
      .catch((error) => {
        if (cancelled) return;
        hydratedSession.current = true;
        useLocalReadingsFallback(error?.message || 'โหลดข้อมูลจากระบบไม่สำเร็จ กำลังแสดงข้อมูลบนเครื่องนี้');
      })
      .finally(() => {
        if (!cancelled) setReadingsLoading(false);
      });
    return () => { cancelled = true; };
  }, [setRitual, useLocalReadingsFallback]);

  React.useEffect(() => {
    if (!hydratedSession.current || !ritual?.user) return;
    const timer = window.setTimeout(() => {
      saveRitualDraft(ritual).catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [ritual]);

  const go = (path) => navigate(path);
  const saveAndOpenDashboard = async (sentiment = null, siamsee = null) => {
    const record = saveReadingRecord(ritual, sentiment, siamsee);
    setReadings(readReadingHistory());
    setReadingsSource('local');
    setReadingsError('กำลังบันทึกขึ้นระบบ ข้อมูลล่าสุดอาจยังเป็นข้อมูลบนเครื่องนี้');
    go('/dashboard');
    try {
      const saved = await saveReading(record);
      const next = [saved.record || record, ...readReadingHistory().filter((r) => r.id !== record.id)];
      writeReadingHistory(next);
      setReadings(next);
      setReadingsSource('backend');
      setReadingsError('');
    } catch (error) {
      setReadingsSource('local');
      setReadingsError(error?.message || 'บันทึกขึ้นระบบไม่สำเร็จ กำลังแสดงข้อมูลบนเครื่องนี้');
    }
  };
  const restart = () => {
    setRitual((r) => ({ ...DEFAULT_RITUAL, user: r.user }));
    go('/setup');
  };

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace/>}/>
        <Route path="/login" element={
          <PageFrame>
            <LoginScreen initial={ritual.user || {}}
              onContinue={(user) => { setRitual((r) => ({ ...r, user })); go('/setup'); }}/>
          </PageFrame>
        }/>
        <Route path="/setup" element={
          <PageFrame>
            <SetupScreen state={ritual} setState={setRitual} onContinue={() => go('/meditation')}/>
          </PageFrame>
        }/>
        <Route path="/meditation" element={
          <PageFrame>
            <MeditationScreen state={ritual} onContinue={() => go('/shake')} onBack={() => go('/setup')}/>
          </PageFrame>
        }/>
        <Route path="/shake" element={
          <PageFrame>
            <ShakeScreen state={ritual} setState={setRitual} detail={t.detail} vol={t.musicVol / 100}
              onContinue={() => go('/result')} onBack={() => go('/meditation')}/>
          </PageFrame>
        }/>
        <Route path="/result" element={
          <PageFrame>
            <ResultScreen state={ritual} onRestart={restart} onBack={() => go('/shake')}
              onShop={() => go('/shop')} onDonate={() => go('/donate')}
              onSaveReading={saveAndOpenDashboard}/>
          </PageFrame>
        }/>
        <Route path="/dashboard" element={
          <DashboardScreen
            ritual={ritual}
            setRitual={setRitual}
            readings={readings}
            isLoadingReadings={readingsLoading}
            readingsError={readingsError}
            readingsSource={readingsSource}
            refreshReadings={refreshReadings}
            go={go}
            deps={{ CATEGORIES, TEMPLES, BOXES, FORTUNES, Icon, Sparkles, makeReadingRecord }}/>
        }/>
        <Route path="/shop" element={
          <PageFrame>
            <ShopScreen state={ritual} suggestedCat={ritual.category} onBack={() => go('/result')}/>
          </PageFrame>
        }/>
        <Route path="/donate" element={
          <PageFrame>
            <DonationScreen state={ritual} onBack={() => go('/result')}/>
          </PageFrame>
        }/>
        <Route path="/journey" element={<OnePageApp/>}/>
        <Route path="/canvas" element={<DesignCanvasApp/>}/>
        <Route path="*" element={<Navigate to="/login" replace/>}/>
      </Routes>

      {showPageTweaks && <TweaksPanel title="Tweaks · พิธีเซียมซี">
        <TweakSection label="โทนสี / ฤดู">
          <TweakColor label="พาเล็ตต์"
            value={SEASON_PALETTES[t.season]}
            options={Object.values(SEASON_PALETTES)}
            onChange={(arr) => {
              const key = Object.keys(SEASON_PALETTES).find(k => SEASON_PALETTES[k].join() === arr.join());
              if (key) setTweak('season', key);
            }}/>
          <TweakRadio label="ฤดู" value={t.season}
            options={[
              { value: 'spring', label: 'ใบไม้ผลิ' },
              { value: 'summer', label: 'ฤดูร้อน' },
              { value: 'autumn', label: 'ใบไม้ร่วง' },
              { value: 'winter', label: 'ฤดูหนาว' },
            ]}
            onChange={(v) => setTweak('season', v)}/>
        </TweakSection>

        <TweakSection label="รูปทรงการ์ด">
          <TweakSlider label="ขอบโค้งของการ์ด" value={t.radius}
            min={8} max={48} step={2} unit="px"
            onChange={(v) => setTweak('radius', v)}/>
        </TweakSection>

        <TweakSection label="ฉาก 3D">
          <TweakRadio label="ระดับรายละเอียด" value={t.detail}
            options={[
              { value: 'low', label: 'ต่ำ' },
              { value: 'med', label: 'ปานกลาง' },
              { value: 'high', label: 'สูง' },
            ]}
            onChange={(v) => setTweak('detail', v)}/>
        </TweakSection>

        <TweakSection label="เสียง">
          <TweakSlider label="ระดับเสียงเพลง" value={t.musicVol}
            min={0} max={100} step={5} unit="%"
            onChange={(v) => setTweak('musicVol', v)}/>
        </TweakSection>
      </TweaksPanel>}
    </>
  );
}

function RoutedApp() {
  useRealtimeEvents();

  return (
    <HashRouter>
      <AppNav/>
      <RitualPages/>
      <PalmReadingToastHost/>
    </HashRouter>
  );
}

export default RoutedApp;
