// shake.jsx — Phase 3: Real Three.js shake ritual scene
// Stylized low-poly temple diorama. Click box to shake; meter fills; one
// stick rises out. Plays a soft bell tone on completion.

function ShakeScreen({ state, onContinue, onBack, detail = 'med', vol = 0.5 }) {
  const mountRef = React.useRef(null);
  const sceneApiRef = React.useRef(null);
  const onShakeRef = React.useRef(null);
  const [shakes, setShakes] = React.useState(0);
  const [phase, setPhase] = React.useState('ready'); // ready | shaking | revealed
  const targetShakes = 14;

  // Audio synth — single soft bell on completion. Built lazily on user
  // gesture so the AudioContext can resume.
  const audioRef = React.useRef(null);
  const playBell = React.useCallback(() => {
    try {
      if (!audioRef.current) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioRef.current = new AC();
      }
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.value = vol * 0.6;
      master.connect(ctx.destination);
      // Two-partial bell: fundamental + slight inharmonic
      [528, 792].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(i ? 0.18 : 0.34, now + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
        o.connect(g); g.connect(master);
        o.start(now); o.stop(now + 2.5);
      });
    } catch (e) {}
  }, [vol]);

  // Init the Three.js scene
  React.useEffect(() => {
    if (!mountRef.current) return;
    const api = initShakeScene(mountRef.current, {
      temple: state.temple, box: state.box, detail,
      onBoxClick: () => onShakeRef.current && onShakeRef.current(),
    });
    sceneApiRef.current = api;
    return () => api.dispose();
  }, [state.temple, state.box, detail]);

  const onShake = React.useCallback(() => {
    const api = sceneApiRef.current;
    if (!api) return;
    setShakes(s => {
      if (s >= targetShakes) return s;
      const ns = s + 1;
      setPhase('shaking');
      api.shake();
      if (ns >= targetShakes) {
        api.revealStick();
        playBell();
        setTimeout(() => setPhase('revealed'), 1200);
      }
      return ns;
    });
  }, [playBell]);
  onShakeRef.current = onShake;

  // Auto-advance to the result screen ~2.4s after the stick reveals
  React.useEffect(() => {
    if (phase !== 'revealed') return;
    const id = setTimeout(() => { onContinue && onContinue(); }, 2400);
    return () => clearTimeout(id);
  }, [phase, onContinue]);

  const pct = Math.min(1, shakes / targetShakes);
  const t = TEMPLES.find(x => x.id === state.temple);

  return (
    <AppShell step={2}>
      <div style={{ position: 'absolute', inset: 0, paddingTop: 0 }}>

        {/* Three.js canvas — fullbleed */}
        <div ref={mountRef} style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse at center top, ${t.swatch[1]}, ${t.swatch[0]} 60%, ${t.accent}99 100%)`,
        }}/>

        {/* Overlay UI — left copy panel */}
        <div style={{
          position: 'absolute', top: 116, left: 48, maxWidth: 360, zIndex: 4,
        }}>
          <div className="glass" style={{ padding: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>ขั้นตอนที่ ๓ · พิธีเขย่า</div>
            <h2 style={{ fontSize: 28, lineHeight: 1.2, marginBottom: 10 }}>
              {phase === 'revealed' ? 'ไม้เซียมซีออกมาแล้ว' : 'คลิกเพื่อเขย่าเซียมซี'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.55 }}>
              {phase === 'revealed'
                ? 'หยิบไม้ที่ออกมาเพื่อดูคำทำนายของคุณ'
                : 'ตั้งจิตให้นิ่ง แล้วค่อย ๆ เขย่าไปทีละครั้ง รับรู้ทุกการเคลื่อนไหว'}
            </p>
          </div>
        </div>

        {/* Overlay UI — right detail panel */}
        <div style={{
          position: 'absolute', top: 116, right: 48, width: 280, zIndex: 4,
        }}>
          <div className="glass" style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span className="eyebrow">ฉาก</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{t.name}</span>
            </div>
            <div style={{ height: 1, background: 'var(--border-soft)', margin: '0 -22px 14px' }}/>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span className="eyebrow">เพลง</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Waveform2 active={phase !== 'revealed'}/>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{MUSIC.find(m => m.id === state.music)?.name}</span>
              </div>
            </div>
            <div style={{ height: 1, background: 'var(--border-soft)', margin: '0 -22px 14px' }}/>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="eyebrow">หมวด</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{CATEGORIES.find(c => c.id === state.category)?.name}</span>
            </div>
          </div>
        </div>

        {/* Center HUD — shake meter */}
        <div style={{
          position: 'absolute', bottom: 44, left: '50%', transform: 'translateX(-50%)',
          zIndex: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
        }}>
          {/* meter */}
          <div className="glass" style={{ padding: '14px 22px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>พลังแห่งเจตนา</span>
            <div style={{ width: 220, height: 8, borderRadius: 4, background: 'rgba(61,46,42,.08)', overflow: 'hidden' }}>
              <div style={{
                width: `${pct * 100}%`, height: '100%',
                background: pct >= 1
                  ? 'linear-gradient(90deg, var(--c-gold), var(--c-peach-deep))'
                  : 'linear-gradient(90deg, var(--c-peach), var(--c-lavender))',
                transition: 'width .3s cubic-bezier(.3,.7,.4,1.4)',
              }}/>
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 36 }}>
              {Math.round(pct * 100)}%
            </span>
          </div>

          {phase !== 'revealed' ? (
            <button onClick={onShake}
              style={{
                padding: '20px 56px',
                borderRadius: 999,
                background: 'var(--text-main)', color: 'var(--text-on-dark)',
                border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500,
                boxShadow: '0 12px 40px rgba(61,46,42,.22)',
                animation: 'pulse-soft 2.2s ease-in-out infinite',
                display: 'inline-flex', alignItems: 'center', gap: 12,
                transition: 'transform .12s',
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(.96)'}
              onMouseUp={(e) => e.currentTarget.style.transform = ''}
              onMouseLeave={(e) => e.currentTarget.style.transform = ''}>
              <Icon.sparkle size={18}/> เขย่าเซียมซี
            </button>
          ) : (
            <div style={{
              padding: '18px 36px', borderRadius: 999,
              background: 'rgba(255,255,255,.7)',
              backdropFilter: 'blur(20px) saturate(160%)',
              WebkitBackdropFilter: 'blur(20px) saturate(160%)',
              border: '1px solid rgba(255,255,255,.7)',
              boxShadow: 'var(--shadow-soft)',
              display: 'inline-flex', alignItems: 'center', gap: 12,
              fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500,
              color: 'var(--text-main)',
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%',
                border: '2px solid var(--c-peach)',
                borderTopColor: 'transparent',
                animation: 'spin-mini 1s linear infinite',
              }}/>
              กำลังเปิดคำทำนายของคุณ...
            </div>
          )}

          <button className="btn btn-tertiary" onClick={onBack} style={{ padding: '6px 14px' }}>
            <Icon.arrowL size={14}/> กลับไปเตรียมใจ
          </button>
        </div>

        {/* tiny cue on first click */}
        {shakes === 0 && (
          <div style={{
            position: 'absolute', bottom: 220, left: '50%', transform: 'translateX(-50%)',
            zIndex: 4, fontSize: 13, color: 'rgba(61,46,42,.5)',
            animation: 'float-y 2s ease-in-out infinite',
          }}>
            ↓ คลิกที่กล่อง หรือปุ่มด้านล่าง
          </div>
        )}
      </div>
    </AppShell>
  );
}
window.ShakeScreen = ShakeScreen;

// small waveform variant
function Waveform2({ active }) {
  const heights = [4, 8, 12, 6, 14, 5, 10];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 14 }}>
      {heights.map((h, i) => (
        <span key={i} style={{
          width: 2, height: h, borderRadius: 1,
          background: 'var(--text-main)',
          opacity: active ? 0.85 : 0.3,
          animation: active ? `float-y ${1 + (i % 3) * 0.3}s ease-in-out ${i * 0.1}s infinite` : 'none',
        }}/>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// initShakeScene — vanilla Three.js
// ─────────────────────────────────────────────
function initShakeScene(container, opts) {
  const THREE = window.THREE;
  if (!THREE) {
    container.innerHTML = '<div style="padding:40px;color:#888">Three.js failed to load</div>';
    return { dispose: () => {}, shake: () => {}, revealStick: () => {} };
  }

  const temple = TEMPLES.find(t => t.id === opts.temple) || TEMPLES[0];
  const box = BOXES.find(b => b.id === opts.box) || BOXES[0];

  const w = container.clientWidth, h = container.clientHeight;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(w, h);
  renderer.shadowMap.enabled = opts.detail !== 'low';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // colored fog tint
  scene.fog = new THREE.Fog(new THREE.Color(temple.swatch[0]), 14, 26);

  const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
  camera.position.set(0, 4.2, 7.5);
  camera.lookAt(0, 0.4, 0);

  // ── Lights ─────────────────────────────────
  const hemi = new THREE.HemisphereLight(0xfff0e0, new THREE.Color(temple.swatch[2]), 0.7);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff0e0, 1.4);
  key.position.set(4, 8, 5);
  key.castShadow = opts.detail !== 'low';
  if (key.castShadow) {
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 22;
    key.shadow.camera.top = 6;  key.shadow.camera.bottom = -6;
    key.shadow.camera.left = -6; key.shadow.camera.right = 6;
    key.shadow.bias = -0.0005;
  }
  scene.add(key);

  const fill = new THREE.PointLight(new THREE.Color(temple.accent), 0.8, 12);
  fill.position.set(-3, 2, 3);
  scene.add(fill);

  const rim = new THREE.PointLight(0xffe4c4, 0.5, 10);
  rim.position.set(0, 3, -3);
  scene.add(rim);

  // ── Ground (round dais) ────────────────────
  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6.4, 0.4, 56),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(temple.swatch[2]).multiplyScalar(0.9),
      roughness: 0.95, metalness: 0,
    }),
  );
  ground.position.y = -0.2;
  ground.receiveShadow = true;
  scene.add(ground);

  // inner ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.8, 3.1, 56),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(temple.accent), transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.005;
  scene.add(ring);

  // ── Decorative temple element ──────────────
  if (temple.id === 'thai') {
    // simple lotus pad behind
    const lotus = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const petal = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 8, 4, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(temple.accent), roughness: 0.7 }),
      );
      petal.position.set(Math.cos(i / 8 * Math.PI * 2) * 0.7, 0, Math.sin(i / 8 * Math.PI * 2) * 0.7);
      petal.rotation.y = i / 8 * Math.PI * 2;
      petal.scale.set(1, 0.4, 0.7);
      lotus.add(petal);
    }
    lotus.position.set(0, 0.05, -3);
    lotus.scale.setScalar(1.4);
    scene.add(lotus);
  } else if (temple.id === 'chinese') {
    // two hanging lanterns
    for (const x of [-3.2, 3.2]) {
      const lantern = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 16, 16),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(temple.accent),
          emissive: new THREE.Color(temple.accent).multiplyScalar(0.5),
          emissiveIntensity: 0.7,
          roughness: 0.4,
        }),
      );
      lantern.position.set(x, 2.4, -1.5);
      lantern.scale.y = 1.3;
      lantern.castShadow = false;
      scene.add(lantern);
      // string
      const str = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, 1.5),
        new THREE.MeshBasicMaterial({ color: 0x6a5a4a }),
      );
      str.position.set(x, 3.4, -1.5);
      scene.add(str);
      lantern.userData.float = { base: 2.4, phase: x };
    }
  } else if (temple.id === 'japanese') {
    // torii gate
    const wood = new THREE.MeshStandardMaterial({ color: new THREE.Color(temple.accent), roughness: 0.7 });
    const torii = new THREE.Group();
    const left = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 3, 8), wood);
    const right = left.clone();
    left.position.set(-1.2, 1.5, 0); right.position.set(1.2, 1.5, 0);
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.2, 0.4), wood);
    top.position.set(0, 2.9, 0);
    const top2 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 0.3), wood);
    top2.position.set(0, 2.7, 0);
    torii.add(left, right, top, top2);
    torii.position.z = -3;
    torii.scale.setScalar(0.8);
    scene.add(torii);
  }

  // ── Fortune box ────────────────────────────
  const boxGroup = new THREE.Group();
  scene.add(boxGroup);

  const woodCol = new THREE.Color(box.wood);
  const trimCol = new THREE.Color(box.trim);
  // Bamboo natural finish — light tan body + darker node rings.
  const bambooMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#D2BD86'),
    roughness: 0.85, metalness: 0,
  });
  const bambooNodeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#8C7544'),
    roughness: 0.78, metalness: 0.05,
  });
  // Inner cavity (visible from above) is darker to read as hollow bamboo
  const bambooInner = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#5C4528'),
    roughness: 0.95, side: THREE.DoubleSide,
  });
  // Keep trimMat for the existing stick tip code
  const trimMat = new THREE.MeshStandardMaterial({
    color: trimCol, roughness: 0.5, metalness: 0.2,
    emissive: trimCol.clone().multiplyScalar(0.15), emissiveIntensity: 0.5,
  });

  // Main bamboo body — smooth tall cylinder, more radial segments for roundness
  const bodyShape = new THREE.CylinderGeometry(0.66, 0.66, 1.42, 36, 1, true);
  const body = new THREE.Mesh(bodyShape, bambooMat);
  body.position.y = 0.71;
  body.castShadow = true; body.receiveShadow = true;
  boxGroup.add(body);

  // Inner hollow wall (so the rim shows depth)
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.64, 0.64, 1.42, 36, 1, true),
    bambooInner,
  );
  inner.position.y = 0.71;
  inner.material.side = THREE.BackSide;
  boxGroup.add(inner);

  // Bamboo node rings (joints) — slight bulges around the body at intervals.
  // Use Lathe sweeps via TorusGeometry for the bead profile.
  const NODE_HEIGHTS = [0.06, 0.46, 0.92, 1.36];
  NODE_HEIGHTS.forEach((y) => {
    const node = new THREE.Mesh(
      new THREE.TorusGeometry(0.685, 0.055, 14, 40),
      bambooNodeMat,
    );
    node.position.y = y;
    node.rotation.x = Math.PI / 2;
    node.castShadow = true;
    boxGroup.add(node);
    // a softer darker line right under each node ring for shading
    const shade = new THREE.Mesh(
      new THREE.TorusGeometry(0.682, 0.018, 8, 40),
      bambooNodeMat,
    );
    shade.position.y = y - 0.06; shade.rotation.x = Math.PI / 2;
    shade.material = shade.material.clone();
    shade.material.color = new THREE.Color('#7A6438');
    boxGroup.add(shade);
  });

  // Subtle vertical grain lines for bamboo texture
  const grainMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#A68850'), transparent: true, opacity: 0.45,
  });
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const line = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0035, 0.0035, 1.36, 3),
      grainMat,
    );
    line.position.set(Math.cos(angle) * 0.662, 0.71, Math.sin(angle) * 0.662);
    boxGroup.add(line);
  }

  // ── Hands holding the box (first-person perspective, with elbows) ──
  // Anatomical arms: shoulder → upper arm → elbow joint → forearm → wrist → hand.
  // Pale/white skin tone. Hands grip the box tightly.
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xF6E4D2, roughness: 0.62, metalness: 0.02,
    transparent: true, opacity: 0.55, depthWrite: false,
  });
  const skinShadow = new THREE.MeshStandardMaterial({
    color: 0xE5CCB5, roughness: 0.68, metalness: 0.02,
    transparent: true, opacity: 0.55, depthWrite: false,
  });
  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x3D2E2A, roughness: 0.85,
    transparent: true, opacity: 0.6, depthWrite: false,
  });

  // Helper: build a tapered cylinder segment between two world points
  function buildLimb(from, to, rTop, rBot, mat) {
    const len = from.distanceTo(to);
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(to, from).normalize();
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBot, len, 14),
      mat,
    );
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    m.position.copy(mid);
    m.castShadow = true;
    return m;
  }

  function buildHand(side) {
    const g = new THREE.Group();

    // Joint positions in boxGroup-local coords. Hand position is at the
    // palm; fingertips land ON the cylinder's front surface so the camera
    // sees them gripping the visible side of the box.
    const shoulderAt = new THREE.Vector3(side * 1.15, 2.05, 4.30);
    const elbowAt    = new THREE.Vector3(side * 1.20, 1.05, 2.10);
    const wristAt    = new THREE.Vector3(side * 0.95, 0.78, 0.30);
    const palmAt     = new THREE.Vector3(side * 0.76, 0.78, 0.22);

    // ── Upper arm ───────────────────────────
    g.add(buildLimb(shoulderAt, elbowAt, 0.21, 0.17, skinShadow));
    const shoulder = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 14, 12), skinShadow,
    );
    shoulder.position.copy(shoulderAt);
    g.add(shoulder);

    // ── Elbow joint ─────────────────────────
    const elbow = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 14, 12), skinShadow,
    );
    elbow.position.copy(elbowAt);
    elbow.castShadow = true;
    g.add(elbow);

    // ── Forearm ─────────────────────────────
    g.add(buildLimb(elbowAt, wristAt, 0.16, 0.13, skinMat));

    // ── Sleeve cuff (dark band where shirt ends at wrist) ──
    const cuffDir = new THREE.Vector3().subVectors(wristAt, elbowAt).normalize();
    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.16, 0.14, 18), sleeveMat,
    );
    cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), cuffDir);
    cuff.position.copy(wristAt).add(cuffDir.clone().multiplyScalar(-0.10));
    g.add(cuff);

    // ── Palm — block, oriented so its thin axis lies along radius ──
    // Default BoxGeometry axes after rotation.y = ±π/2: width(X) becomes depth(Z).
    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.34, 0.20), skinMat,
    );
    palm.position.copy(palmAt);
    palm.rotation.y = side * Math.PI * 0.5; // thin face toward box (radial)
    palm.castShadow = true;
    palm.receiveShadow = true;
    g.add(palm);

    // Knuckle bumps on the back-of-hand (camera-facing side, +Z direction)
    for (let i = 0; i < 4; i++) {
      const k = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 10, 8), skinShadow,
      );
      k.position.set(
        palmAt.x + side * -0.02, // slightly inboard so they read on back
        palmAt.y + 0.13 - i * 0.07,
        palmAt.z + 0.14,
      );
      g.add(k);
    }

    // ── Thumb — base on top-inner of palm, wraps over the top edge of the
    // box and reaches forward. Two segments + tip sphere.
    const thumbBase = new THREE.Vector3(side * 0.62, palmAt.y + 0.18, palmAt.z + 0.02);
    const thumbMid  = new THREE.Vector3(side * 0.40, palmAt.y + 0.32, palmAt.z + 0.20);
    const thumbTipP = new THREE.Vector3(side * 0.16, palmAt.y + 0.30, palmAt.z + 0.42);
    g.add(buildLimb(thumbBase, thumbMid, 0.070, 0.062, skinMat));
    g.add(buildLimb(thumbMid,  thumbTipP, 0.062, 0.055, skinMat));
    const thumbJ = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), skinMat);
    thumbJ.position.copy(thumbMid); g.add(thumbJ);
    const thumbTipS = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skinMat);
    thumbTipS.position.copy(thumbTipP); g.add(thumbTipS);

    // ── 4 fingers — fingertips wrap AROUND TO THE BACK of the box, and now
    // sit INSIDE the bamboo's outer wall (R_TIP < body radius 0.66) so the
    // bamboo body itself occludes them from the camera — no more pokey tips.
    const R_TIP    = 0.60;  // INSIDE bamboo body — hidden by cylinder wall
    const R_KNUCK  = 0.76;  // knuckle just outside surface (visible)
    // Angles measured CW from +X axis (toward -Z). Tightly clustered behind
    // the box; |x| stays well within the cylinder silhouette.
    const ANGLES   = [50, 72, 94, 116];
    const Y_OFFS   = [0.10, 0.03, -0.05, -0.14];
    ANGLES.forEach((deg, i) => {
      const rad = deg * Math.PI / 180;
      // Finger ends at the bamboo's outer surface (R=0.66) — no tip sphere
      // protrudes past the wall, so no visible fingertip.
      const fingerEndPos = new THREE.Vector3(
        side * 0.66 * Math.cos(rad),
        palmAt.y + Y_OFFS[i],
        -0.66 * Math.sin(rad),
      );
      const radK = deg * 0.45 * Math.PI / 180;
      const knuckPos = new THREE.Vector3(
        side * R_KNUCK * Math.cos(radK),
        palmAt.y + Y_OFFS[i],
        -R_KNUCK * Math.sin(radK),
      );
      g.add(buildLimb(knuckPos, fingerEndPos, 0.055, 0.048, skinMat));
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.060, 10, 8), skinMat);
      k.position.copy(knuckPos); g.add(k);
      // Fingertip removed — finger reads as curled into the bamboo, no protruding tip
    });

    return g;
  }

  const handL = buildHand(-1);
  const handR = buildHand(+1);
  boxGroup.add(handL);
  boxGroup.add(handR);
  // ── Fortune scrolls (ม้วนคำทำนาย) inside the bamboo ───────────
  // Each scroll = cream paper cylinder with a colored ribbon top.
  const stickMat = new THREE.MeshStandardMaterial({
    color: 0xf3e5c4, roughness: 0.9, metalness: 0,
  });
  const stickTipMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(temple.accent), roughness: 0.5,
    emissive: new THREE.Color(temple.accent), emissiveIntensity: 0.2,
  });
  const stickFootMat = new THREE.MeshStandardMaterial({
    color: 0xd9c3a0, roughness: 0.85,
  });
  const sticks = [];
  const STICK_COUNT = opts.detail === 'high' ? 22 : opts.detail === 'low' ? 8 : 14;

  // Scroll dimensions — rolled paper cylinder
  const STICK_LEN = 1.05;
  const SCROLL_R  = 0.052;

  for (let i = 0; i < STICK_COUNT; i++) {
    const s = new THREE.Group();
    const len = STICK_LEN + (Math.random() - 0.5) * 0.08;

    // Paper body — cylinder
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(SCROLL_R, SCROLL_R, len, 14),
      stickMat,
    );
    body.position.y = len / 2;
    body.castShadow = true;

    // Bottom end cap (slightly wider, paper edge)
    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(SCROLL_R * 1.12, SCROLL_R * 1.12, 0.04, 14),
      stickFootMat,
    );
    foot.position.y = 0.02;

    // Top end cap — colored ribbon end (this is the "tip" that glows on reveal)
    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(SCROLL_R * 1.18, SCROLL_R * 1.18, 0.07, 14),
      stickTipMat,
    );
    tip.position.y = len - 0.035;

    // Small dot on the very top (paper, like a sealed scroll end)
    const seal = new THREE.Mesh(
      new THREE.CylinderGeometry(SCROLL_R * 0.78, SCROLL_R * 0.78, 0.01, 14),
      stickMat,
    );
    seal.position.y = len + 0.005;

    s.add(body, foot, tip, seal);

    // random offset within box top, fanned at random Y rotations
    const r = Math.random() * 0.4;
    const a = Math.random() * Math.PI * 2;
    s.position.set(Math.cos(a) * r, 1.0, Math.sin(a) * r);
    s.rotation.set(
      (Math.random() - 0.5) * 0.3,
      Math.random() * Math.PI,
      (Math.random() - 0.5) * 0.3,
    );
    s.userData = { home: s.position.clone(), homeRot: s.rotation.clone(), wiggle: 0, special: false };
    boxGroup.add(s);
    sticks.push(s);
  }
  // Pick the "special" stick that will pop out
  const special = sticks[Math.floor(Math.random() * sticks.length)];
  special.userData.special = true;

  // ── Floating particles (sparkles) ──────────
  const partGeo = new THREE.BufferGeometry();
  const PCOUNT = opts.detail === 'low' ? 60 : opts.detail === 'high' ? 220 : 140;
  const pos = new Float32Array(PCOUNT * 3);
  const partData = [];
  for (let i = 0; i < PCOUNT; i++) {
    const x = (Math.random() - 0.5) * 12;
    const y = Math.random() * 5;
    const z = (Math.random() - 0.5) * 8;
    pos[i*3] = x; pos[i*3+1] = y; pos[i*3+2] = z;
    partData.push({ vy: 0.003 + Math.random() * 0.005, phase: Math.random() * Math.PI * 2 });
  }
  partGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const partMat = new THREE.PointsMaterial({
    color: new THREE.Color(temple.accent),
    size: 0.05, transparent: true, opacity: 0.65,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const particles = new THREE.Points(partGeo, partMat);
  scene.add(particles);

  // Click-on-box hit area: invisible larger box for easier targeting
  const hitArea = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 3, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitArea.position.y = 1.2;
  hitArea.userData.isBoxHit = true;
  boxGroup.add(hitArea);

  // Shake state
  const state = {
    shakeTime: 0,
    shakeIntensity: 0,
    revealing: false,
    revealTime: 0,
    glowStrength: 0,
  };

  // Click handler — raycast against the box
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const onMouse = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects([hitArea]);
    if (hits.length && typeof opts.onBoxClick === 'function') opts.onBoxClick();
  };
  renderer.domElement.addEventListener('click', onMouse);
  renderer.domElement.style.cursor = 'pointer';

  // Resize
  const onResize = () => {
    const W = container.clientWidth, H = container.clientHeight;
    renderer.setSize(W, H);
    camera.aspect = W / H; camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);
  const ro = new ResizeObserver(onResize);
  ro.observe(container);

  // Animate
  let raf, t = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    t += 0.016;

    // gentle camera orbit
    camera.position.x = Math.sin(t * 0.15) * 0.5;
    camera.lookAt(0, 0.6, 0);

    // ring breathe
    ring.material.opacity = 0.3 + Math.sin(t * 0.8) * 0.1;

    // particles drift
    const arr = partGeo.attributes.position.array;
    for (let i = 0; i < PCOUNT; i++) {
      arr[i*3+1] += partData[i].vy;
      arr[i*3] += Math.sin(t + partData[i].phase) * 0.001;
      if (arr[i*3+1] > 5.5) arr[i*3+1] = 0;
    }
    partGeo.attributes.position.needsUpdate = true;

    // lantern float (chinese)
    scene.traverse(o => {
      if (o.userData && o.userData.float) {
        o.position.y = o.userData.float.base + Math.sin(t * 1.2 + o.userData.float.phase) * 0.06;
      }
    });

    // shake animation
    if (state.shakeIntensity > 0) {
      state.shakeIntensity *= 0.88;
      boxGroup.position.x = (Math.random() - 0.5) * state.shakeIntensity;
      boxGroup.position.z = (Math.random() - 0.5) * state.shakeIntensity * 0.5;
      boxGroup.rotation.z = (Math.random() - 0.5) * state.shakeIntensity * 0.3;
      // sticks rattle
      sticks.forEach((s, i) => {
        if (s.userData.special && state.revealing) return;
        const h = s.userData.home;
        s.position.x = h.x + (Math.random() - 0.5) * state.shakeIntensity * 0.5;
        s.position.z = h.z + (Math.random() - 0.5) * state.shakeIntensity * 0.5;
        s.rotation.z = s.userData.homeRot.z + (Math.random() - 0.5) * state.shakeIntensity * 0.3;
      });
    } else {
      boxGroup.position.x *= 0.85; boxGroup.position.z *= 0.85;
      boxGroup.rotation.z *= 0.85;
    }

    // reveal animation: special stick rises out, then falls to the ground
    if (state.revealing) {
      state.revealTime += 0.016;
      const RISE = 0.40;
      const FALL = 1.60;
      const t = state.revealTime;

      const home    = special.userData.home;
      const homeRot = special.userData.homeRot;
      const yPeak   = 2.0;
      // Scroll lies on its side — cylinder radius 0.052 — yLand keeps the
      // scroll just above the dais (top of ground at y=0).
      const yLand   = 0.06;
      const xLand   = (Math.sign(home.x) || 1) * 0.35;
      const zLand   = 1.20;
      // Random tumble axis cached once so it stays stable across frames
      if (special.userData.tumble === undefined) {
        special.userData.tumble = (Math.random() - 0.5) * 0.6;
      }

      if (t < RISE) {
        // Rise: stick climbs above the box opening, tilting outward
        const k = t / RISE;
        const e = k * k * (3 - 2 * k);
        special.position.set(
          home.x + e * 0.10,
          home.y + e * (yPeak - home.y),
          home.z + e * 0.40,
        );
        special.rotation.x = homeRot.x + e * 0.5;
        special.rotation.z = homeRot.z + e * 0.25;
        special.rotation.y = homeRot.y;
      } else {
        // Fall: parabolic descent + rotation until stick lies flat on ground
        const k = Math.min(1, (t - RISE) / FALL);
        const eY = k * k;                     // accelerating fall (gravity-like)
        const eXZ = 1 - Math.pow(1 - k, 2);   // ease-out horizontal drift
        const fromX = home.x + 0.10;
        const fromZ = home.z + 0.40;
        special.position.set(
          fromX + (xLand - fromX) * eXZ,
          yPeak - (yPeak - yLand) * eY,
          fromZ + (zLand - fromZ) * eXZ,
        );
        // Rotate to lying flat — wide face DOWN, not on its edge.
        // rotation.y is the stick's spin around its long axis (after X tilt),
        // so fade it to 0 to lock the wide face parallel to the ground.
        special.rotation.x = (homeRot.x + 0.5) + (Math.PI / 2 - (homeRot.x + 0.5)) * eXZ;
        special.rotation.y = homeRot.y * (1 - eXZ);
        special.rotation.z = homeRot.z + 0.25 + special.userData.tumble * eXZ;
      }

      stickTipMat.emissiveIntensity = 0.2 + Math.min(1, t * 1.2) * 1.0;

      // Remaining sticks sink slightly inside the box
      sticks.forEach((s) => {
        if (s.userData.special) return;
        s.position.y = s.userData.home.y - Math.min(1, t * 1.4) * 0.08;
      });
    }

    renderer.render(scene, camera);
  };
  tick();

  return {
    dispose: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      renderer.domElement.removeEventListener('click', onMouse);
      renderer.dispose();
      container.removeChild(renderer.domElement);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      });
    },
    shake: () => { state.shakeIntensity = Math.min(0.35, state.shakeIntensity + 0.12); },
    revealStick: () => { state.revealing = true; state.revealTime = 0; },
  };
}


