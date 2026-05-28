// @ts-nocheck
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import './tokens.css';

declare global {
  interface Window { omelette?: { writeFile: (path: string, contents: string) => Promise<unknown> }; webkitAudioContext?: typeof AudioContext; THREE: typeof THREE; __tweaks?: any; }
}

window.THREE = THREE;
const ReactDOM = { createRoot, createPortal };
function defaultRealtimeUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/events`;
}
const REALTIME_URL = import.meta.env.VITE_REALTIME_URL || defaultRealtimeUrl();
const MQTT_SHAKE_TOPIC = 'v1/shake';
const MQTT_DETECTION_TOPIC = 'v1/detection';
const MQTT_SHAKE_EVENT = 'nimidd:mqtt-shake';
const MQTT_DETECTION_EVENT = 'nimidd:mqtt-detection';
const MQTT_STATUS_EVENT = 'nimidd:mqtt-status';

function publishMqttStatus(status) {
  window.dispatchEvent(new CustomEvent(MQTT_STATUS_EVENT, { detail: status }));
}

function isShakeTopic(topic) {
  return String(topic || '') === MQTT_SHAKE_TOPIC;
}


// DesignCanvas.tsx — Figma-ish design canvas wrapper
// Warm gray grid bg + Sections + Artboards + PostIt notes.
// Artboards are reorderable (grip-drag), deletable, labels/titles are
// inline-editable, and any artboard can be opened in a fullscreen focus
// overlay (←/→/Esc). State persists to a .design-canvas.state.json sidecar
// via the host bridge. No assets, no deps.
//
// Usage:
//   <DesignCanvas>
//     <DCSection id="onboarding" title="Onboarding" subtitle="First-run variants">
//       <DCArtboard id="a" label="A · Dusk" width={260} height={480}>…</DCArtboard>
//       <DCArtboard id="b" label="B · Minimal" width={260} height={480}>…</DCArtboard>
//     </DCSection>
//   </DesignCanvas>

const DC = {
  bg: '#f0eee9',
  grid: 'rgba(0,0,0,0.06)',
  label: 'rgba(60,50,40,0.7)',
  title: 'rgba(40,30,20,0.85)',
  subtitle: 'rgba(60,50,40,0.6)',
  postitBg: '#fef4a8',
  postitText: '#5a4a2a',
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
};

// One-time CSS injection (classes are dc-prefixed so they don't collide with
// the hosted design's own styles).
if (typeof document !== 'undefined' && !document.getElementById('dc-styles')) {
  const s = document.createElement('style');
  s.id = 'dc-styles';
  s.textContent = [
    '.dc-editable{cursor:text;outline:none;white-space:nowrap;border-radius:3px;padding:0 2px;margin:0 -2px}',
    '.dc-editable:focus{background:#fff;box-shadow:0 0 0 1.5px #c96442}',
    '[data-dc-slot]{transition:transform .18s cubic-bezier(.2,.7,.3,1)}',
    '[data-dc-slot].dc-dragging{transition:none;z-index:10;pointer-events:none}',
    '[data-dc-slot].dc-dragging .dc-card{box-shadow:0 12px 40px rgba(0,0,0,.25),0 0 0 2px #c96442;transform:scale(1.02)}',
    // isolation:isolate contains artboard content's z-indexes so a
    // z-indexed child (sticky navbar etc.) can't paint over .dc-header or
    // the .dc-menu popover that drops into the top of the card.
    '.dc-card{isolation:isolate;transition:box-shadow .15s,transform .15s}',
    '.dc-card *{scrollbar-width:none}',
    '.dc-card *::-webkit-scrollbar{display:none}',
    // Per-artboard header: grip + label on the left, delete/expand on the
    // right. Single flex row; when the artboard's on-screen width is too
    // narrow for both the label yields (ellipsis, then hidden entirely below
    // ~4ch via the container query) and the buttons stay on the row.
    '.dc-header{position:absolute;bottom:100%;left:-4px;margin-bottom:calc(4px * var(--dc-inv-zoom,1));z-index:2;',
    '  display:flex;align-items:center;container-type:inline-size}',
    '.dc-labelrow{display:flex;align-items:center;gap:4px;height:24px;flex:1 1 auto;min-width:0}',
    '.dc-grip{flex:0 0 auto;cursor:grab;display:flex;align-items:center;padding:5px 4px;border-radius:4px;transition:background .12s,opacity .12s}',
    '.dc-grip:hover{background:rgba(0,0,0,.08)}',
    '.dc-grip:active{cursor:grabbing}',
    '.dc-labeltext{flex:1 1 auto;min-width:0;cursor:pointer;border-radius:4px;padding:3px 6px;',
    '  display:flex;align-items:center;transition:background .12s;overflow:hidden}',
    // Below ~4ch of label room: hide the label entirely, and drop the grip to
    // hover-only (same reveal rule as .dc-btns) so a narrow header is clean
    // until the card is moused.
    '@container (max-width: 110px){',
    '  .dc-labeltext{display:none}',
    '  .dc-grip{opacity:0}',
    '  [data-dc-slot]:hover .dc-grip{opacity:1}',
    '}',
    '.dc-labeltext:hover{background:rgba(0,0,0,.05)}',
    '.dc-labeltext .dc-editable{overflow:hidden;text-overflow:ellipsis;max-width:100%}',
    '.dc-labeltext .dc-editable:focus{overflow:visible;text-overflow:clip}',
    '.dc-btns{flex:0 0 auto;margin-left:auto;display:flex;gap:2px;opacity:0;transition:opacity .12s}',
    '[data-dc-slot]:hover .dc-btns,.dc-btns:has(.dc-menu){opacity:1}',
    '.dc-expand,.dc-kebab{width:22px;height:22px;border-radius:5px;border:none;cursor:pointer;padding:0;',
    '  background:transparent;color:rgba(60,50,40,.7);display:flex;align-items:center;justify-content:center;',
    '  font:inherit;transition:background .12s,color .12s}',
    '.dc-expand:hover,.dc-kebab:hover{background:rgba(0,0,0,.06);color:#2a251f}',
    // Slot hosting an open menu floats above later siblings (which otherwise
    // paint on top — same z-index:auto, later DOM order) so the popup isn't
    // clipped by the next card.
    '[data-dc-slot]:has(.dc-menu){z-index:10}',
    '.dc-menu{position:absolute;top:100%;right:0;margin-top:4px;background:#fff;border-radius:8px;',
    '  box-shadow:0 8px 28px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.05);padding:4px;min-width:160px;z-index:10}',
    '.dc-menu button{display:block;width:100%;padding:7px 10px;border:0;background:transparent;',
    '  border-radius:5px;font-family:inherit;font-size:13px;font-weight:500;line-height:1.2;',
    '  color:#29261b;cursor:pointer;text-align:left;transition:background .12s;white-space:nowrap}',
    '.dc-menu button:hover{background:rgba(0,0,0,.05)}',
    '.dc-menu hr{border:0;border-top:1px solid rgba(0,0,0,.08);margin:4px 2px}',
    '.dc-menu .dc-danger{color:#c96442}',
    '.dc-menu .dc-danger:hover{background:rgba(201,100,66,.1)}',
    // Chrome (titles / labels / buttons) counter-scales against the viewport
    // zoom so it stays a constant on-screen size. --dc-inv-zoom is set by
    // DCViewport on every transform update and inherits to all descendants —
    // any overlay inside the world (e.g. a TweaksPanel on an artboard) can use
    // it the same way.
    //
    // The header uses transform:scale (out-of-flow, so layout impact doesn't
    // matter) with its world-space width set to card-width / inv-zoom so that
    // after counter-scaling its on-screen width exactly matches the card's —
    // that's what lets the container query + text-overflow behave against the
    // card's visible edge at every zoom level.
    //
    // The section head uses CSS zoom instead of transform so its layout box
    // grows with the counter-scale, pushing the card row down — otherwise the
    // constant-screen-size title would overflow into the (shrinking) world-
    // space gap and overlap the artboard headers at low zoom.
    '.dc-header{width:calc((100% + 4px) / var(--dc-inv-zoom,1));',
    '  transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom left}',
    '.dc-sectionhead{zoom:var(--dc-inv-zoom,1)}',
  ].join('\n');
  document.head.appendChild(s);
}

const DCCtx = React.createContext(null);

// Recursively unwrap React.Fragment so <>…</> grouping doesn't hide
// DCSection/DCArtboard children from the type-based walks below.
function dcFlatten(children) {
  const out = [];
  React.Children.forEach(children, (c) => {
    if (c && c.type === React.Fragment) out.push(...dcFlatten(c.props.children));
    else out.push(c);
  });
  return out;
}

// ─────────────────────────────────────────────────────────────
// DesignCanvas — stateful wrapper around the pan/zoom viewport.
// Owns runtime state (per-section order, renamed titles/labels, hidden
// artboards, focused artboard). Order/titles/labels/hidden persist to a
// .design-canvas.state.json
// sidecar next to the HTML. Reads go via plain fetch() so the saved
// arrangement is visible anywhere the HTML + sidecar are served together
// (omelette preview, direct link, downloaded zip). Writes go through the
// host's window.omelette bridge — editing requires the omelette runtime.
// Focus is ephemeral.
// ─────────────────────────────────────────────────────────────
const DC_STATE_FILE = '.design-canvas.state.json';

function DesignCanvas({ children, minScale, maxScale, style }) {
  const [state, setState] = React.useState({ sections: {}, focus: null });
  // Hold rendering until the sidecar read settles so the saved order/titles
  // appear on first paint (no source-order flash). didRead gates writes until
  // the read settles so the empty initial state can't clobber a slow read;
  // skipNextWrite suppresses the one echo-write that would otherwise follow
  // hydration.
  const [ready, setReady] = React.useState(false);
  const didRead = React.useRef(false);
  const skipNextWrite = React.useRef(false);

  React.useEffect(() => {
    let off = false;
    fetch('./' + DC_STATE_FILE)
      .then((r) => (r.ok ? r.json() : null))
      .then((saved) => {
        if (off || !saved || !saved.sections) return;
        skipNextWrite.current = true;
        setState((s) => ({ ...s, sections: saved.sections }));
      })
      .catch(() => {})
      .finally(() => { didRead.current = true; if (!off) setReady(true); });
    const t = setTimeout(() => { if (!off) setReady(true); }, 150);
    return () => { off = true; clearTimeout(t); };
  }, []);

  React.useEffect(() => {
    if (!didRead.current) return;
    if (skipNextWrite.current) { skipNextWrite.current = false; return; }
    const t = setTimeout(() => {
      window.omelette?.writeFile(DC_STATE_FILE, JSON.stringify({ sections: state.sections })).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [state.sections]);

  // Build registries synchronously from children so FocusOverlay can read
  // them in the same render. Fragments are flattened; wrapping in other
  // elements still opts out of focus/reorder.
  const registry = {};     // slotId -> { sectionId, artboard }
  const sectionMeta = {};  // sectionId -> { title, subtitle, slotIds[] }
  const sectionOrder = [];
  dcFlatten(children).forEach((sec) => {
    if (!sec || sec.type !== DCSection) return;
    const sid = sec.props.id ?? sec.props.title;
    if (!sid) return;
    sectionOrder.push(sid);
    const persisted = state.sections[sid] || {};
    const abs = [];
    dcFlatten(sec.props.children).forEach((ab) => {
      if (!ab || ab.type !== DCArtboard) return;
      const aid = ab.props.id ?? ab.props.label;
      if (aid) abs.push([aid, ab]);
    });
    // hidden is scoped to one source revision — when the agent regenerates
    // (artboard-ID set changes), prior deletes don't apply to new content.
    const srcKey = abs.map(([k]) => k).join('\x1f');
    const hidden = persisted.srcKey === srcKey ? (persisted.hidden || []) : [];
    const srcIds = [];
    abs.forEach(([aid, ab]) => {
      if (hidden.includes(aid)) return;
      registry[`${sid}/${aid}`] = { sectionId: sid, artboard: ab };
      srcIds.push(aid);
    });
    const kept = (persisted.order || []).filter((k) => srcIds.includes(k));
    sectionMeta[sid] = {
      title: persisted.title ?? sec.props.title,
      subtitle: sec.props.subtitle,
      slotIds: [...kept, ...srcIds.filter((k) => !kept.includes(k))],
    };
  });

  const api = React.useMemo(() => ({
    state,
    section: (id) => state.sections[id] || {},
    patchSection: (id, p) => setState((s) => ({
      ...s,
      sections: { ...s.sections, [id]: { ...s.sections[id], ...(typeof p === 'function' ? p(s.sections[id] || {}) : p) } },
    })),
    setFocus: (slotId) => setState((s) => ({ ...s, focus: slotId })),
  }), [state]);

  // Esc exits focus; any outside pointerdown commits an in-progress rename.
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') api.setFocus(null); };
    const onPd = (e) => {
      const ae = document.activeElement;
      if (ae && ae.isContentEditable && !ae.contains(e.target)) ae.blur();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPd, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPd, true);
    };
  }, [api]);

  return (
    <DCCtx.Provider value={api}>
      <DCViewport minScale={minScale} maxScale={maxScale} style={style}>{ready && children}</DCViewport>
      {state.focus && registry[state.focus] && (
        <DCFocusOverlay entry={registry[state.focus]} sectionMeta={sectionMeta} sectionOrder={sectionOrder} />
      )}
    </DCCtx.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// DCViewport — transform-based pan/zoom (internal)
//
// Input mapping (Figma-style):
//   • trackpad pinch  → zoom   (ctrlKey wheel; Safari gesture* events)
//   • trackpad scroll → pan    (two-finger)
//   • mouse wheel     → zoom   (notched; distinguished from trackpad scroll)
//   • middle-drag / primary-drag-on-bg → pan
//
// Transform state lives in a ref and is written straight to the DOM
// (translate3d + will-change) so wheel ticks don't go through React —
// keeps pans at 60fps on dense canvases.
// ─────────────────────────────────────────────────────────────
function DCViewport({ children, minScale = 0.1, maxScale = 8, style = {} }) {
  const vpRef = React.useRef(null);
  const worldRef = React.useRef(null);
  const tf = React.useRef({ x: 0, y: 0, scale: 1 });
  // Persist viewport across reloads so the user lands back where they were
  // after an agent edit or browser refresh. The sandbox origin is already
  // per-project; pathname keeps multiple canvas files in one project apart.
  const tfKey = 'dc-viewport:' + location.pathname;
  const saveT = React.useRef(0);

  const lastPostedScale = React.useRef();
  const apply = React.useCallback(() => {
    const { x, y, scale } = tf.current;
    const el = worldRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    // Exposed for zoom-invariant chrome (labels, buttons, TweaksPanel).
    el.style.setProperty('--dc-inv-zoom', String(1 / scale));
    // Keep the host toolbar's % readout in sync with the canvas scale. Pan
    // ticks leave scale unchanged — skip the cross-frame post for those.
    if (lastPostedScale.current !== scale) {
      lastPostedScale.current = scale;
      window.parent.postMessage({ type: '__dc_zoom', scale }, '*');
    }
    clearTimeout(saveT.current);
    saveT.current = setTimeout(() => {
      try { localStorage.setItem(tfKey, JSON.stringify(tf.current)); } catch {}
    }, 200);
  }, [tfKey]);

  React.useLayoutEffect(() => {
    const flush = () => {
      clearTimeout(saveT.current);
      try { localStorage.setItem(tfKey, JSON.stringify(tf.current)); } catch {}
    };
    try {
      const s = JSON.parse(localStorage.getItem(tfKey) || 'null');
      if (s && Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.scale)) {
        tf.current = { x: s.x, y: s.y, scale: Math.min(maxScale, Math.max(minScale, s.scale)) };
        apply();
      }
    } catch {}
    // Flush on pagehide and unmount so a reload within the 200ms debounce
    // window doesn't drop the last pan/zoom.
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, []);

  React.useEffect(() => {
    const vp = vpRef.current;
    if (!vp) return;

    const zoomAt = (cx, cy, factor) => {
      const r = vp.getBoundingClientRect();
      const px = cx - r.left, py = cy - r.top;
      const t = tf.current;
      const next = Math.min(maxScale, Math.max(minScale, t.scale * factor));
      const k = next / t.scale;
      // --dc-inv-zoom consumers (.dc-sectionhead's CSS zoom, each section's
      // marginBottom) reflow on every scale change, vertically shifting the
      // world layout — so a world point mathematically pinned under the cursor
      // drifts as you zoom (content creeps up on zoom-in, down on zoom-out).
      // Anchor the DOM element under the cursor instead: record its screen Y,
      // apply the transform + --dc-inv-zoom, then cancel whatever vertical
      // drift the reflow introduced so it stays put on screen.
      let marker = null, markerY0 = 0;
      if (k !== 1) {
        const hit = document.elementFromPoint(cx, cy);
        marker = hit && hit.closest ? hit.closest('[data-dc-slot],[data-dc-section]') : null;
        if (marker) markerY0 = marker.getBoundingClientRect().top;
      }
      // keep the world point under the cursor fixed
      t.x = px - (px - t.x) * k;
      t.y = py - (py - t.y) * k;
      t.scale = next;
      apply();
      if (marker) {
        // A pure zoom around (cx, cy) maps screen Y → cy + (Y - cy) * k. Any
        // departure after the --dc-inv-zoom reflow is the layout drift.
        const drift = marker.getBoundingClientRect().top - (cy + (markerY0 - cy) * k);
        if (Math.abs(drift) > 0.1) { t.y -= drift; apply(); }
      }
    };

    // Mouse-wheel vs trackpad-scroll heuristic. A physical wheel sends
    // line-mode deltas (Firefox) or large integer pixel deltas with no X
    // component (Chrome/Safari, typically multiples of 100/120). Trackpad
    // two-finger scroll sends small/fractional pixel deltas, often with
    // non-zero deltaX. ctrlKey is set by the browser for trackpad pinch.
    const isMouseWheel = (e) =>
      e.deltaMode !== 0 ||
      (e.deltaX === 0 && Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 40);

    const onWheel = (e) => {
      e.preventDefault();
      if (isGesturing) return; // Safari: gesture* owns the pinch — discard concurrent wheels
      if ((e.ctrlKey || e.metaKey) && !isMouseWheel(e)) {
        // trackpad pinch, or ctrl/cmd + smooth-scroll mouse. Notched
        // wheels fall through to the fixed-step branch below.
        zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.01));
      } else if (isMouseWheel(e)) {
        // notched mouse wheel — fixed-ratio step per click
        zoomAt(e.clientX, e.clientY, Math.exp(-Math.sign(e.deltaY) * 0.18));
      } else {
        // trackpad two-finger scroll — pan
        tf.current.x -= e.deltaX;
        tf.current.y -= e.deltaY;
        apply();
      }
    };

    // Safari sends native gesture* events for trackpad pinch with a smooth
    // e.scale; preferring these over the ctrl+wheel fallback gives a much
    // better feel there. No-ops on other browsers. Safari also fires
    // ctrlKey wheel events during the same pinch — isGesturing makes
    // onWheel drop those entirely so they neither zoom nor pan.
    let gsBase = 1;
    let isGesturing = false;
    const onGestureStart = (e) => { e.preventDefault(); isGesturing = true; gsBase = tf.current.scale; };
    const onGestureChange = (e) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, (gsBase * e.scale) / tf.current.scale);
    };
    const onGestureEnd = (e) => { e.preventDefault(); isGesturing = false; };

    // Drag-pan: middle button anywhere, or primary button on canvas
    // background (anything that isn't an artboard or an inline editor).
    let drag = null;
    const onPointerDown = (e) => {
      const onBg = !e.target.closest('[data-dc-slot], .dc-editable');
      if (!(e.button === 1 || (e.button === 0 && onBg))) return;
      e.preventDefault();
      vp.setPointerCapture(e.pointerId);
      drag = { id: e.pointerId, lx: e.clientX, ly: e.clientY };
      vp.style.cursor = 'grabbing';
    };
    const onPointerMove = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      tf.current.x += e.clientX - drag.lx;
      tf.current.y += e.clientY - drag.ly;
      drag.lx = e.clientX; drag.ly = e.clientY;
      apply();
    };
    const onPointerUp = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      vp.releasePointerCapture(e.pointerId);
      drag = null;
      vp.style.cursor = '';
    };

    // Host-driven zoom (toolbar % menu). Zooms around viewport centre so the
    // visible midpoint stays fixed — matching the host's iframe-zoom feel.
    const onHostMsg = (e) => {
      const d = e.data;
      if (d && d.type === '__dc_set_zoom' && typeof d.scale === 'number') {
        const r = vp.getBoundingClientRect();
        zoomAt(r.left + r.width / 2, r.top + r.height / 2, d.scale / tf.current.scale);
      } else if (d && d.type === '__dc_probe') {
        // Host's [readyGen] reset asks whether a canvas is present; it
        // fires on the iframe's native 'load', which for canvases with
        // images/fonts is after our mount-time announce, so re-announce.
        // Clear the pan-tick guard so apply() re-posts the current scale
        // even if it's unchanged — the host just reset dcScale to 1.
        window.parent.postMessage({ type: '__dc_present' }, '*');
        lastPostedScale.current = undefined;
        apply();
      }
    };
    window.addEventListener('message', onHostMsg);
    // Announce canvas mode so the host toolbar proxies its % control here
    // instead of scaling the iframe element (which would just shrink the
    // viewport window of an infinite canvas). The apply() that follows emits
    // the initial __dc_zoom so the toolbar % is correct before first pinch.
    // lastPostedScale reset mirrors the __dc_probe handler: the layout
    // effect's restore-path apply() may already have posted the restored
    // scale (before __dc_present), so clear the guard to re-post it in order.
    window.parent.postMessage({ type: '__dc_present' }, '*');
    lastPostedScale.current = undefined;
    apply();

    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('gesturestart', onGestureStart, { passive: false });
    vp.addEventListener('gesturechange', onGestureChange, { passive: false });
    vp.addEventListener('gestureend', onGestureEnd, { passive: false });
    vp.addEventListener('pointerdown', onPointerDown);
    vp.addEventListener('pointermove', onPointerMove);
    vp.addEventListener('pointerup', onPointerUp);
    vp.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('message', onHostMsg);
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('gesturestart', onGestureStart);
      vp.removeEventListener('gesturechange', onGestureChange);
      vp.removeEventListener('gestureend', onGestureEnd);
      vp.removeEventListener('pointerdown', onPointerDown);
      vp.removeEventListener('pointermove', onPointerMove);
      vp.removeEventListener('pointerup', onPointerUp);
      vp.removeEventListener('pointercancel', onPointerUp);
    };
  }, [apply, minScale, maxScale]);

  const gridSvg = `url("data:image/svg+xml,%3Csvg width='120' height='120' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M120 0H0v120' fill='none' stroke='${encodeURIComponent(DC.grid)}' stroke-width='1'/%3E%3C/svg%3E")`;
  return (
    <div
      ref={vpRef}
      className="design-canvas"
      style={{
        height: '100vh', width: '100vw',
        background: DC.bg,
        overflow: 'hidden',
        overscrollBehavior: 'none',
        touchAction: 'none',
        position: 'relative',
        fontFamily: DC.font,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div
        ref={worldRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          transformOrigin: '0 0',
          willChange: 'transform',
          width: 'max-content', minWidth: '100%',
          minHeight: '100%',
          padding: '60px 0 80px',
        }}
      >
        <div style={{ position: 'absolute', inset: -6000, backgroundImage: gridSvg, backgroundSize: '120px 120px', pointerEvents: 'none', zIndex: -1 }} />
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DCSection — editable title + h-row of artboards in persisted order
// ─────────────────────────────────────────────────────────────
function DCSection({ id, title, subtitle, children, gap = 48 }) {
  const ctx = React.useContext(DCCtx);
  const sid = id ?? title;
  const all = React.Children.toArray(dcFlatten(children));
  const artboards = all.filter((c) => c && c.type === DCArtboard);
  const rest = all.filter((c) => !(c && c.type === DCArtboard));
  const sec = (ctx && sid && ctx.section(sid)) || {};
  // Must match DesignCanvas's srcKey computation exactly (it filters falsy
  // IDs), or onDelete persists a srcKey that DesignCanvas never recognizes.
  const allIds = artboards.map((a) => a.props.id ?? a.props.label).filter(Boolean);
  const srcKey = allIds.join('\x1f');
  const hidden = sec.srcKey === srcKey ? (sec.hidden || []) : [];
  const srcOrder = allIds.filter((k) => !hidden.includes(k));

  const order = React.useMemo(() => {
    const kept = (sec.order || []).filter((k) => srcOrder.includes(k));
    return [...kept, ...srcOrder.filter((k) => !kept.includes(k))];
  }, [sec.order, srcOrder.join('|')]);

  const byId = Object.fromEntries(artboards.map((a) => [a.props.id ?? a.props.label, a]));

  // marginBottom counter-scales so the on-screen gap between sections stays
  // constant — otherwise at low zoom the (world-space) gap collapses while
  // the screen-constant sectionhead below it doesn't, and the title reads as
  // belonging to the section above. paddingBottom below is just enough for
  // the 24px artboard-header (abs-positioned above each card) plus ~8px, so
  // the title sits tight against its own row at every zoom.
  return (
    <div data-dc-section={sid}
      style={{ marginBottom: 'calc(80px * var(--dc-inv-zoom, 1))', position: 'relative' }}>
      <div style={{ padding: '0 60px' }}>
        <div className="dc-sectionhead" style={{ paddingBottom: 36 }}>
          <DCEditable tag="div" value={sec.title ?? title}
            onChange={(v) => ctx && sid && ctx.patchSection(sid, { title: v })}
            style={{ fontSize: 28, fontWeight: 600, color: DC.title, letterSpacing: -0.4, marginBottom: 6, display: 'inline-block' }} />
          {subtitle && <div style={{ fontSize: 16, color: DC.subtitle }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ display: 'flex', gap, padding: '0 60px', alignItems: 'flex-start', width: 'max-content' }}>
        {order.map((k) => (
          <DCArtboardFrame key={k} sectionId={sid} artboard={byId[k]} order={order}
            label={(sec.labels || {})[k] ?? byId[k].props.label}
            onRename={(v) => ctx && ctx.patchSection(sid, (x) => ({ labels: { ...x.labels, [k]: v } }))}
            onReorder={(next) => ctx && ctx.patchSection(sid, { order: next })}
            onDelete={() => ctx && ctx.patchSection(sid, (x) => ({
              hidden: [...(x.srcKey === srcKey ? (x.hidden || []) : []), k],
              srcKey,
            }))}
            onFocus={() => ctx && ctx.setFocus(`${sid}/${k}`)} />
        ))}
      </div>
      {rest}
    </div>
  );
}

// DCArtboard — marker; rendered by DCArtboardFrame via DCSection.
function DCArtboard() { return null; }

// Per-artboard export (kind: 'png' | 'html'). Both paths share the same
// self-contained clone: computed styles baked in, @font-face / <img> /
// inline-style background-image urls inlined as data URIs. PNG wraps the
// clone in foreignObject→canvas at 3× the artboard's natural width×height
// (same pipeline the host uses for page captures); HTML wraps it in a
// minimal standalone document. Both are independent of viewport zoom.
async function dcExport(node, w, h, name, kind) {
  try { await document.fonts.ready; } catch {}
  const toDataURL = (url) => fetch(url).then((r) => r.blob()).then((b) => new Promise((res) => {
    const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(url); fr.readAsDataURL(b);
  })).catch(() => url);

  // Collect @font-face rules. ss.cssRules throws SecurityError on
  // cross-origin sheets (e.g. fonts.googleapis.com) — in that case fetch
  // the CSS text directly (those endpoints send ACAO:*) and regex-extract
  // the blocks. @import and @media/@supports are walked so nested
  // @font-face rules aren't missed.
  const fontRules = [], pending = [], seen = new Set();
  const scrapeCss = (href) => {
    if (seen.has(href)) return; seen.add(href);
    pending.push(fetch(href).then((r) => r.text()).then((css) => {
      for (const m of css.match(/@font-face\s*{[^}]*}/g) || []) fontRules.push({ css: m, base: href });
      for (const m of css.matchAll(/@import\s+(?:url\()?['"]?([^'")\s;]+)/g))
        scrapeCss(new URL(m[1], href).href);
    }).catch(() => {}));
  };
  const walk = (rules, base) => {
    for (const r of rules) {
      if (r.type === CSSRule.FONT_FACE_RULE) fontRules.push({ css: r.cssText, base });
      else if (r.type === CSSRule.IMPORT_RULE && r.styleSheet) {
        const ibase = r.styleSheet.href || base;
        try { walk(r.styleSheet.cssRules, ibase); } catch { scrapeCss(ibase); }
      } else if (r.cssRules) walk(r.cssRules, base);
    }
  };
  for (const ss of document.styleSheets) {
    const base = ss.href || location.href;
    try { walk(ss.cssRules, base); } catch { if (ss.href) scrapeCss(ss.href); }
  }
  while (pending.length) await pending.shift();
  const fontCss = (await Promise.all(fontRules.map(async (rule) => {
    let out = rule.css, m; const re = /url\((['"]?)([^'")]+)\1\)/g;
    while ((m = re.exec(rule.css))) {
      if (m[2].indexOf('data:') === 0) continue;
      let abs; try { abs = new URL(m[2], rule.base).href; } catch { continue; }
      out = out.split(m[0]).join('url("' + await toDataURL(abs) + '")');
    }
    return out;
  }))).join('\n');

  const cloneStyled = (src) => {
    if (src.nodeType === 8 || (src.nodeType === 1 && src.tagName === 'SCRIPT')) return document.createTextNode('');
    const dst = src.cloneNode(false);
    if (src.nodeType === 1) {
      const cs = getComputedStyle(src); let txt = '';
      for (let i = 0; i < cs.length; i++) txt += cs[i] + ':' + cs.getPropertyValue(cs[i]) + ';';
      dst.setAttribute('style', txt + 'animation:none;transition:none;');
      if (src.tagName === 'CANVAS') try { const im = document.createElement('img'); im.src = src.toDataURL(); im.setAttribute('style', txt); return im; } catch {}
    }
    for (let c = src.firstChild; c; c = c.nextSibling) dst.appendChild(cloneStyled(c));
    return dst;
  };
  const clone = cloneStyled(node);
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  // Drop the card's own shadow/radius so the export is a flush w×h rect;
  // the artboard's own background (if any) is already in the computed style.
  clone.style.boxShadow = 'none'; clone.style.borderRadius = '0';

  const jobs = [];
  clone.querySelectorAll('img').forEach((el) => {
    const s = el.getAttribute('src');
    if (s && s.indexOf('data:') !== 0) jobs.push(toDataURL(el.src).then((d) => el.setAttribute('src', d)));
  });
  [clone, ...clone.querySelectorAll('*')].forEach((el) => {
    const bg = el.style.backgroundImage; if (!bg) return;
    let m; const re = /url\(["']?([^"')]+)["']?\)/g;
    while ((m = re.exec(bg))) {
      const tok = m[0], url = m[1];
      if (url.indexOf('data:') === 0) continue;
      jobs.push(toDataURL(url).then((d) => { el.style.backgroundImage = el.style.backgroundImage.split(tok).join('url("' + d + '")'); }));
    }
  });
  await Promise.all(jobs);

  const xml = new XMLSerializer().serializeToString(clone);
  const save = (blob, ext) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name + '.' + ext; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  if (kind === 'html') {
    const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + name + '</title>' +
      (fontCss ? '<style>' + fontCss + '</style>' : '') +
      '</head><body style="margin:0">' + xml + '</body></html>';
    return save(new Blob([html], { type: 'text/html' }), 'html');
  }

  // PNG: the SVG's own width/height must be the output resolution — an
  // <img>-loaded SVG rasterizes at its intrinsic size, so sizing it at 1×
  // and ctx.scale()-ing up would just upscale a 1× bitmap. viewBox maps the
  // w×h foreignObject onto the px·w × px·h SVG canvas so the browser renders
  // the HTML at full resolution.
  const px = 3;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w * px + '" height="' + h * px +
    '" viewBox="0 0 ' + w + ' ' + h + '"><foreignObject width="' + w + '" height="' + h + '">' +
    (fontCss ? '<style><![CDATA[' + fontCss + ']]></style>' : '') + xml + '</foreignObject></svg>';
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res; img.onerror = () => rej(new Error('svg load failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  const cv = document.createElement('canvas');
  cv.width = w * px; cv.height = h * px;
  cv.getContext('2d').drawImage(img, 0, 0);
  cv.toBlob((blob) => save(blob, 'png'), 'image/png');
}

function DCArtboardFrame({ sectionId, artboard, label, order, onRename, onReorder, onFocus, onDelete }) {
  const { id: rawId, label: rawLabel, width = 260, height = 480, children, style = {} } = artboard.props;
  const id = rawId ?? rawLabel;
  const ref = React.useRef(null);
  const cardRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  // ⋯ menu: close on any outside pointerdown. Two-click delete lives inside
  // the menu — first click arms the row, second commits; closing disarms.
  React.useEffect(() => {
    if (!menuOpen) { setConfirming(false); return; }
    const off = (e) => { if (!menuRef.current || !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('pointerdown', off, true);
    return () => document.removeEventListener('pointerdown', off, true);
  }, [menuOpen]);

  const doExport = (kind) => {
    setMenuOpen(false);
    if (!cardRef.current) return;
    const name = String(label || id || 'artboard').replace(/[^\w\s.-]+/g, '_');
    dcExport(cardRef.current, width, height, name, kind)
      .catch((e) => console.error('[design-canvas] export failed:', e));
  };

  // Live drag-reorder: dragged card sticks to cursor; siblings slide into
  // their would-be slots in real time via transforms. DOM order only
  // changes on drop.
  const onGripDown = (e) => {
    e.preventDefault(); e.stopPropagation();
    const me = ref.current;
    // translateX is applied in local (pre-scale) space but pointer deltas and
    // getBoundingClientRect().left are screen-space — divide by the viewport's
    // current scale so the dragged card tracks the cursor at any zoom level.
    const scale = me.getBoundingClientRect().width / me.offsetWidth || 1;
    const peers = Array.from(document.querySelectorAll(`[data-dc-section="${sectionId}"] [data-dc-slot]`));
    const homes = peers.map((el) => ({ el, id: el.dataset.dcSlot, x: el.getBoundingClientRect().left }));
    const slotXs = homes.map((h) => h.x);
    const startIdx = order.indexOf(id);
    const startX = e.clientX;
    let liveOrder = order.slice();
    me.classList.add('dc-dragging');

    const layout = () => {
      for (const h of homes) {
        if (h.id === id) continue;
        const slot = liveOrder.indexOf(h.id);
        h.el.style.transform = `translateX(${(slotXs[slot] - h.x) / scale}px)`;
      }
    };

    const move = (ev) => {
      const dx = ev.clientX - startX;
      me.style.transform = `translateX(${dx / scale}px)`;
      const cur = homes[startIdx].x + dx;
      let nearest = 0, best = Infinity;
      for (let i = 0; i < slotXs.length; i++) {
        const d = Math.abs(slotXs[i] - cur);
        if (d < best) { best = d; nearest = i; }
      }
      if (liveOrder.indexOf(id) !== nearest) {
        liveOrder = order.filter((k) => k !== id);
        liveOrder.splice(nearest, 0, id);
        layout();
      }
    };

    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      const finalSlot = liveOrder.indexOf(id);
      me.classList.remove('dc-dragging');
      me.style.transform = `translateX(${(slotXs[finalSlot] - homes[startIdx].x) / scale}px)`;
      // After the settle transition, kill transitions + clear transforms +
      // commit the reorder in the same frame so there's no visual snap-back.
      setTimeout(() => {
        for (const h of homes) { h.el.style.transition = 'none'; h.el.style.transform = ''; }
        if (liveOrder.join('|') !== order.join('|')) onReorder(liveOrder);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          for (const h of homes) h.el.style.transition = '';
        }));
      }, 180);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };

  return (
    <div ref={ref} data-dc-slot={id} style={{ position: 'relative', flexShrink: 0 }}>
      <div className="dc-header" data-omelette-chrome="" style={{ color: DC.label }} onPointerDown={(e) => e.stopPropagation()}>
        <div className="dc-labelrow">
          <div className="dc-grip" onPointerDown={onGripDown} title="Drag to reorder">
            <svg width="9" height="13" viewBox="0 0 9 13" fill="currentColor"><circle cx="2" cy="2" r="1.1"/><circle cx="7" cy="2" r="1.1"/><circle cx="2" cy="6.5" r="1.1"/><circle cx="7" cy="6.5" r="1.1"/><circle cx="2" cy="11" r="1.1"/><circle cx="7" cy="11" r="1.1"/></svg>
          </div>
          <div className="dc-labeltext" onClick={onFocus} title="Click to focus">
            <DCEditable value={label} onChange={onRename} onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 15, fontWeight: 500, color: DC.label, lineHeight: 1 }} />
          </div>
        </div>
        <div className="dc-btns">
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button className="dc-kebab" title="More" onClick={() => setMenuOpen((o) => !o)}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><circle cx="2.5" cy="6" r="1.1"/><circle cx="6" cy="6" r="1.1"/><circle cx="9.5" cy="6" r="1.1"/></svg>
            </button>
            {menuOpen && (
              <div className="dc-menu" onPointerDown={(e) => e.stopPropagation()}>
                <button onClick={() => doExport('png')}>Download PNG</button>
                <button onClick={() => doExport('html')}>Download HTML</button>
                <hr />
                <button className="dc-danger"
                  onClick={() => { if (confirming) { setMenuOpen(false); onDelete(); } else setConfirming(true); }}>
                  {confirming ? 'Click again to delete' : 'Delete'}
                </button>
              </div>
            )}
          </div>
          <button className="dc-expand" onClick={onFocus} title="Focus">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M7 1h4v4M5 11H1V7M11 1L7.5 4.5M1 11l3.5-3.5"/></svg>
          </button>
        </div>
      </div>
      <div ref={cardRef} className="dc-card"
        style={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.06)', overflow: 'hidden', width, height, background: '#fff', ...style }}>
        {children || <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 13, fontFamily: DC.font }}>{id}</div>}
      </div>
    </div>
  );
}

// Inline rename — commits on blur or Enter.
function DCEditable({ value, onChange, style, tag = 'span', onClick }) {
  const T = tag;
  return (
    <T className="dc-editable" contentEditable suppressContentEditableWarning
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={(e) => onChange && onChange(e.currentTarget.textContent)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
      style={style}>{value}</T>
  );
}

// ─────────────────────────────────────────────────────────────
// Focus mode — overlay one artboard; ←/→ within section, ↑/↓ across
// sections, Esc or backdrop click to exit.
// ─────────────────────────────────────────────────────────────
function DCFocusOverlay({ entry, sectionMeta, sectionOrder }) {
  const ctx = React.useContext(DCCtx);
  const { sectionId, artboard } = entry;
  const sec = ctx.section(sectionId);
  const meta = sectionMeta[sectionId];
  const peers = meta.slotIds;
  const aid = artboard.props.id ?? artboard.props.label;
  const idx = peers.indexOf(aid);
  const secIdx = sectionOrder.indexOf(sectionId);

  const go = (d) => { const n = peers[(idx + d + peers.length) % peers.length]; if (n) ctx.setFocus(`${sectionId}/${n}`); };
  const goSection = (d) => {
    // Sections whose artboards are all deleted have slotIds:[] — step past
    // them to the next non-empty section so ↑/↓ doesn't dead-end.
    const n = sectionOrder.length;
    for (let i = 1; i < n; i++) {
      const ns = sectionOrder[(((secIdx + d * i) % n) + n) % n];
      const first = sectionMeta[ns] && sectionMeta[ns].slotIds[0];
      if (first) { ctx.setFocus(`${ns}/${first}`); return; }
    }
  };

  React.useEffect(() => {
    const k = (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowUp') { e.preventDefault(); goSection(-1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); goSection(1); }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  });

  const { width = 260, height = 480, children } = artboard.props;
  const [vp, setVp] = React.useState({ w: window.innerWidth, h: window.innerHeight });
  React.useEffect(() => { const r = () => setVp({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r); }, []);
  const scale = Math.max(0.1, Math.min((vp.w - 200) / width, (vp.h - 260) / height, 2));

  const [ddOpen, setDd] = React.useState(false);
  const Arrow = ({ dir, onClick }) => (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ position: 'absolute', top: '50%', [dir]: 28, transform: 'translateY(-50%)',
        border: 'none', background: 'rgba(255,255,255,.08)', color: 'rgba(255,255,255,.9)',
        width: 44, height: 44, borderRadius: 22, fontSize: 18, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.18)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.08)')}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d={dir === 'left' ? 'M11 3L5 9l6 6' : 'M7 3l6 6-6 6'} /></svg>
    </button>
  );

  // Portal to body so position:fixed is the real viewport regardless of any
  // transform on DesignCanvas's ancestors (including the canvas zoom itself).
  return ReactDOM.createPortal(
    <div onClick={() => ctx.setFocus(null)}
      onWheel={(e) => e.preventDefault()}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(24,20,16,.6)', backdropFilter: 'blur(14px)',
        fontFamily: DC.font, color: '#fff' }}>

      {/* top bar: section dropdown (left) · close (right) */}
      <div onClick={(e) => e.stopPropagation()}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 72, display: 'flex', alignItems: 'flex-start', padding: '16px 20px 0', gap: 16 }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setDd((o) => !o)}
            style={{ border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', padding: '6px 8px',
              borderRadius: 6, textAlign: 'left', fontFamily: 'inherit' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3 }}>{meta.title}</span>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ opacity: .7 }}><path d="M2 4l3.5 3.5L9 4"/></svg>
            </span>
            {meta.subtitle && <span style={{ display: 'block', fontSize: 13, opacity: .6, fontWeight: 400, marginTop: 2 }}>{meta.subtitle}</span>}
          </button>
          {ddOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#2a251f', borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,.4)', padding: 4, minWidth: 200, zIndex: 10 }}>
              {sectionOrder.filter((sid) => sectionMeta[sid].slotIds.length).map((sid) => (
                <button key={sid} onClick={() => { setDd(false); const f = sectionMeta[sid].slotIds[0]; if (f) ctx.setFocus(`${sid}/${f}`); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                    background: sid === sectionId ? 'rgba(255,255,255,.1)' : 'transparent', color: '#fff',
                    padding: '8px 12px', borderRadius: 5, fontSize: 14, fontWeight: sid === sectionId ? 600 : 400, fontFamily: 'inherit' }}>
                  {sectionMeta[sid].title}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={() => ctx.setFocus(null)}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.12)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,.7)', width: 32, height: 32,
            borderRadius: 16, fontSize: 20, cursor: 'pointer', lineHeight: 1, transition: 'background .12s' }}>×</button>
      </div>

      {/* card centered, label + index below — only the card itself stops
          propagation so any backdrop click (including the margins around
          the card) exits focus */}
      <div
        style={{ position: 'absolute', top: 64, bottom: 56, left: 100, right: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: width * scale, height: height * scale, position: 'relative' }}>
          <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left', background: '#fff', borderRadius: 2, overflow: 'hidden',
            boxShadow: '0 20px 80px rgba(0,0,0,.4)' }}>
            {children || <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>{aid}</div>}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()} style={{ fontSize: 14, fontWeight: 500, opacity: .85, textAlign: 'center' }}>
          {(sec.labels || {})[aid] ?? artboard.props.label}
          <span style={{ opacity: .5, marginLeft: 10, fontVariantNumeric: 'tabular-nums' }}>{idx + 1} / {peers.length}</span>
        </div>
      </div>

      <Arrow dir="left" onClick={() => go(-1)} />
      <Arrow dir="right" onClick={() => go(1)} />

      {/* dots */}
      <div onClick={(e) => e.stopPropagation()}
        style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8 }}>
        {peers.map((p, i) => (
          <button key={p} onClick={() => ctx.setFocus(`${sectionId}/${p}`)}
            style={{ border: 'none', padding: 0, cursor: 'pointer', width: 6, height: 6, borderRadius: 3,
              background: i === idx ? '#fff' : 'rgba(255,255,255,.3)' }} />
        ))}
      </div>
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────────
// Post-it — absolute-positioned sticky note
// ─────────────────────────────────────────────────────────────
function DCPostIt({ children, top, left, right, bottom, rotate = -2, width = 180 }) {
  return (
    <div style={{
      position: 'absolute', top, left, right, bottom, width,
      background: DC.postitBg, padding: '14px 16px',
      fontFamily: '"Comic Sans MS", "Marker Felt", "Segoe Print", cursive',
      fontSize: 14, lineHeight: 1.4, color: DC.postitText,
      boxShadow: '0 2px 8px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
      transform: `rotate(${rotate}deg)`,
      zIndex: 5,
    }}>{children}</div>
  );
}

Object.assign(window, { DesignCanvas, DCSection, DCArtboard, DCPostIt });


// tweaks-panel.tsx
// Reusable Tweaks shell + form-control helpers.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setValues((prev) => ({ ...prev, ...edits }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({ title = 'Tweaks', children }) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({ x: 16, y: 16 });
  const PAD = 16;

  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y)),
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);

  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);

  React.useEffect(() => {
    const onMsg = (e) => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);
      else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  };

  const onDragStart = (e) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev) => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy),
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  if (!open) return null;
  return (
    <>
      <style>{__TWEAKS_STYLE}</style>
      <div ref={dragRef} className="twk-panel" data-omelette-chrome=""
           style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}>
        <div className="twk-hd" onMouseDown={onDragStart}>
          <b>{title}</b>
          <button className="twk-x" aria-label="Close tweaks"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={dismiss}>✕</button>
        </div>
        <div className="twk-body">
          {children}
        </div>
      </div>
    </>
  );
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({ label, children }) {
  return (
    <>
      <div className="twk-sect">{label}</div>
      {children}
    </>
  );
}

function TweakRow({ label, value, children, inline = false }) {
  return (
    <div className={inline ? 'twk-row twk-row-h' : 'twk-row'}>
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input type="range" className="twk-slider" min={min} max={max} step={step}
             value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </TweakRow>
  );
}

function TweakToggle({ label, value, onChange }) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl"><span>{label}</span></div>
      <button type="button" className="twk-toggle" data-on={value ? '1' : '0'}
              role="switch" aria-checked={!!value}
              onClick={() => onChange(!value)}><i /></button>
    </div>
  );
}

function TweakRadio({ label, value, options, onChange }) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = (o) => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({ 2: 16, 3: 10 }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = (s) => {
      const m = options.find((o) => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return <TweakSelect label={label} value={value} options={options}
                        onChange={(s) => onChange(resolve(s))} />;
  }
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const idx = Math.max(0, opts.findIndex((o) => o.value === value));
  const n = opts.length;

  const segAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor(((clientX - r.left - 2) / inner) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };

  const onPointerDown = (e) => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev) => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <TweakRow label={label}>
      <div ref={trackRef} role="radiogroup" onPointerDown={onPointerDown}
           className={dragging ? 'twk-seg dragging' : 'twk-seg'}>
        <div className="twk-seg-thumb"
             style={{ left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
                      width: `calc((100% - 4px) / ${n})` }} />
        {opts.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value}>
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

function TweakSelect({ label, value, options, onChange }) {
  return (
    <TweakRow label={label}>
      <select className="twk-field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </TweakRow>
  );
}

function TweakText({ label, value, placeholder, onChange }) {
  return (
    <TweakRow label={label}>
      <input className="twk-field" type="text" value={value} placeholder={placeholder}
             onChange={(e) => onChange(e.target.value)} />
    </TweakRow>
  );
}

function TweakNumber({ label, value, min, max, step = 1, unit = '', onChange }) {
  const clamp = (n) => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({ x: 0, val: 0 });
  const onScrubStart = (e) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, val: value };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = (ev) => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div className="twk-num">
      <span className="twk-num-lbl" onPointerDown={onScrubStart}>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step}
             onChange={(e) => onChange(clamp(Number(e.target.value)))} />
      {unit && <span className="twk-num-unit">{unit}</span>}
    </div>
  );
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}

const __TwkCheck = ({ light }) => (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3 7.2 5.8 10 11 4.2" fill="none" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          stroke={light ? 'rgba(0,0,0,.78)' : '#fff'} />
  </svg>
);

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({ label, value, options, onChange }) {
  if (!options || !options.length) {
    return (
      <div className="twk-row twk-row-h">
        <div className="twk-lbl"><span>{label}</span></div>
        <input type="color" className="twk-swatch" value={value}
               onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = (o) => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return (
    <TweakRow label={label}>
      <div className="twk-chips" role="radiogroup">
        {options.map((o, i) => {
          const colors = Array.isArray(o) ? o : [o];
          const [hero, ...rest] = colors;
          const sup = rest.slice(0, 4);
          const on = key(o) === cur;
          return (
            <button key={i} type="button" className="twk-chip" role="radio"
                    aria-checked={on} data-on={on ? '1' : '0'}
                    aria-label={colors.join(', ')} title={colors.join(' · ')}
                    style={{ background: hero }}
                    onClick={() => onChange(o)}>
              {sup.length > 0 && (
                <span>
                  {sup.map((c, j) => <i key={j} style={{ background: c }} />)}
                </span>
              )}
              {on && <__TwkCheck light={__twkIsLight(hero)} />}
            </button>
          );
        })}
      </div>
    </TweakRow>
  );
}

function TweakButton({ label, onClick, secondary = false }) {
  return (
    <button type="button" className={secondary ? 'twk-btn secondary' : 'twk-btn'}
            onClick={onClick}>{label}</button>
  );
}

Object.assign(window, {
  useTweaks, TweaksPanel, TweakSection, TweakRow,
  TweakSlider, TweakToggle, TweakRadio, TweakSelect,
  TweakText, TweakNumber, TweakColor, TweakButton,
});
// components.tsx — shared UI primitives + content data + doodle SVGs
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
// login.tsx — First screen. Two modes:
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
  if (user?.palmReading && Object.keys(user.palmReading).length > 0) return palmReadingFromLlm(user.palmReading);
  const seed = __palmHash((user?.name || '') + '|' + (user?.dob || ''));
  return PALM_LINES.map((L, i) => {
    const r = L.readings[(seed + i * 7) % L.readings.length];
    return { ...L, reading: r };
  });
}
window.analyzePalm = analyzePalm;

function palmReadingFromLlm(palmReading) {
  const fields = {
    heart: palmReading.heart_line,
    head: palmReading.head_line,
    life: palmReading.life_line,
  };
  return PALM_LINES.map((line) => ({
    ...line,
    reading: {
      tone: 'อ่านจากลายมือ',
      text: fields[line.id] || line.readings[0].text,
    },
  }));
}

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function requestPalmReading(palmDataUrl) {
  const blob = await dataUrlToBlob(palmDataUrl);
  const formData = new FormData();
  formData.append('image', blob, 'palm.jpg');
  formData.append('dry_run', 'false');
  const response = await fetch('/api/palm-reading', {
    method: 'POST',
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.message || 'อ่านลายมือไม่สำเร็จ');
  }
  return payload;
}

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
  }}/>;
}
window.LoginScreen = LoginScreen;

// ────────────────────────────
// RegisterForm — first-visit registration (the original LoginScreen body)
// ────────────────────────────
function RegisterForm({ onContinue, initial = {} }) {
  const [name, setName] = React.useState(initial.name || '');
  const [palm, setPalm] = React.useState(initial.palm || null); // dataURL
  const [readingStatus, setReadingStatus] = React.useState('idle');
  const [readingError, setReadingError] = React.useState('');
  const ready = name.trim().length >= 2 && palm;
  const analyzing = readingStatus === 'loading';

  const continueWithPalmReading = async () => {
    if (!ready || analyzing) return;
    const user = { name: name.trim(), palm };
    setReadingStatus('loading');
    setReadingError('');
    try {
      const result = await requestPalmReading(palm);
      const nextUser = {
        ...user,
        palmReading: result.reading,
        palmReadingStatus: result.status,
        palmReadingManifest: result.manifest,
        palmReadingPanel: result.llm_panel_png_base64
          ? `data:image/png;base64,${result.llm_panel_png_base64}`
          : null,
      };
      setReadingStatus(result.status === 'complete' ? 'complete' : 'fallback');
      onContinue(nextUser);
    } catch (error) {
      setReadingStatus('error');
      setReadingError(error?.message || 'ยังเชื่อมต่อระบบอ่านลายมือไม่ได้ จะใช้คำอ่านพื้นฐานแทน');
      onContinue({ ...user, palmReadingStatus: 'error' });
    }
  };

  return (
    <div className="proto" style={{ overflow: 'auto' }}>
      <Sparkles count={14}/>
      <BlobShape d={Blobs.one}  fill="rgba(242,181,160,.20)" style={{ width: 520, height: 520, top: -160, left: -160, filter: 'blur(20px)' }}/>
      <BlobShape d={Blobs.two}  fill="rgba(232,200,224,.22)" style={{ width: 600, height: 600, bottom: -220, right: -180, filter: 'blur(24px)' }}/>
      <BlobShape d={Blobs.three} fill="rgba(184,216,200,.16)" style={{ width: 460, height: 460, top: '20%', left: '55%', filter: 'blur(30px)' }}/>

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
              บอกชื่อและฝ่ามือของคุณ เพื่อให้พิธีเซียมซีปรับให้สอดคล้องกับช่วงชีวิตของคุณมากขึ้น
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

            {/* Palm capture */}
            <Field label="ลายมือของคุณ" hint="วางฝ่ามือไว้ในกรอบ แล้วกดถ่ายภาพ">
              <PalmCapture value={palm} onChange={setPalm}/>
            </Field>

            <button className="btn btn-primary" disabled={!ready || analyzing}
              onClick={continueWithPalmReading}
              style={{ width: '100%', marginTop: 22, padding: '16px 22px',
                borderRadius: 18, justifyContent: 'space-between' }}>
              <span>{analyzing ? 'กำลังอ่านลายมือ...' : 'อ่านลายมือของฉัน'}</span>
              {analyzing ? <Icon.sparkle size={18}/> : <Icon.arrowR size={18}/>}
            </button>

            {!ready && (
              <p style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 12, textAlign: 'center' }}>
                กรุณากรอกข้อมูลให้ครบเพื่อเริ่มต้น
              </p>
            )}
            {readingError && (
              <p style={{ fontSize: 11, color: 'var(--c-coral)', marginTop: 12, textAlign: 'center', lineHeight: 1.5 }}>
                {readingError}
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
  const palmConclusion = user?.palmReading?.conclusion || fallbackPalmConclusion(user);
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
      <BlobShape d={Blobs.one}  fill="rgba(242,181,160,.22)" style={{ width: 520, height: 520, top: -160, left: -160, filter: 'blur(20px)' }}/>
      <BlobShape d={Blobs.two}  fill="rgba(232,200,224,.22)" style={{ width: 600, height: 600, bottom: -220, right: -180, filter: 'blur(24px)' }}/>
      <BlobShape d={Blobs.three} fill="rgba(184,216,200,.16)" style={{ width: 460, height: 460, top: '20%', left: '55%', filter: 'blur(30px)' }}/>

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

          {palmConclusion && (
            <div className="card" style={{
              marginTop: 18,
              padding: 26,
              borderRadius: 24,
              background: 'linear-gradient(160deg, rgba(242,181,160,.18), rgba(184,216,200,.14))',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                top: -32,
                right: -28,
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'rgba(255,255,255,.45)',
                pointerEvents: 'none',
              }}/>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  background: 'var(--text-main)',
                  color: 'var(--text-on-dark)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon.sparkle size={16}/>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-soft)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                    Palm Reading
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 500, marginTop: 2 }}>
                    บทสรุปดวงชะตา
                  </h3>
                </div>
              </div>
              <p style={{
                fontSize: 15,
                lineHeight: 1.8,
                color: 'var(--text-main)',
                maxWidth: 980,
                textWrap: 'pretty',
              }}>
                {palmConclusion}
              </p>
            </div>
          )}

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

function fallbackPalmConclusion(user) {
  const name = user?.name ? `คุณ${user.name}` : 'เจ้าชะตา';
  return `${name}มีพื้นดวงที่ค่อยๆ เติบโตจากความอดทนและการเรียนรู้ เส้นทั้งสามสะท้อนคนที่มีใจละเอียด คิดรอบด้าน และยังมีพลังชีวิตให้เดินต่อได้แม้ผ่านช่วงกดดัน บทสรุปคือจังหวะนี้เหมาะกับการตั้งใจให้มั่น ใช้สติคุมใจ และเลือกทางที่ทำให้ตัวเองมั่นคงขึ้นทีละขั้น`;
}

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
// setup.tsx — Pre-Ritual Setup screen
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
// meditation.tsx — Phase 2: 1-minute mindful activity
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
// shake.tsx — Phase 3: Real Three.js shake ritual scene
// Stylized low-poly temple diorama. Click box to shake; meter fills; one
// stick rises out. Plays a soft bell tone on completion.

function ShakeScreen({ state, onContinue, onBack, detail = 'med', vol = 0.5 }) {
  const mountRef = React.useRef(null);
  const sceneApiRef = React.useRef(null);
  const onShakeRef = React.useRef(null);
  const [shakes, setShakes] = React.useState(0);
  const [phase, setPhase] = React.useState('ready'); // ready | shaking | revealed
  const [mqttStatus, setMqttStatus] = React.useState(window.__mqttStatus || 'connecting');
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

  React.useEffect(() => {
    const handleShake = () => {
      if (!sceneApiRef.current) return;
      onShakeRef.current?.();
    };
    const handleDetection = (event) => {
      sceneApiRef.current?.applyDetection?.(event.detail);
    };
    const handleStatus = (event) => setMqttStatus(event.detail);
    window.addEventListener(MQTT_SHAKE_EVENT, handleShake);
    window.addEventListener(MQTT_DETECTION_EVENT, handleDetection);
    window.addEventListener(MQTT_STATUS_EVENT, handleStatus);
    return () => {
      window.removeEventListener(MQTT_SHAKE_EVENT, handleShake);
      window.removeEventListener(MQTT_DETECTION_EVENT, handleDetection);
      window.removeEventListener(MQTT_STATUS_EVENT, handleStatus);
    };
  }, []);

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
            <div style={{ height: 1, background: 'var(--border-soft)', margin: '14px -22px' }}/>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span className="eyebrow">MQTT</span>
              <span title={`${REALTIME_URL} · ${MQTT_SHAKE_TOPIC} · ${MQTT_DETECTION_TOPIC}`} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                minWidth: 0,
                fontSize: 12,
                color: mqttStatus === 'connected' ? 'var(--c-mint-deep)' : 'var(--text-muted)',
              }}>
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: mqttStatus === 'connected' ? 'var(--c-mint-deep)' : 'var(--c-coral)',
                  flexShrink: 0,
                }}/>
                {mqttStatus}
              </span>
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

  // Solid bamboo base so the cup does not read as transparent when tilted.
  const bottom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.64, 0.64, 0.08, 36, 1, false),
    bambooNodeMat,
  );
  bottom.position.y = 0.04;
  bottom.castShadow = true;
  bottom.receiveShadow = true;
  boxGroup.add(bottom);

  const innerBottom = new THREE.Mesh(
    new THREE.CircleGeometry(0.58, 36),
    bambooInner,
  );
  innerBottom.rotation.x = -Math.PI / 2;
  innerBottom.position.y = 0.11;
  innerBottom.receiveShadow = true;
  boxGroup.add(innerBottom);

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
  });
  const skinShadow = new THREE.MeshStandardMaterial({
    color: 0xE5CCB5, roughness: 0.68, metalness: 0.02,
  });
  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0x3D2E2A, roughness: 0.85,
  });

  const armModelLoader = new GLTFLoader();
  const importedArmRig = {
    loading: false,
    loaded: false,
    scene: null,
    instance: null,
    targets: null,
    waiting: [],
  };
  const ENABLE_IMPORTED_ARM_RIG = false;

  // Helper: build a tapered cylinder segment between two world points
  function buildLimb(from, to, rTop, rBot, mat) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(rTop, rBot, 1, 18),
      mat,
    );
    m.castShadow = true;
    updateLimb(m, from, to);
    return m;
  }

  function updateLimb(mesh, from, to) {
    const len = Math.max(0.001, from.distanceTo(to));
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(to, from).normalize();
    mesh.scale.y = len;
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    mesh.position.copy(mid);
  }

  function solveTwoBoneIK(shoulder, target, side, previousElbow) {
    const upperLen = 2.05;
    const lowerLen = 1.78;
    const minFlex = 0.22;
    const maxFlex = 2.28;
    const toTarget = new THREE.Vector3().subVectors(target, shoulder);
    const minDistance = Math.sqrt(upperLen * upperLen + lowerLen * lowerLen - 2 * upperLen * lowerLen * Math.cos(maxFlex));
    const maxDistance = Math.sqrt(upperLen * upperLen + lowerLen * lowerLen - 2 * upperLen * lowerLen * Math.cos(minFlex));
    const distance = Math.min(Math.max(toTarget.length(), minDistance), maxDistance);
    const dir = toTarget.clone().normalize();
    const bendHint = new THREE.Vector3(side * 0.4, -0.92, 0.38).normalize();
    const planeNormal = new THREE.Vector3().crossVectors(dir, bendHint).normalize();
    const bendDir = new THREE.Vector3().crossVectors(planeNormal, dir).normalize();
    const along = (upperLen * upperLen - lowerLen * lowerLen + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(0, upperLen * upperLen - along * along));
    const solved = new THREE.Vector3()
      .copy(shoulder)
      .add(dir.multiplyScalar(along))
      .add(bendDir.multiplyScalar(height));
    if (!previousElbow) return solved;
    const minX = side > 0 ? 0.42 : -1.95;
    const maxX = side > 0 ? 1.95 : -0.42;
    solved.x = clampValue(solved.x, minX, maxX);
    solved.y = clampValue(solved.y, 0.34, 2.1);
    solved.z = clampValue(solved.z, 0.75, 3.5);
    return solved;
  }

  function aimBoneLikeObject(object, from, to) {
    const dir = new THREE.Vector3().subVectors(to, from).normalize();
    object.position.copy(from);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }

  function normalizeArmModel(model, side) {
    const wrapper = new THREE.Group();
    wrapper.name = side < 0 ? 'imported-static-arm-left' : 'imported-static-arm-right';
    wrapper.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const longest = Math.max(size.x, size.y, size.z) || 1;
    model.scale.setScalar(2.95 / longest);
    model.position.sub(center.multiplyScalar(model.scale.x));
    model.rotation.y = side < 0 ? Math.PI : 0;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m) => { m.transparent = false; m.opacity = 1; });
          else { child.material.transparent = false; child.material.opacity = 1; }
        }
      }
    });
    return wrapper;
  }

  function fitCombinedArmRig(model) {
    const wrapper = new THREE.Group();
    wrapper.name = 'imported-combined-human-arms';
    wrapper.add(model);

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const longest = Math.max(size.x, size.y, size.z) || 1;
    model.scale.setScalar(3.85 / longest);
    model.position.sub(center.multiplyScalar(model.scale.x));
    model.position.y += 0.18;
    model.position.z += 0.08;
    wrapper.rotation.x = Math.PI;
    wrapper.position.y = 0.48;
    wrapper.position.z = 0.1;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m) => { m.transparent = false; m.opacity = 1; });
          else { child.material.transparent = false; child.material.opacity = 1; }
        }
      }
    });
    return wrapper;
  }

  function findRigTargets(root) {
    const targets = {};
    root.traverse((child) => {
      if (!child.name) return;
      targets[child.name] = child;
    });
    return {
      leftWristIk: targets['wrist_ik.l'] || null,
      rightWristIk: targets['wrist_ik.r'] || null,
      leftArmTarget: targets['arm_target.l'] || null,
      rightArmTarget: targets['arm_target.r'] || null,
      leftShoulder: targets['shoulder.l'] || null,
      rightShoulder: targets['shoulder.r'] || null,
      leftBicep: targets['bicep.l'] || null,
      rightBicep: targets['bicep.r'] || null,
      leftWrist: targets['wrist.l'] || null,
      rightWrist: targets['wrist.r'] || null,
      leftForearm: targets['forearm.l'] || null,
      rightForearm: targets['forearm.r'] || null,
    };
  }

  function setObjectWorldPosition(object, position) {
    if (!object || !object.parent) return;
    object.parent.updateMatrixWorld(true);
    object.position.copy(object.parent.worldToLocal(position.clone()));
  }

  function setBoneWorldAim(bone, from, to, roll = 0) {
    if (!bone || !bone.parent) return;
    const dir = new THREE.Vector3().subVectors(to, from);
    if (dir.lengthSq() < 0.000001) return;
    dir.normalize();
    bone.parent.updateMatrixWorld(true);
    const desiredWorldQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    if (roll) desiredWorldQuat.multiply(new THREE.Quaternion().setFromAxisAngle(dir, roll));
    const parentWorldQuat = new THREE.Quaternion();
    bone.parent.getWorldQuaternion(parentWorldQuat);
    bone.quaternion.copy(parentWorldQuat.invert().multiply(desiredWorldQuat));
    bone.updateMatrixWorld(true);
  }

  function setBoneWorldPosition(bone, position) {
    if (!bone || !bone.parent) return;
    bone.parent.updateMatrixWorld(true);
    bone.position.copy(bone.parent.worldToLocal(position.clone()));
    bone.updateMatrixWorld(true);
  }

  function attachCombinedArmRig(ik) {
    if (!importedArmRig.scene) return false;
    if (!importedArmRig.instance) {
      importedArmRig.instance = fitCombinedArmRig(importedArmRig.scene);
      importedArmRig.targets = findRigTargets(importedArmRig.instance);
      scene.add(importedArmRig.instance);
    }
    ik.importedModel = importedArmRig.instance;
    ik.fallbackRoot.visible = false;
    return true;
  }

  function loadCombinedArmRig(ik) {
    if (!ENABLE_IMPORTED_ARM_RIG) {
      ik.fallbackRoot.visible = true;
      return false;
    }
    if (importedArmRig.loaded) return attachCombinedArmRig(ik);
    importedArmRig.waiting.push(ik);
    if (importedArmRig.loading) return true;
    importedArmRig.loading = true;
    const tryPaths = ['/models/arms.glb', '/models/human-arms.glb'];
    const tryNext = (index) => {
      if (index >= tryPaths.length) {
        importedArmRig.waiting.splice(0).forEach((waitingIk) => {
          loadStaticArmModel(waitingIk.side, waitingIk, waitingIk.fallbackRoot);
        });
        return;
      }
      armModelLoader.load(
        tryPaths[index],
        (gltf) => {
          importedArmRig.loaded = true;
          importedArmRig.scene = gltf.scene;
          importedArmRig.waiting.splice(0).forEach((waitingIk) => {
            attachCombinedArmRig(waitingIk);
          });
        },
        undefined,
        () => tryNext(index + 1),
      );
    };
    tryNext(0);
    return true;
  }

  function loadStaticArmModel(side, ik, fallbackRoot) {
    const sideName = side < 0 ? 'left' : 'right';
    armModelLoader.load(
      `/models/human-arm-${sideName}.glb`,
      (gltf) => {
        const imported = normalizeArmModel(gltf.scene, side);
        imported.visible = true;
        ik.modelRoot.add(imported);
        ik.importedModel = imported;
        fallbackRoot.visible = false;
      },
      undefined,
      () => {
        fallbackRoot.visible = true;
      },
    );
  }

  function buildHand(side) {
    const g = new THREE.Group();
    const fallbackRoot = new THREE.Group();
    g.add(fallbackRoot);

    // Joint positions in boxGroup-local coords. Hand position is at the
    // palm; fingertips land ON the cylinder's front surface so the camera
    // sees them gripping the visible side of the box.
    const shoulderAt = new THREE.Vector3(side * 1.55, 2.25, 4.35);
    const elbowAt    = new THREE.Vector3(side * 1.20, 1.05, 2.10);
    const wristAt    = new THREE.Vector3(side * 0.95, 0.78, 0.30);
    const palmAt     = new THREE.Vector3(side * 0.76, 0.78, 0.22);
    const modelRoot = new THREE.Group();
    modelRoot.position.copy(wristAt);
    g.add(modelRoot);

    const shoulderBone = new THREE.Bone();
    shoulderBone.name = side < 0 ? 'left_shoulder_ik' : 'right_shoulder_ik';
    const elbowBone = new THREE.Bone();
    elbowBone.name = side < 0 ? 'left_elbow_hinge_ik' : 'right_elbow_hinge_ik';
    const wristBone = new THREE.Bone();
    wristBone.name = side < 0 ? 'left_wrist_target_ik' : 'right_wrist_target_ik';
    shoulderBone.add(elbowBone);
    elbowBone.add(wristBone);
    g.add(shoulderBone);

    // ── Upper arm ───────────────────────────
    const upperArm = buildLimb(shoulderAt, elbowAt, 0.21, 0.17, skinShadow);
    fallbackRoot.add(upperArm);
    const shoulder = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 14, 12), skinShadow,
    );
    shoulder.position.copy(shoulderAt);
    fallbackRoot.add(shoulder);

    // ── Elbow joint ─────────────────────────
    const elbow = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 14, 12), skinShadow,
    );
    elbow.position.copy(elbowAt);
    elbow.castShadow = true;
    fallbackRoot.add(elbow);

    // ── Forearm ─────────────────────────────
    const forearm = buildLimb(elbowAt, wristAt, 0.16, 0.13, skinMat);
    fallbackRoot.add(forearm);

    // ── Sleeve cuff (dark band where shirt ends at wrist) ──
    const cuffDir = new THREE.Vector3().subVectors(wristAt, elbowAt).normalize();
    const cuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.16, 0.14, 18), sleeveMat,
    );
    cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), cuffDir);
    cuff.position.copy(wristAt).add(cuffDir.clone().multiplyScalar(-0.10));
    fallbackRoot.add(cuff);

    const handMesh = new THREE.Group();
    handMesh.position.copy(wristAt);
    fallbackRoot.add(handMesh);

    // ── Palm — block, oriented so its thin axis lies along radius ──
    // Default BoxGeometry axes after rotation.y = ±π/2: width(X) becomes depth(Z).
    const palm = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.34, 0.20), skinMat,
    );
    palm.position.set(0, 0, 0);
    palm.rotation.y = side * Math.PI * 0.5; // thin face toward box (radial)
    palm.castShadow = true;
    palm.receiveShadow = true;
    handMesh.add(palm);

    // Knuckle bumps on the back-of-hand (camera-facing side, +Z direction)
    for (let i = 0; i < 4; i++) {
      const k = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 10, 8), skinShadow,
      );
      k.position.set(
        side * -0.02, // slightly inboard so they read on back
        0.13 - i * 0.07,
        0.14,
      );
      handMesh.add(k);
    }

    // ── Thumb — base on top-inner of palm, wraps over the top edge of the
    // box and reaches forward. Two segments + tip sphere.
    const thumbBase = new THREE.Vector3(side * 0.62 - palmAt.x, 0.18, 0.02);
    const thumbMid  = new THREE.Vector3(side * 0.40 - palmAt.x, 0.32, 0.20);
    const thumbTipP = new THREE.Vector3(side * 0.16 - palmAt.x, 0.30, 0.42);
    handMesh.add(buildLimb(thumbBase, thumbMid, 0.070, 0.062, skinMat));
    handMesh.add(buildLimb(thumbMid,  thumbTipP, 0.062, 0.055, skinMat));
    const thumbJ = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), skinMat);
    thumbJ.position.copy(thumbMid); handMesh.add(thumbJ);
    const thumbTipS = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), skinMat);
    thumbTipS.position.copy(thumbTipP); handMesh.add(thumbTipS);

    // ── 4 fingers — curled around the side of the bamboo without entering
    // the cup wall. Keep every point outside radius 0.66 to avoid clipping
    // through the bamboo rings when the cup tilts.
    const Y_OFFS   = [0.10, 0.03, -0.05, -0.14];
    Y_OFFS.forEach((yOff, i) => {
      const spread = (i - 1.5) * 0.035;
      const knuckPos = new THREE.Vector3(
        side * (0.83 + Math.abs(spread) * 0.25) - palmAt.x,
        yOff,
        0.18 + spread - palmAt.z,
      );
      const midPos = new THREE.Vector3(
        side * 0.78 - palmAt.x,
        yOff - 0.015,
        -0.06 + spread - palmAt.z,
      );
      const fingerEndPos = new THREE.Vector3(
        side * 0.72 - palmAt.x,
        yOff - 0.025,
        -0.22 + spread * 0.7 - palmAt.z,
      );
      handMesh.add(buildLimb(knuckPos, midPos, 0.055, 0.05, skinMat));
      handMesh.add(buildLimb(midPos, fingerEndPos, 0.05, 0.043, skinMat));
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.060, 10, 8), skinMat);
      k.position.copy(knuckPos); handMesh.add(k);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skinMat);
      tip.position.copy(fingerEndPos); handMesh.add(tip);
    });

    g.userData.ik = {
      side,
      shoulderAt,
      shoulder,
      elbow,
      upperArm,
      forearm,
      cuff,
      cuffDir,
      palm,
      handMesh,
      palmLocal: palmAt.clone(),
      gripLocal: new THREE.Vector3(side * 0.76, 0.78, 0.22),
      modelRoot,
      fallbackRoot,
      shoulderBone,
      elbowBone,
      wristBone,
      smoothWrist: wristAt.clone(),
      smoothElbow: elbowAt.clone(),
      smoothQuat: new THREE.Quaternion(),
      hingeLimits: { minFlex: 0.22, maxFlex: 2.28 },
    };
    loadCombinedArmRig(g.userData.ik);
    return g;
  }

  const handL = buildHand(-1);
  const handR = buildHand(+1);
  scene.add(handL);
  scene.add(handR);
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
    s.userData = {
      home: s.position.clone(),
      homeRot: s.rotation.clone(),
      vel: new THREE.Vector3(),
      angularVel: new THREE.Vector3(),
      wiggle: 0,
      special: false,
    };
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

  const clampValue = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));
  const identityQuat = new THREE.Quaternion();
  const MAX_CUP_TILT_RAD = Math.PI / 4;

  function limitCupTilt(quat) {
    const euler = new THREE.Euler().setFromQuaternion(quat, 'YXZ');
    const tilt = Math.hypot(euler.x, euler.z);
    if (tilt <= MAX_CUP_TILT_RAD) return quat;
    const scale = MAX_CUP_TILT_RAD / tilt;
    euler.x *= scale;
    euler.z *= scale;
    quat.setFromEuler(euler);
    return quat;
  }

  // Shake state
  const state = {
    shakeTime: 0,
    shakeIntensity: 0,
    motionForce: 0,
    accelBaseline: null,
    orientationSamples: [],
    gyroRot: { x: 0, y: 0, z: 0 },
    targetQuat: new THREE.Quaternion(),
    currentQuat: new THREE.Quaternion(),
    impulseQuat: new THREE.Quaternion(),
    vel: { x: 0, y: 0, z: 0 },
    angularVel: { x: 0, y: 0, z: 0 },
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

    // IMU-driven orientation. Detection samples are averaged before setting
    // targetQuat, then the cup uses slerp so orientation changes are smooth.
    state.currentQuat.slerp(state.targetQuat, 0.06);
    state.motionForce *= 0.82;
    state.vel.x = (state.vel.x - boxGroup.position.x * 0.09) * 0.82;
    state.vel.y = (state.vel.y - boxGroup.position.y * 0.08) * 0.84;
    state.vel.z = (state.vel.z - boxGroup.position.z * 0.09) * 0.82;
    boxGroup.position.x = clampValue(boxGroup.position.x + state.vel.x, -0.34, 0.34);
    boxGroup.position.y = clampValue(boxGroup.position.y + state.vel.y, -0.16, 0.22);
    boxGroup.position.z = clampValue(boxGroup.position.z + state.vel.z, -0.22, 0.22);
    state.angularVel.x *= 0.86;
    state.angularVel.y *= 0.88;
    state.angularVel.z *= 0.86;
    const angularStep = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      state.angularVel.x,
      state.angularVel.y,
      state.angularVel.z,
    ));
    state.impulseQuat.multiply(angularStep).normalize();
    state.impulseQuat.slerp(identityQuat, 0.05);

    // shake animation
    const jitter = state.shakeIntensity + state.motionForce;
    if (jitter > 0.001) {
      state.shakeIntensity *= 0.88;
    }
    sticks.forEach((s) => {
      if (s.userData.special && state.revealing) return;
      const h = s.userData.home;
      const hr = s.userData.homeRot;
      const v = s.userData.vel;
      const av = s.userData.angularVel;
      const cupImpulseX = state.vel.x * 0.35 + state.angularVel.z * 0.18;
      const cupImpulseZ = state.vel.z * 0.35 - state.angularVel.x * 0.18;

      v.x += -cupImpulseX + (Math.random() - 0.5) * jitter * 0.012;
      v.z += -cupImpulseZ + (Math.random() - 0.5) * jitter * 0.012;
      v.y += Math.abs(cupImpulseX + cupImpulseZ) * 0.012 + jitter * 0.004;
      v.x += (h.x - s.position.x) * 0.08;
      v.z += (h.z - s.position.z) * 0.08;
      v.y += (h.y - s.position.y) * 0.12;
      v.multiplyScalar(0.82);

      s.position.add(v);
      s.position.y = clampValue(s.position.y, 0.92, 1.2);
      const radius = Math.hypot(s.position.x, s.position.z);
      const maxRadius = 0.49;
      if (radius > maxRadius) {
        const scale = maxRadius / radius;
        s.position.x *= scale;
        s.position.z *= scale;
        v.x *= -0.35;
        v.z *= -0.35;
      }

      av.x += v.z * 0.18 + state.angularVel.x * 0.08;
      av.z += -v.x * 0.18 + state.angularVel.z * 0.08;
      av.y += state.angularVel.y * 0.04;
      av.multiplyScalar(0.78);

      s.rotation.x = clampValue(s.rotation.x + av.x + (hr.x - s.rotation.x) * 0.08, hr.x - 0.32, hr.x + 0.32);
      s.rotation.y = hr.y + clampValue((s.rotation.y - hr.y + av.y) * 0.9, -0.22, 0.22);
      s.rotation.z = clampValue(s.rotation.z + av.z + (hr.z - s.rotation.z) * 0.08, hr.z - 0.32, hr.z + 0.32);
    });
    boxGroup.quaternion.copy(state.currentQuat).multiply(state.impulseQuat);
    limitCupTilt(boxGroup.quaternion);
    if (jitter > 0.001) {
      const jitterQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
        (Math.random() - 0.5) * jitter * 0.08,
        (Math.random() - 0.5) * jitter * 0.08,
        (Math.random() - 0.5) * jitter * 0.22,
      ));
      boxGroup.quaternion.multiply(jitterQuat);
      limitCupTilt(boxGroup.quaternion);
    }

    [handL, handR].forEach((hand) => {
      const ik = hand.userData.ik;
      const shoulder = ik.shoulderAt;
      const targetWrist = boxGroup.localToWorld(ik.gripLocal.clone());
      ik.smoothWrist.lerp(targetWrist, 0.18);
      const elbowPos = solveTwoBoneIK(shoulder, ik.smoothWrist, ik.side, ik.smoothElbow);
      ik.smoothElbow.lerp(elbowPos, 0.16);

      updateLimb(ik.upperArm, shoulder, ik.smoothElbow);
      updateLimb(ik.forearm, ik.smoothElbow, ik.smoothWrist);
      ik.shoulder.position.copy(shoulder);
      ik.elbow.position.copy(ik.smoothElbow);

      const forearmDir = new THREE.Vector3().subVectors(ik.smoothWrist, ik.smoothElbow).normalize();
      ik.cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), forearmDir);
      ik.cuff.position.copy(ik.smoothWrist).add(forearmDir.clone().multiplyScalar(-0.1));

      const upperDir = new THREE.Vector3().subVectors(ik.smoothElbow, shoulder).normalize();
      const lowerDir = new THREE.Vector3().subVectors(ik.smoothWrist, ik.smoothElbow).normalize();
      const upperQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), upperDir);
      const lowerQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), lowerDir);
      ik.shoulderBone.position.copy(shoulder);
      ik.shoulderBone.quaternion.copy(upperQuat);
      ik.elbowBone.position.set(0, shoulder.distanceTo(ik.smoothElbow), 0);
      ik.elbowBone.quaternion.copy(upperQuat.clone().invert().multiply(lowerQuat));
      ik.wristBone.position.set(0, ik.smoothElbow.distanceTo(ik.smoothWrist), 0);
      ik.wristBone.quaternion.identity();

      ik.smoothQuat.slerp(boxGroup.quaternion, 0.2);
      if (importedArmRig.instance && ik.importedModel === importedArmRig.instance) {
        const targets = importedArmRig.targets;
        const shoulderBone = ik.side < 0 ? targets?.leftShoulder : targets?.rightShoulder;
        const bicepBone = ik.side < 0 ? targets?.leftBicep : targets?.rightBicep;
        const forearmBone = ik.side < 0 ? targets?.leftForearm : targets?.rightForearm;
        const wristBone = ik.side < 0 ? targets?.leftWrist : targets?.rightWrist;
        const wristTarget = ik.side < 0 ? targets?.leftWristIk : targets?.rightWristIk;
        const armTarget = ik.side < 0 ? targets?.leftArmTarget : targets?.rightArmTarget;
        const shoulderOffset = new THREE.Vector3(ik.side * -0.24, -0.18, -0.08);
        const modelShoulder = shoulder.clone().add(shoulderOffset);
        const modelElbow = ik.smoothElbow.clone().add(new THREE.Vector3(ik.side * -0.12, -0.04, -0.02));
        const modelWrist = ik.smoothWrist.clone().add(new THREE.Vector3(ik.side * -0.04, 0.02, 0.02));
        const elbowHint = modelElbow.clone().add(new THREE.Vector3(ik.side * 0.25, -0.08, 0.15));
        importedArmRig.instance.updateMatrixWorld(true);
        setBoneWorldPosition(shoulderBone, modelShoulder);
        setBoneWorldPosition(bicepBone, modelShoulder);
        setBoneWorldPosition(forearmBone, modelElbow);
        setBoneWorldPosition(wristBone, modelWrist);
        setBoneWorldAim(bicepBone, modelShoulder, modelElbow, ik.side * 0.04);
        setBoneWorldAim(forearmBone, modelElbow, modelWrist, ik.side * -0.1);
        setBoneWorldAim(wristBone, modelWrist, modelWrist.clone().add(new THREE.Vector3(ik.side * -0.08, 0.08, -0.35)), ik.side * 0.2);
        setObjectWorldPosition(wristTarget, modelWrist);
        setObjectWorldPosition(armTarget, elbowHint);
      } else {
        ik.modelRoot.position.copy(ik.smoothWrist);
        ik.modelRoot.quaternion.copy(ik.smoothQuat);
        ik.modelRoot.rotation.y += ik.side * Math.PI * 0.5;
      }

      ik.handMesh.position.copy(ik.smoothWrist);
      ik.handMesh.quaternion.copy(ik.smoothQuat);
    });

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
    applyDetection: (d) => {
      if (!d) return;
      const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v) || 0));
      const accelX = clamp(d.accel_x_g, -2, 2);
      const accelY = clamp(d.accel_y_g, -2, 2);
      const accelZ = clamp(d.accel_z_g, -2, 2);
      const gyroX = clamp(d.gyro_x_dps, -720, 720);
      const gyroY = clamp(d.gyro_y_dps, -720, 720);
      const gyroZ = clamp(d.gyro_z_dps, -720, 720);

      if (!state.accelBaseline) {
        state.accelBaseline = { x: accelX, y: accelY, z: accelZ };
      }
      const baselineAlpha = d.is_shaking ? 0.004 : 0.03;
      state.accelBaseline.x += (accelX - state.accelBaseline.x) * baselineAlpha;
      state.accelBaseline.y += (accelY - state.accelBaseline.y) * baselineAlpha;
      state.accelBaseline.z += (accelZ - state.accelBaseline.z) * baselineAlpha;

      const deltaAccelX = accelX - state.accelBaseline.x;
      const deltaAccelY = accelY - state.accelBaseline.y;
      const deltaAccelZ = accelZ - state.accelBaseline.z;
      const deltaAccelMagnitude = Math.hypot(deltaAccelX, deltaAccelY, deltaAccelZ);
      const accelForce = Math.max(0, deltaAccelMagnitude - 0.025) / 0.55;
      const gyroMagnitude = clamp(d.gyro_magnitude_dps ?? Math.hypot(gyroX, gyroY, gyroZ), 0, 720) / 720;
      const gyroForce = Math.max(0, gyroMagnitude - 0.004) * 0.18;
      const force = Math.max(accelForce, gyroForce);

      const dead = (value, threshold) => Math.abs(value) < threshold ? 0 : value;
      const filteredAccelX = dead(deltaAccelX, 0.025);
      const filteredAccelY = dead(deltaAccelY, 0.025);
      const filteredAccelZ = dead(deltaAccelZ, 0.025);
      const filteredGyroX = dead(gyroX, 2.0);
      const filteredGyroY = dead(gyroY, 2.0);
      const filteredGyroZ = dead(gyroZ, 2.0);

      state.gyroRot.x = clamp((state.gyroRot.x + filteredGyroX * 0.000045) * 0.9, -0.16, 0.16);
      state.gyroRot.y = clamp((state.gyroRot.y + filteredGyroY * 0.00003) * 0.9, -0.1, 0.1);
      state.gyroRot.z = clamp((state.gyroRot.z + filteredGyroZ * 0.000045) * 0.9, -0.16, 0.16);

      state.orientationSamples.push({
        x: clamp(-filteredAccelY * 0.16 + filteredAccelZ * 0.025 + state.gyroRot.x, -0.22, 0.22),
        y: state.gyroRot.y,
        z: clamp(filteredAccelX * 0.16 + state.gyroRot.z, -0.22, 0.22),
      });
      if (state.orientationSamples.length > 18) state.orientationSamples.shift();
      const avg = state.orientationSamples.reduce((acc, sample) => {
        acc.x += sample.x;
        acc.y += sample.y;
        acc.z += sample.z;
        return acc;
      }, { x: 0, y: 0, z: 0 });
      avg.x /= state.orientationSamples.length;
      avg.y /= state.orientationSamples.length;
      avg.z /= state.orientationSamples.length;
      state.targetQuat.setFromEuler(new THREE.Euler(avg.x, avg.y, avg.z, 'YXZ'));

      state.vel.x += filteredAccelY * 0.018 * (1 + accelForce);
      state.vel.y += filteredAccelZ * 0.008 * (1 + accelForce);
      state.vel.z += filteredAccelX * -0.014 * (1 + accelForce);
      state.angularVel.x += filteredAccelZ * 0.012 + filteredGyroX * 0.00008;
      state.angularVel.y += filteredGyroY * 0.00004;
      state.angularVel.z += -filteredAccelX * 0.018 + filteredGyroZ * 0.00008;
      state.motionForce = Math.min(0.26, Math.max(state.motionForce, force * (d.is_shaking ? 0.32 : 0.07)));
    },
    revealStick: () => { state.revealing = true; state.revealTime = 0; },
  };
}



const PRE_MOOD_SCORES = {
  'สงบ': 72,
  'กังวล': 32,
  'เหนื่อย': 28,
  'มีหวัง': 68,
  'สับสน': 36,
  'อยากได้คำแนะนำ': 48,
};

const POST_MOODS = ['โล่งใจ', 'สงบขึ้น', 'มีหวัง', 'ยังครุ่นคิด', 'ได้รับคำตอบ', 'อยากเริ่มใหม่'];

const POST_MOOD_SCORES = {
  'โล่งใจ': 76,
  'สงบขึ้น': 82,
  'มีหวัง': 78,
  'ยังครุ่นคิด': 52,
  'ได้รับคำตอบ': 74,
  'อยากเริ่มใหม่': 66,
};

function scoreMoods(moods, scores) {
  if (!moods || moods.length === 0) return 50;
  const total = moods.reduce((sum, mood) => sum + (scores[mood] ?? 50), 0);
  return Math.round(total / moods.length);
}

function SentimentEvaluation({ preMoods, postMoods, preScore, postScore, delta }) {
  const trend = delta > 4 ? 'ดีขึ้น' : delta < -4 ? 'ต้องดูแลต่อ' : 'ทรงตัว';
  const color = delta > 4 ? 'var(--c-mint-deep)' : delta < -4 ? 'var(--c-coral)' : 'var(--c-gold)';
  return (
    <div className="card card-soft" style={{ padding: 26 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>วิเคราะห์อารมณ์</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
        <h3 style={{ fontSize: 22, fontWeight: 500 }}>แนวโน้มหลังพิธี</h3>
        <span style={{ color, fontWeight: 600 }}>{trend}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
        <SentimentMetric label="ก่อนพิธี" score={preScore} moods={preMoods}/>
        <SentimentMetric label="หลังพิธี" score={postScore} moods={postMoods}/>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: 'rgba(61,46,42,.08)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, postScore))}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, var(--c-peach), ${color})`, transition: 'width .25s ease' }}/>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, marginTop: 14 }}>
        คะแนนนี้เป็นตัวอย่างการประเมินจาก mood chips เพื่อแสดงภาพการเปลี่ยนแปลง ไม่ใช่การวินิจฉัยทางการแพทย์
      </p>
    </div>
  );
}

