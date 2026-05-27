// donation.jsx — Online donation page
// Shows an illustrated wooden alms box (ตู้บริจาค) with a Thai QR Payment
// card pasted on the front. User picks a donation purpose + amount.

const DONATION_PURPOSES = [
{ id: 'temple', name: 'บูรณะวัด', desc: 'ร่วมบำรุงรักษาศาสนสถาน' },
{ id: 'monks', name: 'ถวายภัตตาหารพระสงฆ์', desc: 'อาหารถวายพระในแต่ละวัน' },
{ id: 'edu', name: 'การศึกษาเยาวชน', desc: 'ทุนการศึกษาสำหรับเด็กในชุมชน' },
{ id: 'medi', name: 'ค่ารักษาพยาบาล', desc: 'ผู้ป่วยยากไร้ในชุมชนวัด' }];


const DONATION_AMOUNTS = [20, 50, 100, 200, 500, 1000];

function DonationScreen({ state, onBack }) {
  const t = TEMPLES.find((x) => x.id === state.temple) || TEMPLES[0];

  return (
    <AppShell step={3}>
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '92px 48px 48px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, gap: 24 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 12 }}>ทำบุญออนไลน์ · Online Donation</div>
              <h1 style={{ fontSize: 36, lineHeight: 1.2, marginBottom: 8, textWrap: 'pretty' }}>
                ร่วมทำบุญกับ {t.name}
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                สแกน QR Code บนตู้บริจาคเพื่อร่วมทำบุญตามจิตศรัทธา
              </p>
            </div>
            <button className="btn btn-tertiary" onClick={onBack}>
              <Icon.arrowL size={16} /> กลับไปยังผลทำนาย
            </button>
          </div>

          {/* Centered donation box */}
          <DonationBox temple={t} amount={0} purpose={{ id: 'temple', name: 'ร่วมทำบุญ' }} />

          {/* Mock disclaimer */}
          <div style={{
            marginTop: 18, padding: 16, borderRadius: 18,
            background: 'var(--surface-soft)', fontSize: 12, color: 'var(--text-muted)',
            lineHeight: 1.55, display: 'flex', gap: 10, alignItems: 'flex-start'
          }}>
            <Icon.bell size={16} color="var(--c-coral)" />
            <div>
              <b style={{ color: 'var(--text-main)' }}>QR Code นี้เป็นข้อมูลจำลองสำหรับต้นแบบเท่านั้น</b><br />
              ในการใช้งานจริง ระบบจะสร้าง QR PromptPay พร้อมข้อมูลของวัดให้อัตโนมัติ
            </div>
          </div>
        </div>
      </div>
    </AppShell>);

}
window.DonationScreen = DonationScreen;

