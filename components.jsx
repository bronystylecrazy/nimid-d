// components.jsx — shared UI primitives + content data + doodle SVGs
// for the เซียมซี ritual prototype.

// ─────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────
const TEMPLES = [
  { id: 'thai',     name: 'วัดไทย',    sub: 'อบอุ่นด้วยทอง · ดอกบัว · เปลวเทียน',
    swatch: ['#E0B570', '#F2C68A', '#D9A874'], accent: '#C9853F' },
  { id: 'chinese',  name: 'วัดจีน',    sub: 'โทนแดงปะการัง · โคมแขวน · เมฆมงคล',
    swatch: ['#D97A6C', '#F2A296', '#E59180'], accent: '#B85A4D' },
  { id: 'japanese', name: 'วัดญี่ปุ่น', sub: 'ครีมพาสเทล · ซากุระ · ประตูโทริอิ',
    swatch: ['#E8C8E0', '#F5DCE8', '#D9B8D2'], accent: '#B891B5' },
];

const ACTIVITIES = [
  { id: 'meditate', name: 'นั่งสมาธิ', minutes: 1,
    desc: 'หลับตา หายใจช้า ๆ แล้วเตรียมใจให้สงบ' },
  { id: 'walk',     name: 'เดินจงกรม', minutes: 1,
    desc: 'เดินอย่างมีสติ รับรู้ทุกก้าวก่อนเริ่มพิธี' },
];

const MOODS_PRE = ['สงบ', 'กังวล', 'เหนื่อย', 'มีหวัง', 'สับสน', 'อยากได้คำแนะนำ'];

const BOXES = [
  { id: 'gold',   name: 'ไม้สีทอง',       wood: '#C9853F', trim: '#E0B570' },
  { id: 'red',    name: 'ไม้แดงลายเมฆ',   wood: '#B85A4D', trim: '#D97A6C' },
  { id: 'jade',   name: 'ไม้เขียวหยก',    wood: '#7BA890', trim: '#B8D8C8' },
  { id: 'purple', name: 'ไม้ม่วงพาสเทล',  wood: '#A892C0', trim: '#D9C4E3' },
  { id: 'floral', name: 'ไม้ลายดอกไม้',   wood: '#C9747A', trim: '#F2B5A0' },
  { id: 'mini',   name: 'ไม้สไตล์มินิมอล', wood: '#8A7570', trim: '#D9CCC3' },
];

const CATEGORIES = [
  { id: 'love',   name: 'ความรัก',  desc: 'เปิดคำแนะนำเรื่องหัวใจและความสัมพันธ์', icon: 'heart' },
  { id: 'money',  name: 'การเงิน',  desc: 'ดูแนวโน้มโชคลาภ รายรับ และการใช้จ่าย',     icon: 'coin' },
  { id: 'work',   name: 'การงาน',   desc: 'ค้นหาทิศทางเรื่องงาน เป้าหมาย และโอกาส', icon: 'compass' },
  { id: 'health', name: 'สุขภาพ',   desc: 'รับคำแนะนำเพื่อดูแลกายใจให้สมดุล',         icon: 'leaf' },
];

const MUSIC = [
  { id: 'bell',  name: 'ระฆังเบา ๆ',       mood: 'ดังกังวานช้า ๆ',  duration: '3:14' },
  { id: 'wind',  name: 'ลมและธรรมชาติ',     mood: 'อากาศโปร่งสบาย',   duration: '4:02' },
  { id: 'water', name: 'น้ำไหล',             mood: 'ผ่อนคลายต่อเนื่อง', duration: '5:28' },
  { id: 'thai',  name: 'สมาธิแบบไทย',        mood: 'พิณ ขลุ่ย เบา ๆ',  duration: '6:10' },
  { id: 'cn',    name: 'บรรยากาศวัดจีน',     mood: 'กู่เจิงและฉาบเบา',  duration: '4:48' },
  { id: 'jp',    name: 'บรรยากาศวัดญี่ปุ่น',   mood: 'โคโตะกับน้ำไหล',   duration: '5:00' },
];