function SentimentMetric({ label, score, moods }) {
  return (
    <div style={{ border: '1px solid var(--border-soft)', borderRadius: 18, padding: 16, background: 'rgba(255,255,255,.45)' }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 500, marginBottom: 8 }}>{score}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(moods && moods.length ? moods : ['ยังไม่เลือก']).slice(0, 3).map((m) => <span key={m} className="badge">{m}</span>)}
      </div>
    </div>
  );
}
// result.tsx — Phase 4: Fortune stick result
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
// shop.tsx — Lucky Wallpaper Shop
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
// donation.tsx — Online donation page
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

}// app.tsx — wires everything into a Design Canvas with Tweaks.

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

function DesignCanvasApp() {
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

// one-page.tsx — Single-page stacked view of all 4 phases.
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

const RITUAL_STATE_KEY = 'siamsi:ritual';

function useRitualState() {
  const [ritual, setRitual] = React.useState(() => {
    try {
      const raw = localStorage.getItem(RITUAL_STATE_KEY);
      return raw ? { ...DEFAULT_RITUAL, ...JSON.parse(raw) } : DEFAULT_RITUAL;
    } catch {
      return DEFAULT_RITUAL;
    }
  });

  React.useEffect(() => {
    try { localStorage.setItem(RITUAL_STATE_KEY, JSON.stringify(ritual)); } catch {}
  }, [ritual]);

  return [ritual, setRitual];
}

function useSharedTweaks() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    window.__tweaks = t;
    window.dispatchEvent(new Event('tweakchange'));
    document.documentElement.style.setProperty('--radius-card', t.radius + 'px');
    document.documentElement.style.setProperty('--radius-chip', Math.max(8, t.radius * 0.5) + 'px');
    document.documentElement.style.setProperty('--radius-input', Math.max(10, t.radius * 0.6) + 'px');
    document.documentElement.setAttribute('data-season', t.season);
  }, [t]);

  return [t, setTweak];
}

