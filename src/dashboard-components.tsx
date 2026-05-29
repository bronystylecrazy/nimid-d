// @ts-nocheck
import React from 'react';
import { formatRelativeDay } from './dashboard-utils';

function DashboardMetric({ icon: IconCmp, label, value, tone }) {
  return (
    <div className="card" style={{ padding: 20, minHeight: 118 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{
          width: 38, height: 38, borderRadius: 12, background: tone,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconCmp size={18}/>
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 25, fontWeight: 600, lineHeight: 1.15 }}>
        {value}
      </div>
    </div>
  );
}

function DashboardStartCard({ icon: IconCmp, title, desc, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'grid', gridTemplateColumns: '42px 1fr', gap: 12, alignItems: 'center',
      padding: 14, borderRadius: 16, border: '1px solid var(--border-medium)',
      background: 'var(--surface-soft)', textAlign: 'left', color: 'var(--text-main)',
      cursor: 'pointer',
    }}>
      <span style={{
        width: 38, height: 38, borderRadius: 12, background: 'var(--surface-card)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'var(--shadow-soft)',
      }}>
        <IconCmp size={18}/>
      </span>
      <span>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{desc}</span>
      </span>
    </button>
  );
}

function DashboardBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>{value}%</span>
      </div>
      <div style={{ height: 9, borderRadius: 999, background: 'var(--surface-soft)', overflow: 'hidden', border: '1px solid var(--border-soft)' }}>
        <div style={{ height: '100%', width: `${value}%`, borderRadius: 999, background: color }}/>
      </div>
    </div>
  );
}

function DashboardInsightCard({ icon: IconCmp, label, value, detail, tone = 'var(--c-peach)' }) {
  return (
    <div style={{
      minHeight: 132,
      padding: 18,
      borderRadius: 18,
      border: '1px solid var(--border-soft)',
      background: 'rgba(255,255,255,.56)',
      display: 'grid',
      gridTemplateColumns: '40px 1fr',
      gap: 12,
      alignItems: 'start',
    }}>
      <span style={{
        width: 40,
        height: 40,
        borderRadius: 14,
        background: tone,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <IconCmp size={18}/>
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="eyebrow" style={{ display: 'block', marginBottom: 7 }}>{label}</span>
        <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 24, lineHeight: 1.18, fontWeight: 600, marginBottom: 8 }}>
          {value}
        </span>
        <span style={{ display: 'block', fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)' }}>
          {detail}
        </span>
      </span>
    </div>
  );
}

function DashboardDistribution({ items, resolveLabel, resolveTone }) {
  if (!items?.length) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>
        ยังไม่มีข้อมูลมากพอให้สรุปสัดส่วน
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((item, index) => {
        const tone = resolveTone?.(item.value, index) || 'var(--c-peach)';
        return (
          <div key={item.value} style={{ display: 'grid', gap: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
              <span style={{ fontWeight: 700 }}>{resolveLabel?.(item.value) || item.value}</span>
              <span style={{ color: 'var(--text-muted)' }}>{item.count} ครั้ง · {item.percent}%</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: 'var(--surface-soft)', overflow: 'hidden', border: '1px solid var(--border-soft)' }}>
              <div style={{ width: `${item.percent}%`, height: '100%', borderRadius: 999, background: tone }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DashboardNumberCloud({ title, items, emptyText }) {
  return (
    <div style={{
      padding: 16,
      borderRadius: 18,
      border: '1px solid var(--border-soft)',
      background: 'rgba(255,255,255,.5)',
      minHeight: 118,
    }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>{title}</div>
      {items?.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {items.map((item, index) => (
            <span key={`${item.value}-${index}`} style={{
              minWidth: 54,
              padding: '9px 11px',
              borderRadius: 999,
              background: index === 0 ? 'var(--c-gold)' : 'var(--surface-soft)',
              border: '1px solid var(--border-soft)',
              textAlign: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {item.value}
              <span style={{ display: 'block', marginTop: 2, fontFamily: 'inherit', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)' }}>
                {item.count}x
              </span>
            </span>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>{emptyText}</p>
      )}
    </div>
  );
}

function DashboardActivity({ record, cat, index }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 12, alignItems: 'stretch' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{
          width: 14, height: 14, borderRadius: '50%',
          background: index === 0 ? 'var(--c-gold)' : index === 1 ? 'var(--c-lavender)' : 'var(--surface-soft)',
          border: '1px solid var(--border-medium)',
        }}/>
        <span style={{ flex: 1, width: 1, background: 'var(--border-soft)', marginTop: 4 }}/>
      </div>
      <div style={{ border: '1px solid var(--border-medium)', borderRadius: 14, padding: '10px 12px', background: 'rgba(255,255,255,.55)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{formatRelativeDay(record.createdAt)}</div>
        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>
          {cat.name} · เลข {record.fortune?.num} {record.fortune?.title}
        </div>
      </div>
    </div>
  );
}

export { DashboardMetric, DashboardStartCard, DashboardBar, DashboardInsightCard, DashboardDistribution, DashboardNumberCloud, DashboardActivity };