const FORTUNES = {
  love:  { num: '๒๔', luck: [3, 17, 28],
    title: 'ใจที่เปิดรับ จะพบทางที่อบอุ่น',
    text: 'ความสัมพันธ์ในช่วงนี้เหมือนต้นไม้เล็ก ๆ ที่เพิ่งจะลงราก คุณต้องดูแลด้วยความใจเย็นและไม่เร่งรีบให้มันออกผล หากคุณยังลังเลกับใครคนหนึ่ง ลองให้เวลากับการรับฟังตัวเองมากขึ้น เพราะคำตอบที่แท้จริงมักอยู่ใต้เสียงที่เงียบที่สุด',
    advice: 'พูดในสิ่งที่ใจรู้สึก แต่อย่าใช้คำที่ใจไม่ตั้งใจ',
    question: 'ครั้งสุดท้ายที่คุณรู้สึกอบอุ่นกับใครสักคน คือเมื่อไหร่?' },
  money: { num: '๓๙', luck: [9, 21, 64],
    title: 'รายได้ดั่งสายน้ำ ค่อย ๆ ไหลมาเอง',
    text: 'การเงินในช่วงนี้ไม่ได้พุ่งสูงเหมือนคลื่น แต่จะค่อย ๆ ก่อตัวเหมือนสายน้ำที่หาทางลงสู่ที่ราบ คุณอาจได้รับโอกาสจากคนที่ไม่คาดคิด ลองเปิดรับและตอบกลับด้วยความสุภาพ การลงทุนใหญ่ในช่วงนี้ควรค่อย ๆ พิจารณา ไม่ต้องรีบตัดสินใจ',
    advice: 'จดบันทึกรายรับ-รายจ่ายเล็ก ๆ จะช่วยให้เห็นภาพชัดขึ้น',
    question: 'มีค่าใช้จ่ายอะไรในเดือนนี้ที่คุณรู้สึกว่ายังไม่จำเป็น?' },
  work:  { num: '๙', luck: [24, 59, 91],
    title: 'ใจที่นิ่ง จะเห็นทางที่ใช่',
    text: 'ช่วงนี้งานอาจมีเรื่องให้ตัดสินใจหลายทาง แต่ถ้าค่อย ๆ มองทีละขั้น คุณจะเห็นโอกาสที่ซ่อนอยู่ คำแนะนำคืออย่ารีบตอบรับทุกอย่างในทันที ลองให้เวลากับตัวเองเพื่อเลือกทางที่สอดคล้องกับใจจริง ความสำเร็จที่กำลังจะมาถึงไม่ได้วัดจากความเร็ว แต่จากความตั้งใจ',
    advice: 'เริ่มต้นวันด้วยสิ่งที่สำคัญที่สุดเพียงหนึ่งอย่าง',
    question: 'อะไรคือผลลัพธ์ที่ทำให้คุณภูมิใจในงานสัปดาห์นี้?' },
  health:{ num: '๑๒', luck: [4, 19, 33],
    title: 'กายและใจ ขอเพียงเดินไปด้วยกัน',
    text: 'ร่างกายของคุณกำลังส่งสัญญาณบางอย่างเบา ๆ ลองฟังมันให้ดี การพักผ่อนที่ดีไม่ใช่แค่การนอน แต่คือการให้พื้นที่กับใจในแต่ละวัน อาหาร น้ำ และอากาศ คือเพื่อนเก่าที่คุณอาจลืมไป กลับมาดูแลพวกเขาทีละนิด แล้วร่างกายจะตอบขอบคุณกลับมาเอง',
    advice: 'หายใจลึก ๆ ห้าครั้ง ก่อนเริ่มกิจกรรมแต่ละช่วงของวัน',
    question: 'วันนี้คุณดื่มน้ำพอหรือยัง?' },
};

Object.assign(window, { TEMPLES, ACTIVITIES, MOODS_PRE, BOXES, CATEGORIES, MUSIC, FORTUNES });