// ─────────────────────────────────────────────
// DonationBox — illustration of a METAL alms box with QR card on the front
// ─────────────────────────────────────────────
function DonationBox({ temple, amount, purpose }) {
  return (
    <div style={{
      position: 'relative',
      borderRadius: 32, padding: 28,
      background: `linear-gradient(165deg, ${temple.swatch[1]}, ${temple.swatch[2]})`,
      overflow: 'hidden',
      minHeight: 540
    }}>
      <Sparkles count={14} color="#FBF2EA" />

      {/* Temple ornament header */}
      <div style={{ position: 'absolute', top: 14, left: 0, right: 0, height: 30, opacity: 0.65 }}>
        <TempleOrnament temple={temple.id} />
      </div>

      {/* SVG isometric donation box — METAL finish */}
      <div style={{
        position: 'absolute', top: 60, left: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <svg viewBox="0 0 420 480" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
        style={{ filter: 'drop-shadow(0 20px 30px rgba(61,46,42,.30))', width: "720px" }}>
          <defs>
            {/* Brushed-steel gradient for the front face */}
            <linearGradient id="metal-front" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#D8DAD8" />
              <stop offset="0.4" stopColor="#9FA4A6" />
              <stop offset="0.7" stopColor="#8A8F92" />
              <stop offset="1" stopColor="#5E6366" />
            </linearGradient>
            {/* Sheen highlight across the middle */}
            <linearGradient id="metal-sheen" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity=".22" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            {/* Top of the box (lid surface) — slightly brighter */}
            <linearGradient id="metal-top" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#E5E7E5" />
              <stop offset="1" stopColor="#A8ACAE" />
            </linearGradient>
            {/* Brass trim (warm metallic gold) */}
            <linearGradient id="brass-trim" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#F4D58A" />
              <stop offset="0.5" stopColor="#D0A14A" />
              <stop offset="1" stopColor="#8A6A2E" />
            </linearGradient>
          </defs>

          {/* Ground shadow */}
          <ellipse cx="210" cy="450" rx="150" ry="14" fill="rgba(0,0,0,.20)" />

          {/* Brass pediment / temple-style top */}
          <g transform="translate(60, 50)">
            <path d="M-10 60 L150 -10 L310 60 L290 70 L150 10 L10 70 Z" fill="url(#brass-trim)" />
            <path d="M150 -10 L150 30 M120 22 L180 22" stroke="#5C381F" strokeWidth="3" strokeLinecap="round" />
            <circle cx="150" cy="-10" r="6" fill="#5C381F" />
            {/* Lotus crown */}
            <g transform="translate(150 28)">
              {[0, 60, 120, 180, 240, 300].map((a) =>
              <ellipse key={a} cx="0" cy="-6" rx="3" ry="8" fill="#F2D08C"
              transform={`rotate(${a})`} />
              )}
              <circle r="3" fill="#5C381F" />
            </g>
          </g>

          {/* Box body — front face (metal) */}
          <rect x="60" y="120" width="300" height="280" rx="6" fill="url(#metal-front)" />
          {/* Vertical sheen */}
          <rect x="60" y="120" width="300" height="280" rx="6" fill="url(#metal-sheen)" />

          {/* Brushed-metal horizontal grain */}
          <g opacity=".3" stroke="#5C6366" strokeWidth="0.5" fill="none">
            {Array.from({ length: 40 }).map((_, i) =>
            <line key={i} x1="62" y1={125 + i * 7} x2="358" y2={125 + i * 7} />
            )}
          </g>

          {/* Top-edge brass trim band */}
          <rect x="56" y="116" width="308" height="14" rx="3" fill="url(#brass-trim)" />
          {/* Bottom-edge brass trim band */}
          <rect x="56" y="392" width="308" height="14" rx="3" fill="url(#brass-trim)" />
          {/* Vertical side highlights / shadows */}
          <rect x="60" y="130" width="8" height="262" fill="rgba(0,0,0,.18)" />
          <rect x="352" y="130" width="8" height="262" fill="rgba(255,255,255,.16)" />

          {/* Four corner rivets (brass) */}
          {[[78, 138], [342, 138], [78, 380], [342, 380]].map(([x, y], i) =>
          <g key={i}>
              <circle cx={x} cy={y} r="5" fill="url(#brass-trim)" />
              <circle cx={x - 1} cy={y - 1} r="1.6" fill="#F8E2A6" />
            </g>
          )}

          {/* Coin slot — metallic top with darker recessed slot */}
          <g transform="translate(60, 100)">
            <rect width="300" height="22" rx="4" fill="url(#metal-top)" />
            <rect x="110" y="6" width="80" height="8" rx="2" fill="#1A1612" stroke="#3A3E40" strokeWidth="1" />
            <rect x="112" y="7" width="76" height="2" fill="#000" opacity=".6" />
          </g>

          {/* Engraved inscription */}
          <text x="210" y="160" textAnchor="middle"
          fontFamily="var(--font-display)" fontWeight="600" fontSize="15"
          fill="#3D2E2A" letterSpacing="6" opacity=".75">
            ทำบุญ
          </text>
          <text x="210" y="161" textAnchor="middle"
          fontFamily="var(--font-display)" fontWeight="600" fontSize="15"
          fill="#fff" letterSpacing="6" opacity=".45">
            ทำบุญ
          </text>

          {/* Tape strips holding the QR card */}
          <rect x="108" y="194" width="32" height="10" rx="1" fill="#F4EAD8" opacity=".85" transform="rotate(-3 124 199)" />
          <rect x="280" y="194" width="32" height="10" rx="1" fill="#F4EAD8" opacity=".85" transform="rotate(2 296 199)" />

          {/* QR Card — pasted on the front of the box */}
          <foreignObject x="100" y="200" width="220" height="200">
            <div style={{
              width: 220, height: '100%',
              background: '#FFFFFF', borderRadius: 8,
              overflow: 'hidden', boxShadow: '0 8px 22px rgba(0,0,0,.45), 0 0 0 2px rgba(255,255,255,.6)',
              fontFamily: 'var(--font-body)',
              transform: 'rotate(-1.4deg)'
            }}>
              <ThaiQRCard amount={amount} purpose={purpose} temple={temple} />
            </div>
          </foreignObject>
        </svg>
      </div>
    </div>);

}

// ─────────────────────────────────────────────
// ThaiQRCard — replica of a typical Thai QR Payment / PromptPay card
// (header band, QR, account info, K+ footer). Mock data only.
// ─────────────────────────────────────────────
function ThaiQRCard({ amount, purpose, temple }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 9 }}>
      {/* Header band — teal */}
      <div style={{
        background: '#1E5F70', color: '#fff',
        padding: '8px 10px',
        display: 'flex', alignItems: 'center', gap: 6
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 4,
          background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <svg viewBox="0 0 22 22" width="14" height="14">
            <path d="M3 18 L3 4 L11 8 L19 4 L19 18 L11 14 Z" fill="#1E5F70" />
            <path d="M3 18 L11 14 L19 18" fill="#5BA88F" />
          </svg>
        </div>
        <div style={{ flex: 1, lineHeight: 1.05 }}>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.04em' }}>THAI QR</div>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.04em' }}>PAYMENT</div>
        </div>
      </div>

      <div style={{ padding: '8px 10px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', gap: 4 }}>
        {/* PromptPay logo box */}
        <div style={{
          padding: '2px 6px', border: '1px solid #1E5F70', borderRadius: 3,
          fontSize: 7, fontWeight: 700, color: '#1E5F70', position: 'relative'
        }}>
          <span style={{
            position: 'absolute', top: -7, right: 2, fontSize: 6, color: '#1E5F70'
          }}>พร้อมเพย์</span>
          Prompt<span style={{ background: '#1E5F70', color: '#fff', padding: '0 2px' }}>Pay</span>
        </div>

        {/* Small QR */}
        <div style={{ marginTop: 2 }}>
          <CompactQR seed={`donate-${purpose.id}-${amount}-${temple.id}`} size={92} />
        </div>

        {/* Account info */}
        <div style={{
          color: '#1E5F70', fontWeight: 700, fontSize: 7.5, marginTop: 4, textAlign: 'center',
          lineHeight: 1.3
        }}>
          สแกน QR เพื่อโอนเข้าบัญชี
        </div>
        <div style={{ fontSize: 7, color: '#3D2E2A', textAlign: 'center', lineHeight: 1.3 }}>
          ชื่อ: วัด{temple.name === 'วัดไทย' ? 'พุทธสามัคคี' : temple.name === 'วัดจีน' ? 'มังกรบุปผา' : 'สากุระประดิษฐ์'}<br />
          บัญชี: xxx-x-x{(1000 + Math.abs(temple.name.length) * 137 + amount) % 10000}-x
        </div>
        <div style={{ fontSize: 6.5, color: '#8A7570' }}>
          เลขที่อ้างอิง: {String(Date.now() % 100000000000).padStart(11, '0')}
        </div>
      </div>

      {/* K+ footer */}
      <div style={{
        background: '#F5F5F5', padding: '4px 8px',
        borderTop: '2px solid #5BA88F',
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 6.5, color: '#3D2E2A'
      }}>
        <span style={{
          background: '#3D2E2A', color: '#fff', padding: '1px 4px',
          fontSize: 7, fontWeight: 700, borderRadius: 1
        }}>K+</span>
        <span style={{ fontWeight: 600, color: '#3D2E2A' }}>Accepts all banks</span>
        <span style={{ color: '#5BA88F' }}>| รับเงินได้จากทุกธนาคาร</span>
      </div>
    </div>);

}