function PageFrame({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      height: '100vh',
      background: 'var(--bg-main)',
      color: 'var(--text-main)',
      fontFamily: 'var(--font-body)',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  );
}

function RitualPages() {
  const navigate = useNavigate();
  const location = useLocation();
  const [ritual, setRitual] = useRitualState();
  const [t, setTweak] = useSharedTweaks();
  const showPageTweaks = !['/journey', '/canvas'].includes(location.pathname);

  const go = (path) => navigate(path);
  const restart = () => {
    setRitual((r) => ({ ...DEFAULT_RITUAL, user: r.user }));
    go('/setup');
  };

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace/>}/>
        <Route path="/login" element={
          <PageFrame>
            <LoginScreen initial={ritual.user || {}}
              onContinue={(user) => { setRitual((r) => ({ ...r, user })); go('/setup'); }}/>
          </PageFrame>
        }/>
        <Route path="/setup" element={
          <PageFrame>
            <SetupScreen state={ritual} setState={setRitual} onContinue={() => go('/meditation')}/>
          </PageFrame>
        }/>
        <Route path="/meditation" element={
          <PageFrame>
            <MeditationScreen state={ritual} onContinue={() => go('/shake')} onBack={() => go('/setup')}/>
          </PageFrame>
        }/>
        <Route path="/shake" element={
          <PageFrame>
            <ShakeScreen state={ritual} detail={t.detail} vol={t.musicVol / 100}
              onContinue={() => go('/result')} onBack={() => go('/meditation')}/>
          </PageFrame>
        }/>
        <Route path="/result" element={
          <PageFrame>
            <ResultScreen state={ritual} onRestart={restart} onBack={() => go('/shake')}
              onShop={() => go('/shop')} onDonate={() => go('/donate')}/>
          </PageFrame>
        }/>
        <Route path="/shop" element={
          <PageFrame>
            <ShopScreen state={ritual} suggestedCat={ritual.category} onBack={() => go('/result')}/>
          </PageFrame>
        }/>
        <Route path="/donate" element={
          <PageFrame>
            <DonationScreen state={ritual} onBack={() => go('/result')}/>
          </PageFrame>
        }/>
        <Route path="/journey" element={<OnePageApp/>}/>
        <Route path="/canvas" element={<DesignCanvasApp/>}/>
        <Route path="*" element={<Navigate to="/login" replace/>}/>
      </Routes>

      {showPageTweaks && <TweaksPanel title="Tweaks · พิธีเซียมซี">
        <TweakSection label="โทนสี / ฤดู">
          <TweakColor label="พาเล็ตต์"
            value={SEASON_PALETTES[t.season]}
            options={Object.values(SEASON_PALETTES)}
            onChange={(arr) => {
              const key = Object.keys(SEASON_PALETTES).find(k => SEASON_PALETTES[k].join() === arr.join());
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
      </TweaksPanel>}
    </>
  );
}