// ─────────────────────────────────────────────
// Icons (small, hand-stroked, no third-party set)
// ─────────────────────────────────────────────
const Stroke = ({ children, size = 22, color = 'currentColor', sw = 1.6, fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
    stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
    style={{ display: 'block' }}>{children}</svg>
);

const Icon = {
  heart:   (p) => <Stroke {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></Stroke>,
  coin:    (p) => <Stroke {...p}><circle cx="12" cy="12" r="8"/><path d="M12 6v12M9 9h4.5a2 2 0 1 1 0 4H9.5a2 2 0 1 0 0 4H15"/></Stroke>,
  compass: (p) => <Stroke {...p}><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 13 13l-4.5 2.5L11 11l4.5-2.5z"/></Stroke>,
  leaf:    (p) => <Stroke {...p}><path d="M4 20c0-9 7-16 16-16-1 11-7 16-16 16zM4 20c4-4 8-8 12-12"/></Stroke>,
  play:    (p) => <Stroke {...p} fill="currentColor" sw={0}><path d="M7 5l12 7-12 7z"/></Stroke>,
  pause:   (p) => <Stroke {...p} fill="currentColor" sw={0}><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></Stroke>,
  arrowR:  (p) => <Stroke {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Stroke>,
  arrowL:  (p) => <Stroke {...p}><path d="M19 12H5M11 18l-6-6 6-6"/></Stroke>,
  check:   (p) => <Stroke {...p}><path d="M4 12l5 5L20 6"/></Stroke>,
  sparkle: (p) => <Stroke {...p}><path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/></Stroke>,
  lotus:   (p) => <Stroke {...p}><path d="M12 19c-5 0-8-3-8-3s2-5 5-6c0 0 1 4 3 4s3-4 3-4c3 1 5 6 5 6s-3 3-8 3z"/><path d="M12 14V8M9 13c-1-2-1-4 0-6M15 13c1-2 1-4 0-6"/></Stroke>,
  music:   (p) => <Stroke {...p}><path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></Stroke>,
  bell:    (p) => <Stroke {...p}><path d="M6 16h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v4z"/><path d="M10 19a2 2 0 0 0 4 0"/></Stroke>,
  pencil:  (p) => <Stroke {...p}><path d="M4 20l1-4 11-11 3 3-11 11-4 1zM13 8l3 3"/></Stroke>,
  refresh: (p) => <Stroke {...p}><path d="M4 12a8 8 0 0 1 14-5l2-1M20 12a8 8 0 0 1-14 5l-2 1M18 3v4h-4M6 21v-4h4"/></Stroke>,
};
window.Icon = Icon;

// ─────────────────────────────────────────────
// Decorative doodles (organic blobs + sparkles)
// ─────────────────────────────────────────────
const BlobShape = ({ d, fill, style }) => (
  <svg viewBox="0 0 200 200" preserveAspectRatio="none"
    style={{ position: 'absolute', ...style }}>
    <path d={d} fill={fill}/>
  </svg>
);

const Blobs = {
  one:   'M40 100c0-35 25-60 60-60s60 25 60 60-30 60-65 60-55-25-55-60z',
  two:   'M30 110c-5-40 30-80 80-75 40 4 70 35 60 80-8 36-50 55-90 40-32-12-46-25-50-45z',
  three: 'M50 60c20-20 70-25 95 0 30 30 5 80-25 95-30 14-75 0-85-35-9-30 5-50 15-60z',
};
window.BlobShape = BlobShape; window.Blobs = Blobs;

// Sparkle dots — for selected states / magical moments
function Sparkles({ count = 8, color = '#E0B570', style }) {
  const dots = React.useMemo(
    () => Array.from({ length: count }).map((_, i) => ({
      x: Math.random() * 100, y: Math.random() * 100,
      s: 2 + Math.random() * 4, d: Math.random() * 3,
      o: 0.4 + Math.random() * 0.5,
    })), [count],
  );
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }}>
      {dots.map((p, i) => (
        <span key={i} style={{
          position: 'absolute', left: p.x + '%', top: p.y + '%',
          width: p.s, height: p.s, borderRadius: '50%',
          background: color, opacity: p.o,
          boxShadow: `0 0 ${p.s * 2}px ${color}`,
          animation: `spark 3s ease-in-out ${p.d}s infinite`,
        }}/>
      ))}
    </div>
  );
}
window.Sparkles = Sparkles;

// Cloud / lotus / sakura ornaments per temple style
const TempleOrnament = ({ temple, style }) => {
  if (temple === 'thai') {
    return (
      <svg width="100%" height="100%" viewBox="0 0 200 60" style={style}>
        <path d="M10 50 Q20 20 30 50 Q40 25 50 50 Q60 30 70 50 Q80 22 90 50 Q100 28 110 50 Q120 24 130 50 Q140 30 150 50 Q160 22 170 50 Q180 28 190 50"
          fill="none" stroke="#E0B570" strokeWidth="2" strokeLinecap="round" opacity=".7"/>
        <circle cx="50" cy="30" r="3" fill="#E0B570" opacity=".6"/>
        <circle cx="100" cy="28" r="3" fill="#E0B570" opacity=".6"/>
        <circle cx="150" cy="30" r="3" fill="#E0B570" opacity=".6"/>
      </svg>
    );
  }
  if (temple === 'chinese') {
    return (
      <svg width="100%" height="100%" viewBox="0 0 200 60" style={style}>
        <path d="M10 40 Q25 25 40 40 Q50 50 60 40 Q75 25 90 40 Q100 50 110 40 Q125 25 140 40 Q150 50 160 40 Q175 25 190 40"
          fill="none" stroke="#D97A6C" strokeWidth="2" strokeLinecap="round" opacity=".7"/>
      </svg>
    );
  }
  // japanese - sakura petals
  return (
    <svg width="100%" height="100%" viewBox="0 0 200 60" style={style}>
      {[20, 60, 100, 140, 180].map((cx, i) => (
        <g key={i} transform={`translate(${cx} 30) rotate(${i * 35})`} opacity=".65">
          {[0, 72, 144, 216, 288].map(r => (
            <ellipse key={r} cx="0" cy="-6" rx="3" ry="6" fill="#E8C8E0"
              transform={`rotate(${r})`}/>
          ))}
          <circle r="2" fill="#D9B8D2"/>
        </g>
      ))}
    </svg>
  );
};
window.TempleOrnament = TempleOrnament;

