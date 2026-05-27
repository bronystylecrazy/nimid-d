// result.jsx — Phase 4: Fortune stick result
// Paper-slip oracle card with prediction, advice, reflection question, lucky #.

function ResultScreen({ state, onRestart, onBack, onShop, onDonate }) {
  const fortune = FORTUNES[state.category] || FORTUNES.work;
  const cat = CATEGORIES.find(c => c.id === state.category);
  const t = TEMPLES.find(x => x.id === state.temple);
  const IconC = Icon[cat.icon];

  // Post-ritual mood input (kept local to result screen)
  const [postFeeling, setPostFeeling] = React.useState('');
  const [postMoods, setPostMoods]     = React.useState([]);
  const toggleMood = (m) => setPostMoods(s => s.includes(m) ? s.filter(x => x !== m) : [...s, m]);

  // Sentiment scores derived from selected mood chips (mock model)
  const preScore  = scoreMoods(state.moods || [], PRE_MOOD_SCORES);
  const postScore = scoreMoods(postMoods, POST_MOOD_SCORES);
  const delta     = postScore - preScore;

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

            {/* PAPER SLIP */}
            <div style={{ position: 'relative', animation: 'float-up .6s cubic-bezier(.3,.7,.4,1.4) both' }}>
              <FortuneSlip fortune={fortune} cat={cat} temple={t}/>
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

              {/* Advice card */}
              <div className="card card-soft" style={{ padding: 26 }}>
                <div className="eyebrow" style={{ marginBottom: 10 }}>คำแนะนำ</div>
                <p style={{ fontSize: 17, lineHeight: 1.55, fontFamily: 'var(--font-display)', fontWeight: 400, textWrap: 'pretty' }}>
                  “{fortune.advice}”
                </p>
              </div>

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
                <button className="btn btn-primary" style={{ padding: '14px 22px', flex: '1 1 auto' }}>
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

          {/* ── Post-ritual reflection ───────────────────── */}
          <div style={{ marginTop: 44 }}>
            <div style={{
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
              marginBottom: 18, gap: 16, paddingTop: 28,
              borderTop: '1px dashed var(--border-soft)',
            }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>หลังพิธี · Reflection</div>
                <h2 style={{ fontSize: 28, lineHeight: 1.2 }}>ตอนนี้ใจของคุณเป็นอย่างไร?</h2>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 460, lineHeight: 1.55 }}>
                ข้อมูลจะถูกวิเคราะห์ร่วมกับข้อมูลก่อนพิธี เพื่อประเมินการเปลี่ยนแปลงของอารมณ์ ช่วยปรับประสบการณ์ให้นุ่มนวลขึ้นในอนาคต
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Post feeling input */}
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
                    <div className="eyebrow" style={{ marginBottom: 2 }}>บันทึกความรู้สึก</div>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>หลังจากเสี่ยงเซียมซีแล้ว</div>
                  </div>
                </div>
                <textarea
                  value={postFeeling}
                  onChange={(e) => setPostFeeling(e.target.value)}
                  placeholder="เช่น รู้สึกโล่งใจขึ้น ได้มุมมองใหม่ หรือยังมีเรื่องที่อยากคิดต่อ..."
                  style={{
                    width: '100%', minHeight: 100,
                    border: '1px solid var(--border-soft)',
                    borderRadius: 14, padding: '12px 14px',
                    outline: 'none', resize: 'vertical',
                    background: 'var(--bg-main)', fontFamily: 'inherit',
                    fontSize: 14, lineHeight: 1.6, color: 'var(--text-main)',
                  }}/>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                  {POST_MOODS.map(m => (
                    <span key={m}
                      className={`chip ${postMoods.includes(m) ? 'active' : ''}`}
                      onClick={() => toggleMood(m)}>
                      {postMoods.includes(m) && <Icon.check size={12} sw={2.6}/>} {m}
                    </span>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 14, lineHeight: 1.5 }}>
                  ข้อมูลนี้จะถูกบันทึกเพื่อวิเคราะห์และปรับประสบการณ์ผู้ใช้ในอนาคต
                </p>
              </div>

              {/* Sentiment evaluation metric */}
              <SentimentEvaluation
                preMoods={state.moods || []}
                postMoods={postMoods}
                preScore={preScore}
                postScore={postScore}
                delta={delta}/>
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
          เซียมซี<br/>ศักดิ์<br/>สิทธิ์
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
