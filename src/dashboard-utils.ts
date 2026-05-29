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

function topFrequencies(items, limit = 5) {
  const counts = new Map();
  items.filter(Boolean).forEach((item) => counts.set(item, (counts.get(item) || 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
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

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function average(values) {
  const nums = values.map(finiteNumber).filter(value => value != null);
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function calcResultInsights(readings) {
  const sorted = [...(readings || [])].sort((a, b) => readingTime(b) - readingTime(a));
  const total = sorted.length;
  const recent = sorted.slice(0, 7);
  const older = sorted.slice(7, 14);
  const moodCounts = topFrequencies(sorted.flatMap(r => r?.ritual?.moods || []), 4);
  const categoryCounts = topFrequencies(sorted.map(r => r?.ritual?.category || r?.fortune?.category), 4)
    .map(item => ({ ...item, percent: total ? Math.round((item.count / total) * 100) : 0 }));
  const templeCounts = topFrequencies(sorted.map(r => r?.ritual?.temple), 3);
  const resultNumbers = topFrequencies(sorted.map(r => r?.fortune?.num), 5);
  const luckyNumbers = topFrequencies(sorted.map(r => {
    const fromRitual = r?.ritual?.luckyNumber;
    const luck = Array.isArray(r?.fortune?.luck) ? r.fortune.luck[0] : r?.fortune?.luck;
    return fromRitual || luck;
  }), 5);
  const sentimentScores = sorted.map(r => r?.sentiment?.score).map(finiteNumber).filter(value => value != null);
  const recentSentiment = average(recent.map(r => r?.sentiment?.score));
  const olderSentiment = average(older.map(r => r?.sentiment?.score));
  const sentimentDelta = recentSentiment != null && olderSentiment != null
    ? recentSentiment - olderSentiment
    : null;
  const averageSentiment = average(sentimentScores);
  const lowSentimentCount = sentimentScores.filter(score => score < 5).length;
  const latest = sorted[0] || null;

  return {
    total,
    latest,
    categoryCounts,
    templeCounts,
    moodCounts,
    resultNumbers,
    luckyNumbers,
    averageSentiment,
    recentSentiment,
    sentimentDelta,
    lowSentimentCount,
    latestAdvice: latest?.fortune?.advice || latest?.fortune?.question || latest?.fortune?.text || '',
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

export { mostFrequent, topFrequencies, parseReadingDate, readingTime, calcCurrentStreak, calcWeeklyInsights, calcResultInsights, formatRelativeDay };