function AppNav() {
  const location = useLocation();
  const current = location.pathname;
  const pageRoutes = ['/login', '/setup', '/meditation', '/shake', '/result', '/shop', '/donate'];
  return (
    <nav style={{
      position: 'fixed', top: 16, right: 16, zIndex: 1000,
      display: 'flex', gap: 8, padding: 8, borderRadius: 999,
      background: 'rgba(255,255,255,.78)', backdropFilter: 'blur(18px) saturate(160%)',
      WebkitBackdropFilter: 'blur(18px) saturate(160%)',
      border: '1px solid rgba(255,255,255,.7)', boxShadow: 'var(--shadow-soft)',
      fontFamily: 'var(--font-body)',
    }}>
      {pageRoutes.map((path) => (
        <Link key={path} to={path} style={navLinkStyle(current === path || (current === '/' && path === '/login'))}>
          {path.slice(1)}
        </Link>
      ))}
      <Link to="/journey" style={navLinkStyle(current === '/journey')}>Journey</Link>
      <Link to="/canvas" style={navLinkStyle(current === '/canvas')}>Canvas</Link>
    </nav>
  );
}

function navLinkStyle(active) {
  return {
    padding: '8px 14px', borderRadius: 999, textDecoration: 'none', fontSize: 13,
    color: active ? 'var(--text-on-dark)' : 'var(--text-main)',
    background: active ? 'var(--text-main)' : 'transparent',
    transition: 'background .18s, color .18s',
  };
}

