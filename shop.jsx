// shop.jsx — Lucky Wallpaper Shop
// Browsable grid of mock mutelu wallpapers, filterable by category.
// Click → detail sheet with phone preview + buy CTA → mock QR success.

// Each wallpaper is a CSS+SVG composition — phone aspect ratio.
const WALLPAPERS = [
  {
    id: 'lotus-gold',  name: 'ดอกบัวสีทอง',      cat: 'love',
    desc: 'บัวบานเหนือผิวน้ำ สื่อถึงใจที่บริสุทธิ์และอ่อนโยน',
    price: 39, palette: ['#F2C68A', '#E59180', '#C9853F'],
    art: 'lotus',
  },
  {
    id: 'crescent',     name: 'พระจันทร์แห่งหวัง', cat: 'love',
    desc: 'จันทร์เสี้ยวเหนือเมฆ พกความหวังติดตัวทุกวัน',
    price: 39, palette: ['#E8C8E0', '#C9A4C4', '#9A7CAA'],
    art: 'moon',
  },
  {
    id: 'lanterns',     name: 'โคมแห่งโชคลาภ',     cat: 'money',
    desc: 'โคมแดงลอยกลางคืน พลังงานแห่งความรุ่งเรือง',
    price: 49, palette: ['#F2A296', '#D97A6C', '#B85A4D'],
    art: 'lanterns',
  },
  {
    id: 'coins',        name: 'เหรียญเงินไหลริน',  cat: 'money',
    desc: 'สายเหรียญทองค่อย ๆ ไหลรินเหมือนน้ำที่ไม่สิ้นสุด',
    price: 49, palette: ['#F5E1B0', '#E0B570', '#A68040'],
    art: 'coins',
  },
  {
    id: 'compass',      name: 'เข็มทิศและขุนเขา',  cat: 'work',
    desc: 'เข็มทิศเหนือทิวเขา ทุกการเดินทางมีจุดหมาย',
    price: 39, palette: ['#B8CFD8', '#7A99A8', '#3D5566'],
    art: 'compass',
  },
  {
    id: 'bamboo',       name: 'ไผ่ในสายลม',         cat: 'work',
    desc: 'ไผ่อ่อนแต่ไม่หัก คือพลังของผู้ปรับตัว',
    price: 39, palette: ['#C8D9B8', '#7BA890', '#4A7A60'],
    art: 'bamboo',
  },
  {
    id: 'wave',         name: 'คลื่นแห่งสมดุล',    cat: 'health',
    desc: 'คลื่นน้ำซ้อนชั้น เตือนใจให้หายใจเข้าออกอย่างนุ่มนวล',
    price: 39, palette: ['#C8DBE8', '#7A99B5', '#4A6F8F'],
    art: 'wave',
  },
  {
    id: 'leaf',         name: 'ใบไม้พลังธรรมชาติ',  cat: 'health',
    desc: 'ใบไม้สีเขียวสด คืนพลังให้กายและใจในทุกวันที่เหนื่อย',
    price: 39, palette: ['#D4E8C4', '#87B59E', '#4A7A60'],
    art: 'leaf',
  },
];

const SHOP_CATS = [
  { id: 'all',    name: 'ทั้งหมด' },
  { id: 'love',   name: 'ความรัก' },
  { id: 'money',  name: 'การเงิน' },
  { id: 'work',   name: 'การงาน' },
  { id: 'health', name: 'สุขภาพ' },
];

window.WALLPAPERS = WALLPAPERS;
window.SHOP_CATS  = SHOP_CATS;