// Compact QR pattern (smaller than shop's MockQR, for the card)
function CompactQR({ seed, size = 100 }) {
  const grid = 21;
  const cells = React.useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i) | 0;
    const out = [];
    for (let i = 0; i < grid * grid; i++) {
      h = h * 1103515245 + 12345 | 0;
      out.push((h >> 16 & 1) === 1);
    }
    return out;
  }, [seed]);
  const cs = size / grid;
  const finders = [[0, 0], [grid - 7, 0], [0, grid - 7]];
  const inFinder = (x, y) => finders.some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);

  return (
    <svg width={size} height={size}>
      {cells.map((on, i) => {
        if (!on) return null;
        const x = i % grid,y = i / grid | 0;
        if (inFinder(x, y)) return null;
        return <rect key={i} x={x * cs} y={y * cs} width={cs} height={cs} fill="#1a1612" />;
      })}
      {finders.map(([fx, fy], i) =>
      <g key={i} transform={`translate(${fx * cs} ${fy * cs})`}>
          <rect width={cs * 7} height={cs * 7} fill="#1a1612" />
          <rect x={cs} y={cs} width={cs * 5} height={cs * 5} fill="#fff" />
          <rect x={cs * 2} y={cs * 2} width={cs * 3} height={cs * 3} fill="#1a1612" />
        </g>
      )}
      {/* center logo */}
      <g transform={`translate(${size / 2 - cs * 2.2} ${size / 2 - cs * 2.2})`}>
        <rect width={cs * 4.4} height={cs * 4.4} fill="#fff" />
        <g transform={`translate(${cs * 2.2} ${cs * 2.2})`}>
          <path d="M-4 4 L-4 -3 L0 -1 L4 -3 L4 4 L0 2 Z" fill="#1E5F70" transform={`scale(${cs * 0.4})`} />
        </g>
      </g>
    </svg>);

}

