// one-page.jsx — Single-page stacked view of all 4 phases.
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

const OP_DEFAULTS = /*EDITMODE-BEGIN*/{
  "radius": 28,
  "season": "spring",
  "detail": "med",
  "musicVol": 50
}/*EDITMODE-END*/;

const OP_DEFAULT_RITUAL = {
  user: null,
  activity: 'meditate', feeling: '', moods: [], temple: 'thai',
  box: 'gold', category: 'work', music: 'bell',
};

const OP_SEASON_PALETTES = {
  spring: ['#F2B5A0', '#E8C8E0', '#B8D8C8'],
  summer: ['#F5C26B', '#D8C8A0', '#C4D49C'],
  autumn: ['#E89976', '#C7A89A', '#C8C49C'],
  winter: ['#C9B8E0', '#D5C4E3', '#B8CFD8'],
};

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
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500 }}>เซียมซี</div>
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
          <ShakeScreen state={ritualFor(OP_PHASES[3])}
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

ReactDOM.createRoot(document.getElementById('root')).render(<OnePageApp/>);
