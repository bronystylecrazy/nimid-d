// setup.jsx — Pre-Ritual Setup screen
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