// ─────────────────────────────────────────────
function DonationSuccess({ amount, purpose, temple, onClose, onBack }) {
  return (
    <div className="card" style={{ padding: 36, textAlign: 'center' }}>
      <div style={{
        width: 88, height: 88, borderRadius: '50%',
        background: 'linear-gradient(160deg, var(--c-peach), var(--c-lavender))',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 22px',
        position: 'relative'
      }}>
        <Icon.check size={44} sw={2.4} color="#fff" />
        <Sparkles count={8} color="var(--c-gold)" style={{ inset: -10 }} />
      </div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>ขอบคุณที่ร่วมทำบุญ</div>
      <h2 style={{ fontSize: 30, lineHeight: 1.2, marginBottom: 12 }}>
        บุญของท่านได้ถูกส่งมอบแล้ว
      </h2>
      <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.65, marginBottom: 24, maxWidth: 420, marginInline: 'auto' }}>
        ขอบคุณที่ร่วมทำบุญ <b>"{purpose.name}"</b> จำนวน <b>฿{amount.toLocaleString()}</b> กับ{temple.name}
        ขอให้บุญที่ท่านทำในวันนี้ ส่งผลให้ท่านมีความสุขกายสุขใจตลอดไป
      </p>

      <div style={{
        background: 'var(--surface-soft)', borderRadius: 18, padding: 20,
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24
      }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>วัด</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{temple.name}</div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>หมายเลขใบอนุโมทนา</div>
          <div style={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
            #{String(Date.now() % 100000).padStart(5, '0')}
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>วันที่</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>
            {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={onClose} style={{ padding: '14px 22px' }}>
          ทำบุญอีกครั้ง
        </button>
        <button className="btn btn-secondary" onClick={onBack} style={{ padding: '14px 22px' }}>
          กลับไปยังผลทำนาย
        </button>
      </div>
    </div>);

}