function RoutedApp() {
  React.useEffect(() => {
    let socket = null;
    let reconnectTimer = null;
    let stopped = false;

    const scheduleReconnect = () => {
      if (stopped || reconnectTimer) return;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 1000);
    };

    const connect = () => {
      window.__mqttStatus = socket ? 'reconnecting' : 'connecting';
      publishMqttStatus(window.__mqttStatus);

      socket = new WebSocket(REALTIME_URL);
      socket.addEventListener('open', () => {
        window.__mqttStatus = 'connected';
        publishMqttStatus('connected');
      });
      socket.addEventListener('message', (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        window.__lastMqttMessage = {
          topic: String(message.topic || ''),
          payload: message.payload || '',
          data: message.data || null,
          at: message.at || new Date().toISOString(),
        };
        if (message.topic === MQTT_SHAKE_TOPIC) {
          window.dispatchEvent(new CustomEvent(MQTT_SHAKE_EVENT));
        }
        if (message.topic === MQTT_DETECTION_TOPIC && message.data) {
          window.dispatchEvent(new CustomEvent(MQTT_DETECTION_EVENT, { detail: message.data }));
        }
      });
      socket.addEventListener('close', () => {
        window.__mqttStatus = 'closed';
        publishMqttStatus('closed');
        scheduleReconnect();
      });
      socket.addEventListener('error', () => {
        window.__mqttStatus = 'error';
        publishMqttStatus('error');
        socket?.close();
      });
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      };
    };
  }, []);

  return (
    <HashRouter>
      <AppNav/>
      <RitualPages/>
    </HashRouter>
  );
}

createRoot(document.getElementById('root')!).render(<RoutedApp/>);
