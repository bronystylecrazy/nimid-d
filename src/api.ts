// @ts-nocheck
async function apiJson(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.detail || `Request failed: ${response.status}`);
  }
  return payload;
}

export function getSessionSnapshot() {
  return apiJson('/api/session');
}

export function saveSessionUser(user, ritual = null) {
  return apiJson('/api/session/user', {
    method: 'POST',
    body: JSON.stringify({ user, ritual }),
  });
}

export function clearSession() {
  return apiJson('/api/session', { method: 'DELETE' });
}

export function saveRitualDraft(ritual) {
  return apiJson('/api/ritual', {
    method: 'PUT',
    body: JSON.stringify({ ritual }),
  });
}

export function saveReading(record) {
  return apiJson('/api/readings', {
    method: 'POST',
    body: JSON.stringify({ record }),
  });
}

export function analyzeSentiment(payload) {
  return apiJson('/api/sentiment', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