// ─────────────────────────────────────────────
function ShopScreen({ state, onBack, suggestedCat }) {
  const [activeCat, setActiveCat] = React.useState(suggestedCat || 'all');
  const [selected, setSelected] = React.useState(null);
  const visible = WALLPAPERS.filter(w => activeCat === 'all' || w.cat === activeCat);

  return (
    <AppShell step={3}>
      <div style={{ position: 'absolute', inset: 0, paddingTop: 0, overflowY: 'auto', padding: '92px 48px 64px' }}>
        <div style={{ maxWidth: 1340, margin: '0 auto' }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, gap: 24 }}>
            <div style={{ maxWidth: 620 }}>
              <div className="eyebrow" style={{ marginBottom: 12 }}>ร้านของมงคล · Lucky Shop</div>
              <h1 style={{ fontSize: 44, lineHeight: 1.15, marginBottom: 12, textWrap: 'pretty' }}>
                วอลเปเปอร์เสริมพลังใจ<br/>
                <span style={{ color: 'var(--text-muted)', fontWeight: 300 }}>สำหรับมือถือของคุณ</span>
              </h1>
              <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                เลือกภาพพื้นหลังที่สื่อถึงสิ่งที่คุณกำลังตั้งจิต ภาพหนึ่งภาพอาจเปลี่ยนใจของคุณได้ในทุกครั้งที่หยิบโทรศัพท์
              </p>
            </div>
            <button className="btn btn-tertiary" onClick={onBack}>
              <Icon.arrowL size={16}/> กลับไปยังผลทำนาย
            </button>
          </div>

          {/* Category filter */}
          <div style={{
            display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase', marginRight: 6 }}>
              กรอง
            </span>
            {SHOP_CATS.map(c => (
              <span key={c.id}
                className={`chip ${activeCat === c.id ? 'active' : ''}`}
                onClick={() => setActiveCat(c.id)}>
                {c.name}
                {c.id !== 'all' && (
                  <span style={{
                    marginLeft: 4, opacity: .6, fontSize: 11,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {WALLPAPERS.filter(w => w.cat === c.id).length}
                  </span>
                )}
              </span>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
              พบ {visible.length} วอลเปเปอร์
            </span>
          </div>

          {/* Grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22,
          }}>
            {visible.map(w => (
              <WallpaperCard key={w.id} w={w} onClick={() => setSelected(w)}/>
            ))}
          </div>

          {/* Shop assurances */}
          <div style={{
            marginTop: 36, padding: 22, borderRadius: 22,
            background: 'var(--surface-soft)',
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22,
          }}>
            {[
              { i: Icon.sparkle, t: 'ดาวน์โหลดได้ทันที', s: 'ส่งไฟล์ความละเอียดสูงให้คุณภายในไม่กี่วินาที' },
              { i: Icon.lotus,   t: 'ออกแบบโดยศิลปินไทย', s: 'ทุกภาพถูกออกแบบให้สอดคล้องกับความเชื่อแบบไทย' },
              { i: Icon.bell,    t: 'รายได้สนับสนุนวัด',   s: 'ส่วนหนึ่งของรายได้ทำบุญถวายที่วัดในเครือข่าย' },
            ].map((r, i) => {
              const I = r.i;
              return (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 12,
                    background: 'var(--surface-card)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, boxShadow: 'var(--shadow-soft)',
                  }}>
                    <I size={18}/>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{r.t}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{r.s}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail sheet */}
      {selected && (
        <WallpaperDetail w={selected} onClose={() => setSelected(null)}/>
      )}
    </AppShell>
  );
}
window.ShopScreen = ShopScreen;

// ─────────────────────────────────────────────
function WallpaperCard({ w, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'var(--surface-card)',
      border: '1px solid var(--border-soft)',
      borderRadius: 'var(--radius-card)',
      padding: 14, textAlign: 'left', cursor: 'pointer',
      boxShadow: 'var(--shadow-soft)',
      transition: 'transform .18s cubic-bezier(.3,.7,.4,1.4), box-shadow .18s',
      fontFamily: 'inherit', color: 'inherit',
    }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 14px 30px rgba(61,46,42,.10)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--shadow-soft)'; }}>
      <PhonePreview w={w} height={300}/>
      <div style={{ padding: '14px 4px 2px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 500, marginBottom: 2 }}>{w.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            หมวด · {SHOP_CATS.find(c => c.id === w.cat)?.name}
          </div>
        </div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500,
          fontVariantNumeric: 'tabular-nums', color: 'var(--text-main)',
        }}>฿{w.price}</div>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────
function WallpaperDetail({ w, onClose }) {
  const [phase, setPhase] = React.useState('detail'); // detail | paying | done
  return (
    <div onClick={onClose}
      style={{
        position: 'absolute', inset: 0, zIndex: 30,
        background: 'rgba(24,20,16,.5)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 32, animation: 'float-up .25s ease both',
      }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-card)',
          borderRadius: 32, padding: 32, maxWidth: 880, width: '100%',
          boxShadow: '0 30px 80px rgba(0,0,0,.3)',
          display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 36,
          alignItems: 'center',
          position: 'relative',
        }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 18, right: 18,
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--bg-soft)', border: 'none', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', fontSize: 16,
        }}>×</button>

        <PhonePreview w={w} height={420} showStatusBar/>

        {phase === 'detail' && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              ของมงคล · {SHOP_CATS.find(c => c.id === w.cat)?.name}
            </div>
            <h2 style={{ fontSize: 32, lineHeight: 1.2, marginBottom: 12 }}>{w.name}</h2>
            <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 22 }}>
              {w.desc}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 22 }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: 4 }}>ราคา</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500 }}>
                  ฿{w.price}
                </div>
              </div>
              <div style={{ height: 40, width: 1, background: 'var(--border-soft)' }}/>
              <div>
                <div className="eyebrow" style={{ marginBottom: 4 }}>ความละเอียด</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>1170 × 2532 px</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>เหมาะกับมือถือทุกรุ่น</div>
              </div>
              <div style={{ height: 40, width: 1, background: 'var(--border-soft)' }}/>
              <div>
                <div className="eyebrow" style={{ marginBottom: 4 }}>ไฟล์</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>JPG · PNG</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ส่งทาง email</div>
              </div>
            </div>

            {/* palette swatches */}
            <div style={{ marginBottom: 26 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>โทนสี</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {w.palette.map((c, i) => (
                  <div key={i} style={{
                    flex: 1, height: 38, borderRadius: 12,
                    background: c, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.04)',
                  }}/>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setPhase('paying')} className="btn btn-primary"
                style={{ flex: 1, padding: '16px 22px', justifyContent: 'space-between', borderRadius: 18 }}>
                <span><Icon.coin size={16}/> ซื้อ wallpaper · ฿{w.price}</span>
                <Icon.arrowR size={16}/>
              </button>
              <button onClick={onClose} className="btn btn-secondary" style={{ padding: '14px 22px' }}>
                บันทึกไว้ดูทีหลัง
              </button>
            </div>

            <p style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 14, lineHeight: 1.55 }}>
              QR Code ในขั้นตอนต่อไปเป็นข้อมูลจำลองสำหรับต้นแบบเท่านั้น ไม่มีการตัดเงินจริง
            </p>
          </div>
        )}

        {phase === 'paying' && (
          <div style={{ textAlign: 'center', padding: '20px 10px' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>ชำระเงิน · Mock QR</div>
            <h2 style={{ fontSize: 26, lineHeight: 1.2, marginBottom: 16 }}>สแกนเพื่อชำระ ฿{w.price}</h2>
            <MockQR seed={w.id}/>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 16, marginBottom: 22 }}>
              {['PromptPay', 'TrueMoney', 'KBank'].map(b => (
                <span key={b} className="badge">{b}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setPhase('done')} className="btn btn-primary"
                style={{ padding: '14px 22px' }}>
                <Icon.check size={16}/> ชำระเรียบร้อย (สาธิต)
              </button>
              <button onClick={() => setPhase('detail')} className="btn btn-tertiary">
                <Icon.arrowL size={14}/> ย้อนกลับ
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--c-coral)', marginTop: 14 }}>
              QR Code นี้เป็นข้อมูลจำลองสำหรับต้นแบบเท่านั้น
            </p>
          </div>
        )}

        {phase === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 10px' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--c-mint)', margin: '0 auto 18px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-main)',
            }}>
              <Icon.check size={36} sw={2.2}/>
            </div>
            <h2 style={{ fontSize: 26, lineHeight: 1.2, marginBottom: 12 }}>ขอบคุณที่อุดหนุนร้านของเรา</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 22, maxWidth: 340, marginInline: 'auto' }}>
              เราได้ส่งไฟล์วอลเปเปอร์ <b>{w.name}</b> ไปยังอีเมลของคุณแล้ว ขอให้ใจคุณสงบและมีพลังในวันนี้
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={onClose} className="btn btn-primary" style={{ padding: '14px 22px' }}>
                กลับไปเลือกของเพิ่ม
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PhonePreview — phone-shape SVG with the wallpaper art inside
// ─────────────────────────────────────────────
function PhonePreview({ w, height = 300, showStatusBar = false }) {
  const ar = 9 / 19.5;
  const width = height * ar;
  return (
    <div style={{
      width, height, borderRadius: height * 0.07,
      background: '#1a1612', padding: height * 0.018,
      position: 'relative', flexShrink: 0,
      boxShadow: '0 18px 40px rgba(61,46,42,.18), 0 0 0 1px rgba(0,0,0,.4)',
    }}>
      <div style={{
        width: '100%', height: '100%',
        borderRadius: height * 0.06, overflow: 'hidden',
        background: `linear-gradient(180deg, ${w.palette[0]}, ${w.palette[2] || w.palette[1]})`,
        position: 'relative',
      }}>
        <WallpaperArt id={w.art} palette={w.palette} name={w.name}/>
        {showStatusBar && (
          <>
            <div style={{
              position: 'absolute', top: 8, left: 0, right: 0,
              display: 'flex', justifyContent: 'space-between', padding: '0 16px',
              color: '#fff', fontSize: 11, fontWeight: 500, opacity: .9,
            }}>
              <span>9:41</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: 1, background: '#fff' }}/>
                <span style={{ width: 12, height: 6, borderRadius: 1, background: '#fff' }}/>
              </span>
            </div>
            <div style={{
              position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
              width: '38%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,.7)',
            }}/>
          </>
        )}
      </div>
      {/* notch */}
      <div style={{
        position: 'absolute', top: height * 0.018 + 2, left: '50%', transform: 'translateX(-50%)',
        width: '32%', height: height * 0.025, borderRadius: 999, background: '#0a0806',
      }}/>
    </div>
  );
}

