// @ts-nocheck
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export function PageFrame({ children }) {
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

export function AppNav() {
  const location = useLocation();
  const current = location.pathname;
  const pageRoutes = ['/dashboard', '/login', '/setup', '/meditation', '/shake', '/result', '/shop', '/donate'];
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
