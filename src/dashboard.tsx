// @ts-nocheck
import React from 'react';
import { DashboardActivity, DashboardBar, DashboardMetric, DashboardStartCard } from './dashboard-components';
import { calcCurrentStreak, calcWeeklyInsights, mostFrequent } from './dashboard-utils';

export default function DashboardScreen({ ritual, setRitual, readings, go, deps }) {
  const { CATEGORIES, TEMPLES, BOXES, FORTUNES, Icon, Sparkles, makeReadingRecord } = deps;
  const sorted = React.useMemo(() => [...readings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [readings]);
  const latest = sorted[0] || null;
  const total = sorted.length;
  const favoriteCategory = mostFrequent(sorted.map(r => r?.ritual?.category || r?.fortune?.category).filter(Boolean)) || ritual.category || 'work';
  const favoriteCatMeta = CATEGORIES.find(c => c.id === favoriteCategory) || CATEGORIES.find(c => c.id === 'work');
  const luckyTemple = mostFrequent(sorted.map(r => r?.ritual?.temple).filter(Boolean)) || ritual.temple || 'thai';
  const luckyTempleMeta = TEMPLES.find(t => t.id === luckyTemple) || TEMPLES[0];
  const streak = calcCurrentStreak(sorted);
  const weekly = calcWeeklyInsights(sorted);
  const displayRecord = latest || makeReadingRecord(ritual);
  const displayCat = CATEGORIES.find(c => c.id === (displayRecord.ritual?.category || displayRecord.fortune?.category)) || CATEGORIES[2];
  const displayTemple = TEMPLES.find(t => t.id === displayRecord.ritual?.temple) || TEMPLES[0];
  const displayBox = BOXES.find(b => b.id === displayRecord.ritual?.box) || BOXES[0];
  const DisplayIcon = Icon[displayCat.icon] || Icon.sparkle;

  const startReading = (category) => {
    setRitual((r) => ({
      ...r,
      category: category || r.category || 'work',
      activity: r.activity || 'meditate',
      temple: r.temple || 'thai',
      box: r.box || 'gold',
      music: r.music || 'bell',
    }));
    go('/setup');
  };

  const openLatestResult = () => {
    if (latest?.ritual) {
      setRitual((r) => ({ ...r, ...latest.ritual, user: latest.user || r.user }));
    }
    go('/result');
  };

  return (
    <div className="proto" style={{ minHeight: '100vh', height: 'auto', overflowY: 'auto' }}>
      <Sparkles count={12}/>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '92px 28px 44px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, marginBottom: 24 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Personal Dashboard</div>
            <h1 style={{ fontSize: 40, lineHeight: 1.12 }}>ภาพรวมพิธีเซียมซีของคุณ</h1>
          </div>
          <button className="btn btn-primary" onClick={() => startReading()} style={{ padding: '13px 20px' }}>
            เริ่มอ่านใหม่ <Icon.arrowR size={16}/>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16, marginBottom: 20 }}>
          <DashboardMetric icon={Icon.sparkle} label="Total Readings" value={total} tone="var(--c-peach)"/>
          <DashboardMetric icon={Icon[favoriteCatMeta.icon]} label="Favorite Feature" value={favoriteCatMeta.name} tone="var(--c-lavender)"/>
          <DashboardMetric icon={Icon.lotus} label="Lucky Element" value={luckyTempleMeta.name} tone="var(--c-gold)"/>
          <DashboardMetric icon={Icon.bell} label="Current Streak" value={`${streak} วัน`} tone="var(--c-mint)"/>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 20, marginBottom: 20 }}>
          <section className="card" style={{ padding: 24, minHeight: 270 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <h2 style={{ fontSize: 20 }}>Latest Fortune Result</h2>
              <span className="badge">{latest ? displayCat.name : 'เริ่มต้น'}</span>
            </div>
            {latest ? (
              <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 22, alignItems: 'center' }}>
                <div style={{
                  width: 96, height: 96, borderRadius: 24,
                  background: `linear-gradient(145deg, ${displayTemple.swatch[1]}, ${displayTemple.swatch[0]})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-main)',
                }}>
                  <DisplayIcon size={42}/>
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: 26, lineHeight: 1.2, marginBottom: 8 }}>
                    {displayRecord.fortune.title}
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                    <span className="badge">เลข {displayRecord.fortune.num}</span>
                    <span className="badge">{displayTemple.name}</span>
                    <span className="badge">{displayBox.name}</span>
                  </div>
                  <div style={{
                    border: '1px solid var(--border-medium)', borderRadius: 16,
                    background: 'var(--surface-soft)', padding: '11px 14px',
                    fontFamily: 'var(--font-display)', fontSize: 15, lineHeight: 1.45,
                  }}>
                    "{displayRecord.fortune.advice}"
                  </div>
                </div>
                <button className="btn btn-secondary" onClick={openLatestResult}
                  style={{ gridColumn: '1 / -1', marginTop: 14, padding: '13px 18px', justifyContent: 'center' }}>
                  ดูผลเต็ม <Icon.arrowR size={16}/>
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 22, alignItems: 'center' }}>
                <div style={{
                  width: 96, height: 96, borderRadius: 24, background: 'var(--surface-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon.lotus size={42} color="var(--c-peach-deep)"/>
                </div>
                <div>
                  <h3 style={{ fontSize: 26, marginBottom: 8 }}>ยังไม่มีผลเซียมซีที่บันทึกไว้</h3>
                  <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    เริ่มพิธีครั้งแรก แล้วบันทึกผลเพื่อให้ dashboard นี้สะท้อนข้อมูลจริงของคุณ
                  </p>
                </div>
                <button className="btn btn-primary" onClick={() => startReading()}
                  style={{ gridColumn: '1 / -1', marginTop: 14, padding: '13px 18px' }}>
                  เริ่มอ่านเซียมซี <Icon.arrowR size={16}/>
                </button>
              </div>
            )}
          </section>

          <section className="card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 20, marginBottom: 18 }}>Start a Reading</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <DashboardStartCard icon={Icon.pencil} title="Name & Birth Reading" desc="ใช้ข้อมูลโปรไฟล์เดิม" onClick={() => startReading('work')}/>
              <DashboardStartCard icon={Icon.lotus} title="Palm Reading" desc="ต่อจากลายมือที่บันทึกไว้" onClick={() => startReading('health')}/>
              <DashboardStartCard icon={Icon.sparkle} title="Fortune Sticks" desc="เสี่ยงเซียมซีครั้งใหม่" onClick={() => startReading(favoriteCategory)}/>
            </div>
          </section>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 20 }}>
          <section className="card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 20, marginBottom: 18 }}>Weekly Insights</h2>
            <DashboardBar label="Clarity" value={weekly.clarity} color="var(--c-peach)"/>
            <DashboardBar label="Energy" value={weekly.energy} color="var(--c-lavender)"/>
            <DashboardBar label="Luck" value={weekly.luck} color="var(--c-gold)"/>
          </section>

          <section className="card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 20, marginBottom: 18 }}>Recent Activity</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sorted.slice(0, 4).map((r, i) => {
                const cat = CATEGORIES.find(c => c.id === (r.ritual?.category || r.fortune?.category)) || CATEGORIES[2];
                return <DashboardActivity key={r.id || i} record={r} cat={cat} index={i}/>;
              })}
              {!sorted.length && (
                <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  ยังไม่มีกิจกรรมล่าสุด หลังบันทึกผลเซียมซี รายการจะมาแสดงที่นี่
                </p>
              )}
            </div>
          </section>

          <section className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontSize: 20 }}>Fortune Sticks</h2>
              <button className="btn btn-tertiary" onClick={() => startReading()} style={{ padding: '8px 10px', fontSize: 12 }}>View All</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {CATEGORIES.map((c) => {
                const f = FORTUNES[c.id];
                const active = c.id === favoriteCategory;
                const unlocked = sorted.some(r => (r.ritual?.category || r.fortune?.category) === c.id);
                return (
                  <button key={c.id} onClick={() => startReading(c.id)} style={{
                    minHeight: 118, border: '1px solid var(--border-soft)',
                    borderRadius: 18, padding: 14, textAlign: 'left', cursor: 'pointer',
                    background: active ? 'var(--c-gold)' : unlocked ? 'var(--surface-soft)' : 'transparent',
                    color: 'var(--text-main)', boxShadow: active ? 'var(--shadow-soft)' : 'none',
                    borderStyle: unlocked || active ? 'solid' : 'dashed',
                  }}>
                    <span className="badge" style={{ marginBottom: 28 }}>{f.num}</span>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{c.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                      {active ? 'current' : unlocked ? 'unlocked' : 'locked'}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