// ─────────────────────────────────────────────
// WallpaperArt — different stylized vector compositions per wallpaper.
// ─────────────────────────────────────────────
function WallpaperArt({ id, palette, name }) {
  const [c1, c2, c3] = palette;
  const common = {
    width: '100%', height: '100%',
    viewBox: '0 0 200 400', preserveAspectRatio: 'xMidYMid slice',
    style: { position: 'absolute', inset: 0 },
  };
  return (
    <>
      {id === 'lotus' && (
        <svg {...common}>
          <defs>
            <radialGradient id="lg1" cx=".5" cy=".4" r=".6">
              <stop offset="0" stopColor="#fff" stopOpacity=".6"/>
              <stop offset="1" stopColor={c3} stopOpacity="0"/>
            </radialGradient>
          </defs>
          <rect width="200" height="400" fill={c1}/>
          <rect width="200" height="400" fill="url(#lg1)"/>
          {/* sunburst rays */}
          {Array.from({ length: 18 }).map((_, i) => (
            <path key={i} d="M100 200 L 110 -20 L 90 -20 Z" fill="#fff" opacity=".08"
              transform={`rotate(${i * 20} 100 200)`}/>
          ))}
          {/* lotus */}
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
            const cx = 100 + Math.cos(a) * 26;
            const cy = 200 + Math.sin(a) * 26;
            return <ellipse key={i} cx={cx} cy={cy} rx="22" ry="34" fill={c3} opacity=".85"
              transform={`rotate(${(a * 180 / Math.PI) + 90} ${cx} ${cy})`}/>;
          })}
          <circle cx="100" cy="200" r="22" fill="#fff" opacity=".95"/>
          <circle cx="100" cy="200" r="10" fill={c3}/>
          {/* water ripples */}
          <ellipse cx="100" cy="320" rx="80" ry="6" fill="#fff" opacity=".25"/>
          <ellipse cx="100" cy="335" rx="60" ry="4" fill="#fff" opacity=".18"/>
        </svg>
      )}

      {id === 'moon' && (
        <svg {...common}>
          <rect width="200" height="400" fill={c1}/>
          <rect width="200" height="400" fill={`url(#mgrad-${id})`}/>
          <defs>
            <linearGradient id={`mgrad-${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={c3} stopOpacity=".25"/>
              <stop offset="1" stopColor={c1} stopOpacity="0"/>
            </linearGradient>
          </defs>
          {/* stars */}
          {Array.from({ length: 30 }).map((_, i) => (
            <circle key={i} cx={((i * 47) % 200)} cy={((i * 91) % 400)} r={Math.random() * 1.5 + .5}
              fill="#fff" opacity={Math.random() * 0.6 + 0.3}/>
          ))}
          {/* clouds */}
          <ellipse cx="40" cy="250" rx="60" ry="14" fill="#fff" opacity=".18"/>
          <ellipse cx="160" cy="290" rx="70" ry="12" fill="#fff" opacity=".14"/>
          {/* crescent moon */}
          <g transform="translate(100 160)">
            <circle r="48" fill="#fff" opacity=".95"/>
            <circle cx="18" r="48" fill={c1}/>
          </g>
        </svg>
      )}

      {id === 'lanterns' && (
        <svg {...common}>
          <rect width="200" height="400" fill={c2}/>
          {/* fog */}
          <rect width="200" height="180" y="220" fill={c3} opacity=".35"/>
          {/* hanging lanterns */}
          {[{x:50,y:130,s:.8},{x:100,y:90,s:1},{x:150,y:140,s:.85}].map((l, i) => (
            <g key={i} transform={`translate(${l.x} ${l.y}) scale(${l.s})`}>
              <line x1="0" y1="-100" x2="0" y2="-20" stroke="#3a2218" strokeWidth="1.5"/>
              <ellipse cx="0" cy="10" rx="22" ry="28" fill={c1}/>
              <rect x="-22" y="6" width="44" height="2" fill="#fff" opacity=".5"/>
              <rect x="-3" y="38" width="6" height="14" fill={c3}/>
              <line x1="0" y1="52" x2="-6" y2="68" stroke={c3} strokeWidth="1"/>
              <line x1="0" y1="52" x2="6" y2="68" stroke={c3} strokeWidth="1"/>
            </g>
          ))}
          {/* sparkles */}
          {Array.from({ length: 14 }).map((_, i) => (
            <circle key={i} cx={(i * 31) % 200} cy={(i * 53) % 250 + 100} r="1.5"
              fill="#fff" opacity={Math.random() * 0.7 + 0.3}/>
          ))}
        </svg>
      )}

      {id === 'coins' && (
        <svg {...common}>
          <rect width="200" height="400" fill={c1}/>
          <rect width="200" height="200" y="200" fill={c2} opacity=".5"/>
          {/* falling coins */}
          {Array.from({ length: 22 }).map((_, i) => {
            const x = (i * 37) % 180 + 10;
            const y = (i * 61) % 360 + 20;
            return (
              <g key={i} transform={`translate(${x} ${y})`}>
                <ellipse rx="10" ry="3" fill={c3} opacity=".3"/>
                <circle r="10" fill={c2}/>
                <circle r="8" fill={c1} opacity=".7"/>
                <text textAnchor="middle" dy="3" fontFamily="serif" fontSize="10" fontWeight="700" fill={c3}>福</text>
              </g>
            );
          })}
        </svg>
      )}

      {id === 'compass' && (
        <svg {...common}>
          <rect width="200" height="400" fill={c1}/>
          {/* mountains */}
          <path d="M0 320 L 50 240 L 90 280 L 130 220 L 170 290 L 200 250 L 200 400 L 0 400 Z" fill={c3}/>
          <path d="M0 350 L 40 290 L 80 320 L 120 270 L 170 320 L 200 290 L 200 400 L 0 400 Z" fill={c3} opacity=".5"/>
          {/* sun */}
          <circle cx="140" cy="100" r="30" fill="#fff" opacity=".7"/>
          {/* compass */}
          <g transform="translate(100 180)">
            <circle r="48" fill="none" stroke="#fff" strokeWidth="1.5" opacity=".8"/>
            <circle r="40" fill="none" stroke="#fff" strokeWidth=".6" opacity=".5"/>
            {/* N/S/E/W ticks */}
            {[0, 90, 180, 270].map(a => (
              <line key={a} x1="0" y1="-44" x2="0" y2="-36" stroke="#fff" strokeWidth="1.4"
                transform={`rotate(${a})`}/>
            ))}
            {/* needle */}
            <polygon points="0,-32 6,0 0,32 -6,0" fill={c3}/>
            <polygon points="0,-32 6,0 0,0" fill="#fff" opacity=".9"/>
            <circle r="3" fill="#fff"/>
          </g>
        </svg>
      )}

      {id === 'bamboo' && (
        <svg {...common}>
          <rect width="200" height="400" fill={c1}/>
          {/* bamboo stalks */}
          {[40, 90, 140, 175].map((x, i) => (
            <g key={i}>
              <rect x={x - 6} y="-20" width="12" height="440" fill={c3} opacity={.6 + i * 0.05}/>
              {[20, 80, 140, 200, 260, 320, 380].map(y => (
                <ellipse key={y} cx={x} cy={y} rx="8" ry="4" fill={c2}/>
              ))}
              {/* leaves */}
              {[50, 180, 300].map((y, k) => (
                <g key={y} transform={`translate(${x} ${y}) rotate(${(i + k) * 30})`}>
                  <ellipse cx="14" cy="0" rx="14" ry="3" fill={c2}/>
                </g>
              ))}
            </g>
          ))}
        </svg>
      )}

      {id === 'wave' && (
        <svg {...common}>
          <rect width="200" height="400" fill={c1}/>
          {/* layered waves */}
          {[120, 170, 220, 270, 320].map((y, i) => (
            <path key={y}
              d={`M0 ${y} Q 50 ${y - 20 + i * 4} 100 ${y} T 200 ${y} L 200 400 L 0 400 Z`}
              fill={i % 2 ? c2 : c3} opacity={0.4 + i * 0.1}/>
          ))}
          {/* moon */}
          <circle cx="150" cy="80" r="22" fill="#fff" opacity=".85"/>
          <circle cx="150" cy="80" r="22" fill="none" stroke="#fff" strokeWidth="1" opacity=".4"/>
        </svg>
      )}

      {id === 'leaf' && (
        <svg {...common}>
          <rect width="200" height="400" fill={c1}/>
          {/* leaves */}
          {[{x:50,y:80,r:30,s:1},{x:140,y:160,r:-20,s:1.3},{x:60,y:250,r:60,s:1.1},{x:150,y:330,r:-10,s:.9}].map((l, i) => (
            <g key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.r}) scale(${l.s})`}>
              <path d="M0 0 Q 20 -30 40 0 Q 20 30 0 0 Z" fill={c3} opacity=".85"/>
              <path d="M0 0 L 40 0" stroke={c1} strokeWidth="1" opacity=".5"/>
            </g>
          ))}
          {/* dewdrops */}
          {Array.from({ length: 12 }).map((_, i) => (
            <circle key={i} cx={(i * 41) % 180 + 10} cy={(i * 79) % 380 + 10} r="2"
              fill="#fff" opacity={Math.random() * 0.6 + 0.3}/>
          ))}
        </svg>
      )}

      {/* corner brand mark */}
      <div style={{
        position: 'absolute', bottom: 12, left: 0, right: 0,
        textAlign: 'center', color: '#fff', opacity: 0.7,
        fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: '.16em',
        textTransform: 'uppercase',
      }}>
        เซียมซี · {name}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// MockQR — pseudo QR pattern generated from a seed