// ─────────────────────────────────────────────
// UI: Step progress
// ─────────────────────────────────────────────
function StepProgress({ step, total = 4, labels }) {
  return (
    <div className="steps">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <span className={`dot ${i === step ? 'active' : i < step ? 'done' : ''}`}/>
          {labels && i === step && <span style={{ marginLeft: 4 }}>{labels[i]}</span>}
        </React.Fragment>
      ))}
    </div>
  );
}
window.StepProgress = StepProgress;

// ─────────────────────────────────────────────
// UI: Selection card (radio-card)
// ─────────────────────────────────────────────
function SelectCard({ active, onClick, children, style, padding = 18, glow = true }) {
  return (
    <button onClick={onClick}
      style={{
        position: 'relative',
        textAlign: 'left',
        background: active ? 'var(--surface-card)' : 'var(--surface-card)',
        border: '1.5px solid ' + (active ? 'var(--text-main)' : 'var(--border-soft)'),
        borderRadius: 'var(--radius-card)',
        padding,
        boxShadow: active && glow
          ? 'var(--shadow-glow)'
          : 'var(--shadow-soft)',
        cursor: 'pointer',
        transition: 'all .18s cubic-bezier(.3,.7,.4,1.4)',
        transform: active ? 'translateY(-2px)' : 'none',
        ...style,
      }}>
      {children}
      {active && (
        <span style={{
          position: 'absolute', top: 12, right: 12,
          width: 22, height: 22, borderRadius: '50%',
          background: 'var(--text-main)', color: 'var(--text-on-dark)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon.check size={14} sw={2.4}/>
        </span>
      )}
    </button>
  );
}
window.SelectCard = SelectCard;

// ─────────────────────────────────────────────
// UI: App shell — header + side rail
// ─────────────────────────────────────────────
function AppShell({ step, children, temple = 'thai', density = 'med' }) {
  return (
    <div className="proto" data-season="spring">
      <Sparkles count={density === 'high' ? 18 : density === 'med' ? 10 : 4}/>
      {/* soft background blobs for warmth */}
      <BlobShape d={Blobs.one}  fill="rgba(242,181,160,.18)" style={{ width: 520, height: 520, top: -160, left: -160, filter: 'blur(20px)' }}/>
      <BlobShape d={Blobs.two}  fill="rgba(232,200,224,.20)" style={{ width: 600, height: 600, bottom: -220, right: -180, filter: 'blur(24px)' }}/>
      <BlobShape d={Blobs.three} fill="rgba(184,216,200,.12)" style={{ width: 460, height: 460, top: '30%', left: '60%', filter: 'blur(30px)' }}/>

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
        <StepProgress step={step}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-tertiary"><Icon.music size={16}/> เสียง</button>
          <span className="badge"><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-mint-deep)' }}/> โหมดสงบ</span>
        </div>
      </header>

      <main style={{ position: 'absolute', inset: 0, paddingTop: 92 }}>
        {children}
      </main>
    </div>
  );
}
window.AppShell = AppShell;

function Logo() {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 12,
      background: 'linear-gradient(135deg, var(--c-peach), var(--c-lavender))',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 14px rgba(242,181,160,.4)',
    }}>
      <Icon.lotus size={22} color="#fff" sw={1.8}/>
    </div>
  );
}
window.Logo = Logo;

// Box preview — small 3D-ish illustrated isometric box for selection cards
function BoxPreview({ wood, trim, size = 100 }) {
  return (
    <svg width={size} height={size * 0.85} viewBox="0 0 100 85" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`g-${wood.slice(1)}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={trim}/>
          <stop offset="1" stopColor={wood}/>
        </linearGradient>
      </defs>
      {/* top face */}
      <polygon points="50,8 88,24 50,40 12,24" fill={trim} opacity=".95"/>
      {/* right face */}
      <polygon points="88,24 88,62 50,78 50,40" fill={wood}/>
      {/* left face */}
      <polygon points="12,24 12,62 50,78 50,40" fill={`url(#g-${wood.slice(1)})`} opacity=".85"/>
      {/* sticks peeking out the top */}
      <g opacity=".9">
        <rect x="46" y="-2" width="2" height="14" rx="1" fill="#FBF2EA" transform="rotate(-8 47 5)"/>
        <rect x="50" y="-4" width="2" height="16" rx="1" fill="#F5E5D2" transform="rotate(4 51 4)"/>
        <rect x="54" y="-2" width="2" height="14" rx="1" fill="#E5D5C0" transform="rotate(12 55 5)"/>
      </g>
      {/* trim band */}
      <polygon points="12,28 50,44 88,28 88,32 50,48 12,32" fill={trim} opacity=".7"/>
    </svg>
  );
}
window.BoxPreview = BoxPreview;
