// app.jsx — wires everything into a Design Canvas with Tweaks.

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
    return <ShakeScreen state={ritual}
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

function App() {
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

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