// ─────────────────────────────────────────────
function MockQR({ seed = 'siamsi', size = 180 }) {
  const grid = 25;
  const cells = React.useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
    const out = [];
    for (let i = 0; i < grid * grid; i++) {
      h = (h * 1103515245 + 12345) | 0;
      out.push(((h >> 16) & 1) === 1);
    }
    return out;
  }, [seed]);
  const cs = size / grid;
  // finder squares (top-left, top-right, bottom-left)
  const finders = [[0,0],[grid-7,0],[0,grid-7]];
  const inFinder = (x, y) => finders.some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);

  return (
    <div style={{
      width: size + 28, height: size + 28, padding: 14,
      borderRadius: 18, background: '#fff', display: 'inline-block',
      boxShadow: '0 8px 22px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.04)',
    }}>
      <svg width={size} height={size}>
        {/* random data cells */}
        {cells.map((on, i) => {
          if (!on) return null;
          const x = i % grid, y = (i / grid) | 0;
          if (inFinder(x, y)) return null;
          return <rect key={i} x={x * cs} y={y * cs} width={cs} height={cs} fill="#1a1612"/>;
        })}
        {/* finder patterns */}
        {finders.map(([fx, fy], i) => (
          <g key={i} transform={`translate(${fx * cs} ${fy * cs})`}>
            <rect width={cs * 7} height={cs * 7} fill="#1a1612"/>
            <rect x={cs} y={cs} width={cs * 5} height={cs * 5} fill="#fff"/>
            <rect x={cs * 2} y={cs * 2} width={cs * 3} height={cs * 3} fill="#1a1612"/>
          </g>
        ))}
        {/* center logo */}
        <g transform={`translate(${size/2 - cs * 3} ${size/2 - cs * 3})`}>
          <rect width={cs * 6} height={cs * 6} rx="4" fill="#fff"/>
          <rect x={cs * 0.5} y={cs * 0.5} width={cs * 5} height={cs * 5} rx="3" fill="var(--c-peach)"/>
          <g transform={`translate(${cs * 3} ${cs * 3}) scale(${cs * 0.25})`}>
            <path d="M0 8 C -6 8 -10 4 -10 -2 C -10 -6 -6 -8 0 -6 C 6 -8 10 -6 10 -2 C 10 4 6 8 0 8 Z" fill="#fff"/>
          </g>
        </g>
      </svg>
    </div>
  );
}
window.MockQR = MockQR;
