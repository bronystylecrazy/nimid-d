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

export { DashboardMetric, DashboardStartCard, DashboardBar, DashboardActivity };
