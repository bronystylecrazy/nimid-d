// meditation.jsx — Phase 2: 1-minute mindful activity
// Either breathing animation (meditate) or walking path (walk).

function MeditationScreen({ state, onContinue, onBack }) {
  const total = 60;
  const [t, setT] = React.useState(0);
  const [running, setRunning] = React.useState(true);
  const ref = React.useRef(0);

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

  // breath cycle: 4s in, 4s hold, 4s out, 4s hold
  const breathPhase = (() => {
    const cycle = t % 16;
    if (cycle < 4)  return { label: 'หายใจเข้า',  scale: 0.55 + (cycle / 4) * 0.45, opacity: 0.95 };
    if (cycle < 8)  return { label: 'กลั้นไว้',   scale: 1.0,  opacity: 1 };
    if (cycle < 12) return { label: 'หายใจออก',  scale: 1.0 - ((cycle - 8) / 4) * 0.45, opacity: 0.75 };
    return            { label: 'พักหายใจ',   scale: 0.55, opacity: 0.6 };
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
              <button className="btn btn-primary" onClick={onContinue} disabled={!done}
                style={{ marginLeft: 'auto', padding: '14px 28px' }}>
                ไปยังจุดเสี่ยงเซียมซี <Icon.arrowR size={16}/>
              </button>
            </div>

            {!done && (
              <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 14, lineHeight: 1.5 }}>
                เมื่อครบ ๑ นาที ปุ่มเข้าสู่พิธีจะปรากฏ คุณสามารถใช้เวลามากกว่านี้ได้ตามใจชอบ
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
  return (
    <div style={{ position: 'relative', width: 460, height: 460 }}>
      {/* outermost halo */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(242,181,160,.25), transparent 70%)',
        transform: `scale(${0.9 + phase.scale * 0.2})`,
        transition: 'transform 1s ease-in-out',
      }}/>
      {/* breathing ring stack */}
      {[1, 0.85, 0.7, 0.55, 0.4].map((s, i) => (
        <div key={i} style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          border: `${i === 0 ? 2 : 1.2}px solid var(--c-peach-deep)`,
          opacity: phase.opacity * (0.9 - i * 0.15),
          transform: `scale(${phase.scale * s})`,
          transition: 'transform 1.2s cubic-bezier(.4,0,.4,1), opacity .8s ease-in-out',
        }}/>
      ))}
      {/* lotus center */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 140, height: 140, marginTop: -70, marginLeft: -70,
        borderRadius: '50%',
        background: 'radial-gradient(circle, var(--c-peach), var(--c-lavender))',
        boxShadow: '0 0 60px rgba(242,181,160,.5)',
        transform: `scale(${0.85 + phase.scale * 0.15})`,
        transition: 'transform 1.2s ease-in-out',
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
