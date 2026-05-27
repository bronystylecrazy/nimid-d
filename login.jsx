// login.jsx — First screen. Two modes:
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

// simple string-hash so the reading stays the same for a given user
function __palmHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function analyzePalm(user) {
  const seed = __palmHash((user?.name || '') + '|' + (user?.dob || ''));
  return PALM_LINES.map((L, i) => {
    const r = L.readings[(seed + i * 7) % L.readings.length];
    return { ...L, reading: r };
  });
}
window.analyzePalm = analyzePalm;

function LoginScreen({ onContinue, initial = {} }) {
  // Detect returning user: either via passed prop (for the design canvas
  // demo artboard) or via localStorage.
  const [savedUser, setSavedUser] = React.useState(() => {
    if (initial.user) return initial.user;
    try {
      const raw = localStorage.getItem(LS_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  // "forget me" clears localStorage AND drops back to registration
  const forgetUser = () => {
    try { localStorage.removeItem(LS_USER_KEY); } catch {}
    setSavedUser(null);
  };

  if (savedUser && !initial.forceRegister) {
    return <WelcomeBack user={savedUser} onContinue={onContinue} onForget={forgetUser}/>;
  }
  return <RegisterForm initial={initial} onContinue={(u) => {
    try { localStorage.setItem(LS_USER_KEY, JSON.stringify(u)); } catch {}
    setSavedUser(u);
    onContinue(u);
  }}/>;
}
window.LoginScreen = LoginScreen;

// ────────────────────────────
// RegisterForm — first-visit registration (the original LoginScreen body)
// ────────────────────────────
function RegisterForm({ onContinue, initial = {} }) {
  const [name, setName] = React.useState(initial.name || '');
  const [dob, setDob] = React.useState(initial.dob || '');
  const [palm, setPalm] = React.useState(initial.palm || null); // dataURL
  const ready = name.trim().length >= 2 && dob && palm;

  return (
    <div className="proto" style={{ overflow: 'auto' }}>
      <Sparkles count={14}/>
      <Blob d={Blobs.one}  fill="rgba(242,181,160,.20)" style={{ width: 520, height: 520, top: -160, left: -160, filter: 'blur(20px)' }}/>
      <Blob d={Blobs.two}  fill="rgba(232,200,224,.22)" style={{ width: 600, height: 600, bottom: -220, right: -180, filter: 'blur(24px)' }}/>
      <Blob d={Blobs.three} fill="rgba(184,216,200,.16)" style={{ width: 460, height: 460, top: '20%', left: '55%', filter: 'blur(30px)' }}/>

      {/* Header */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
        padding: '24px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo/>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em' }}>เซียมซี</span>
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
              บอกชื่อ วันเกิด และฝ่ามือของคุณ เพื่อให้พิธีเซียมซีปรับให้สอดคล้องกับช่วงชีวิตของคุณมากขึ้น
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

            {/* Birthday */}
            <Field label="วันเกิดของคุณ" hint="ใช้สำหรับคำนวณวันที่และฤดูที่เหมาะกับคุณ">
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)}
                style={{ ...inputStyle, fontFamily: 'inherit' }}/>
            </Field>

            {/* Palm capture */}
            <Field label="ลายมือของคุณ" hint="วางฝ่ามือไว้ในกรอบ แล้วกดถ่ายภาพ">
              <PalmCapture value={palm} onChange={setPalm}/>
            </Field>

            <button className="btn btn-primary" disabled={!ready}
              onClick={() => onContinue({ name: name.trim(), dob, palm })}
              style={{ width: '100%', marginTop: 22, padding: '16px 22px',
                borderRadius: 18, justifyContent: 'space-between' }}>
              <span>เข้าสู่พิธีเสี่ยงเซียมซี</span>
              <Icon.arrowR size={18}/>
            </button>

            {!ready && (
              <p style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 12, textAlign: 'center' }}>
                กรุณากรอกข้อมูลให้ครบเพื่อเริ่มต้น
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

// ─────────────────────────────────────────────
// PalmCapture — live camera preview with palm guide overlay + capture
// ─────────────────────────────────────────────
function PalmCapture({ value, onChange }) {
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const [status, setStatus] = React.useState('idle'); // idle | starting | live | error | captured
  const [error, setError] = React.useState('');

  const start = React.useCallback(async () => {
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
  }, []);

  const stop = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(tr => tr.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  React.useEffect(() => () => stop(), [stop]);

  const capture = () => {
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
    onChange(null);
    start();
  };

  // upload fallback
  const onFile = (e) => {
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
            <button type="button" onClick={start} className="btn btn-primary"
              style={{ padding: '10px 18px', fontSize: 13 }}>
              {status === 'starting' ? 'กำลังเปิดกล้อง...' : 'เปิดกล้อง'}
            </button>
            <label className="btn btn-secondary" style={{ padding: '10px 16px', fontSize: 13, cursor: 'pointer' }}>
              อัปโหลดภาพ
              <input type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }}/>
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
          <button type="button" onClick={retake}
            style={{
              position: 'absolute', bottom: 10, right: 10,
              padding: '8px 14px', borderRadius: 999,
              background: 'var(--text-main)', color: 'var(--text-on-dark)',
              border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontFamily: 'inherit',
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
      <Blob d={Blobs.one}  fill="rgba(242,181,160,.22)" style={{ width: 520, height: 520, top: -160, left: -160, filter: 'blur(20px)' }}/>
      <Blob d={Blobs.two}  fill="rgba(232,200,224,.22)" style={{ width: 600, height: 600, bottom: -220, right: -180, filter: 'blur(24px)' }}/>
      <Blob d={Blobs.three} fill="rgba(184,216,200,.16)" style={{ width: 460, height: 460, top: '20%', left: '55%', filter: 'blur(30px)' }}/>

      {/* Header */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
        padding: '24px 48px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Logo/>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, letterSpacing: '-0.01em' }}>เซียมซี</span>
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
                  <Icon.sparkle size={10}/> วิเคราะห์แล้ว
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
                เราได้อ่านลายมือของคุณจากครั้งก่อนแล้ว ทั้ง ๓ เส้นด้านล่างคือสิ่งที่ลายมือของคุณกำลังบอกในช่วงเวลานี้
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
