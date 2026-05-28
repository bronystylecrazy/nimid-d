// @ts-nocheck

function mostFrequent(items) {
  const counts = new Map();
  items.forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  let best = null;
  let bestCount = 0;
  counts.forEach((count, item) => {
    if (count > bestCount) { best = item; bestCount = count; }
  });
  return best;
}

function parseReadingDate(value) {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function readingTime(record) {
  return parseReadingDate(record?.createdAt)?.getTime() ?? 0;
}

function calcCurrentStreak(readings) {
  const days = new Set(readings
    .map(r => parseReadingDate(r?.createdAt))
    .filter(Boolean)
    .map(d => d.toISOString().slice(0, 10)));
  let streak = 0;
  const d = new Date();
  while (days.has(d.toISOString().slice(0, 10))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function calcWeeklyInsights(readings) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const week = readings.filter(r => readingTime(r) >= weekAgo);
  const moods = week.flatMap(r => r.ritual?.moods || []);
  const clarityHits = moods.filter(m => ['สงบ', 'มีหวัง', 'อยากได้คำแนะนำ'].includes(m)).length;
  const energyHits = moods.filter(m => ['เหนื่อย', 'กังวล', 'สับสน'].includes(m)).length;
  const base = Math.min(100, week.length * 18);
  return {
    clarity: Math.max(20, Math.min(96, base + clarityHits * 12)),
    energy: Math.max(20, Math.min(92, 74 - energyHits * 8 + week.length * 6)),
    luck: Math.max(20, Math.min(99, base + new Set(week.map(r => r.ritual?.category)).size * 10)),
  };
}

function formatRelativeDay(iso) {
  const now = new Date();
  const d = parseReadingDate(iso);
  if (!d) return 'Unknown date';
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startNow - startDay) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
}

export { mostFrequent, parseReadingDate, readingTime, calcCurrentStreak, calcWeeklyInsights, formatRelativeDay };
