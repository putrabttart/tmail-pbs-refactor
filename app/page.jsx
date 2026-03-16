"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const DEFAULT_DOMAIN = '';
const AUTO_REFRESH_MS = 10000;

// â”€â”€â”€ Themes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const THEMES = {
  blue: {
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    primary: '#6366f1', primaryDark: '#4f46e5', primaryRgb: '99,102,241',
    pageBg: '#f1f5f9', cardBg: '#ffffff',
    cardShadow: '0 8px 36px rgba(102,126,234,0.15)',
    border: '#e2e8f0', textPrimary: '#0f172a', textMuted: '#64748b',
    itemHoverBg: '#f8f9ff', dark: false,
  },
  dark: {
    gradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    primary: '#818cf8', primaryDark: '#6366f1', primaryRgb: '129,140,248',
    pageBg: '#0f172a', cardBg: '#1e293b',
    cardShadow: '0 8px 36px rgba(0,0,0,0.5)',
    border: '#334155', textPrimary: '#f1f5f9', textMuted: '#94a3b8',
    itemHoverBg: '#243044', dark: true,
  },
  green: {
    gradient: 'linear-gradient(135deg, #10b981 0%, #0d9488 100%)',
    primary: '#10b981', primaryDark: '#059669', primaryRgb: '16,185,129',
    pageBg: '#f0fdf8', cardBg: '#ffffff',
    cardShadow: '0 8px 36px rgba(16,185,129,0.13)',
    border: '#d1fae5', textPrimary: '#064e3b', textMuted: '#6b7280',
    itemHoverBg: '#f0fdf4', dark: false,
  },
  rose: {
    gradient: 'linear-gradient(135deg, #f43f5e 0%, #a855f7 100%)',
    primary: '#f43f5e', primaryDark: '#e11d48', primaryRgb: '244,63,94',
    pageBg: '#fff1f2', cardBg: '#ffffff',
    cardShadow: '0 8px 36px rgba(244,63,94,0.13)',
    border: '#fecdd3', textPrimary: '#881337', textMuted: '#6b7280',
    itemHoverBg: '#fff5f6', dark: false,
  },
  amber: {
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
    primary: '#f59e0b', primaryDark: '#d97706', primaryRgb: '245,158,11',
    pageBg: '#fffbeb', cardBg: '#ffffff',
    cardShadow: '0 8px 36px rgba(245,158,11,0.13)',
    border: '#fde68a', textPrimary: '#78350f', textMuted: '#6b7280',
    itemHoverBg: '#fefce8', dark: false,
  },
};

function randomAlias(length = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function useBootstrap() {
  useEffect(() => {
    import('bootstrap/dist/js/bootstrap.bundle.min.js');
  }, []);
}

function formatMessageDate(value) {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

export default function HomePage() {
  useBootstrap();
  const [address, setAddress] = useState('');
  const [localPart, setLocalPart] = useState(() => randomAlias());
  const [selectedDomain, setSelectedDomain] = useState(DEFAULT_DOMAIN);
  const [domains, setDomains] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState('');
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState('');
  const [messageFilter, setMessageFilter] = useState(null);
  const [theme, setTheme] = useState('blue');

  const t = THEMES[theme] || THEMES.blue;
  const displayedMessages = useMemo(() => (messages || []).slice(0, 3), [messages]);

  // Apply theme CSS variables to DOM
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bs-primary', t.primary);
    root.style.setProperty('--bs-primary-rgb', t.primaryRgb);
    root.style.setProperty('--bs-link-color', t.primary);
    root.style.setProperty('--bs-link-hover-color', t.primaryDark);
    if (t.dark) {
      root.setAttribute('data-bs-theme', 'dark');
    } else {
      root.removeAttribute('data-bs-theme');
    }
  }, [theme, t]);

  // Fetch active theme from server
  useEffect(() => {
    fetch('/api/theme')
      .then((r) => r.json())
      .then((d) => { if (d?.theme && THEMES[d.theme]) setTheme(d.theme); })
      .catch(() => {});
  }, []);

  const otpKeywordRe = /(otp|passcode|pass code|verification|verify|one[\s-]*time|2fa|mfa|auth|authentication|security code|login code|reset code|activation code|kode|kode verifikasi|kode otp|pin|token)/i;

  function normalizeOtpCandidate(raw) {
    const text = String(raw || '').trim();
    if (!text) return '';
    return text.replace(/[^a-zA-Z0-9]/g, '');
  }

  function formatOtpCandidate(raw) {
    return String(raw || '')
      .trim()
      .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '')
      .replace(/\s+/g, '-')
      .toUpperCase();
  }

  function scoreOtpCandidate({ code, idx, raw, input, seedScore = 0 }) {
    let score = seedScore;
    const len = code.length;
    const isNumeric = /^\d+$/.test(code);
    const hasLetter = /[a-zA-Z]/.test(code);
    const hasDigit = /\d/.test(code);
    const digitCount = (code.match(/\d/g) || []).length;

    if (!hasDigit) return -999;

    if (len === 6) score += 7;
    else if (len === 5 || len === 7) score += 5;
    else if (len === 4 || len === 8) score += 3;
    else score += 1;

    if (isNumeric) score += 2;
    if (hasLetter && hasDigit) score += 3;

    if (/^[A-Za-z0-9]{2,8}(?:-[A-Za-z0-9]{2,8}){1,2}$/.test(raw)) score += 6;
    if (/^\d{2,4}(?:[\s-]\d{2,4}){1,3}$/.test(raw)) score += 5;

    if (hasLetter && hasDigit && digitCount === 1 && len >= 8) score -= 8;
    if (hasLetter && !/[A-Z]/.test(raw)) score -= 2;

    if (/^(?:19|20)\d{2}$/.test(code)) score -= 6;
    if (/^(\d)\1{4,}$/.test(code)) score -= 4;
    if (/^\d{9,}$/.test(code)) score -= 5;

    const near = input.slice(Math.max(0, idx - 80), Math.min(input.length, idx + raw.length + 80));
    if (otpKeywordRe.test(near)) score += 10;
    if (/(do not share|jangan bagikan|expires?|expired|berlaku|valid|minutes?|menit)/i.test(near)) score += 2;
    if (/(invoice|order|amount|harga|total|rp\b|idr\b|usd\b)/i.test(near) && !otpKeywordRe.test(near)) score -= 3;

    return score;
  }

  function pickOtpFromText(text) {
    const input = String(text || '');
    if (!input) return null;

    const candidates = [];
    const seen = new Set();

    function pushCandidate(raw, idx, seedScore = 0) {
      const code = normalizeOtpCandidate(raw);
      const output = formatOtpCandidate(raw);
      if (!code || code.length < 4 || code.length > 12) return;
      if (!/\d/.test(code)) return;

      // Reject obvious phrase-like captures (too many words).
      if ((String(raw).match(/[\s-]/g) || []).length > 3) return;

      const key = `${code}:${idx}`;
      if (seen.has(key)) return;
      seen.add(key);

      const score = scoreOtpCandidate({ code, idx, raw: String(raw || ''), input, seedScore });
      if (score <= 0) return;

      candidates.push({ code, output, score, idx });
    }

    const contextualRe = /\b(?:otp|passcode|verification(?:\s*code)?|security\s*code|one[\s-]*time(?:\s*(?:password|pin|code))?|kode(?:\s*(?:otp|verifikasi|login))?|pin|token|2fa|mfa|auth(?:entication)?\s*code|confirmation\s*code)\b[^\r\nA-Za-z0-9]{0,20}([A-Za-z0-9]{2,8}(?:[\s-][A-Za-z0-9]{2,8}){0,2})/gi;
    const numericRe = /\b\d{4,8}\b/g;
    const groupedNumericRe = /\b\d{2,4}(?:[\s-]\d{2,4}){1,3}\b/g;
    const groupedAlphaNumRe = /\b[A-Za-z0-9]{2,8}(?:-[A-Za-z0-9]{2,8}){1,2}\b/g;

    let m;
    while ((m = contextualRe.exec(input)) !== null) pushCandidate(m[1], m.index, 9);
    while ((m = groupedNumericRe.exec(input)) !== null) pushCandidate(m[0], m.index, 6);
    while ((m = groupedAlphaNumRe.exec(input)) !== null) pushCandidate(m[0], m.index, 7);
    while ((m = numericRe.exec(input)) !== null) pushCandidate(m[0], m.index, 4);

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score || a.idx - b.idx);
    return candidates[0].output;
  }

  function htmlToText(html) {
    try {
      const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
      return doc?.body?.textContent || '';
    } catch {
      return '';
    }
  }

  async function copyToClipboard(text, options = {}) {
    const { successToast = 'âœ“ Copied to clipboard' } = options;
    try {
      // Method 1: Modern Clipboard API (desktop + some mobile browsers)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setToast(successToast);
        return;
      }
    } catch (err) {
      console.log('Clipboard API failed, trying fallback');
    }

    // Method 2: Fallback for older/mobile browsers
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      textarea.setSelectionRange(0, 99999); // For mobile
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) {
        setToast(successToast);
      } else {
        setToast('âœ— Copy failed');
      }
    } catch (err) {
      console.error('Copy failed:', err);
      setToast('âœ— Copy failed');
    }
  }

  async function copyOtpFromMessage(msg, options = {}) {
    const base = [
      msg?.subject || '',
      msg?.snippet || '',
      msg?.from || '',
      msg?.to || ''
    ].join('\n');
    const otp = pickOtpFromText(base);
    if (!otp) {
      setToast(options.notFoundToast || 'âœ— OTP not found');
      return;
    }
    await copyToClipboard(otp, { successToast: options.successToast || 'âœ“ OTP copied' });
  }

  async function copyOtpFromDetail() {
    if (!detail || detail.loading || detail.error) return;
    const combined = [
      detail.subject || '',
      detail.bodyText || '',
      htmlToText(detail.bodyHtml || ''),
      detail.from || ''
    ].join('\n');
    const otp = pickOtpFromText(combined);
    if (!otp) {
      setToast('âœ— OTP not found');
      return;
    }
    await copyToClipboard(otp, { successToast: 'âœ“ OTP copied' });
  }

  async function registerAlias(addr) {
    if (!addr || typeof addr !== 'string') return;
    const trimmed = addr.trim();
    if (!trimmed.includes('@')) return;
    try {
      const res = await fetch('/api/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: trimmed })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Alias registration failed');
      }
    } catch (e) {
      console.error('Failed to register alias', e);
      // Avoid noisy UI: only show this when user is actively doing an action
    }
  }

  async function refreshInbox(currentAddr = address, options = {}) {
    const { silent = false } = options;
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const res = await fetch(`/api/messages?alias=${encodeURIComponent(currentAddr)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to fetch messages');
      setMessages(data.messages || []);
      setMessageFilter(data.filter || null);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
      if (!silent) setError(err?.message || 'Failed to refresh messages');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function openMessage(id) {
    try {
      setDetail({ loading: true });
      const res = await fetch(`/api/messages/${id}`);
      if (!res.ok) throw new Error('Failed to fetch message detail');
      const data = await res.json();
      setDetail({ ...data, loading: false });
    } catch (err) {
      console.error(err);
      setDetail({ loading: false, error: 'Failed to load message content' });
    }
  }

  useEffect(() => {
    if (!address || !address.includes('@')) return undefined;
    registerAlias(address);
    refreshInbox(address);
    const timer = setInterval(() => refreshInbox(address, { silent: true }), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [address]);

  useEffect(() => {
    async function loadDomains() {
      try {
        const res = await fetch('/api/domains');
        const data = await res.json();
        const active = (data.domains || []).map((d) => d.name);
        setDomains(active);
        if (active.length > 0) {
          // ensure selectedDomain is valid
          if (!selectedDomain || !active.includes(selectedDomain)) setSelectedDomain(active[0]);
        }
      } catch (e) {
        console.error('Failed to load domains', e);
      }
    }
    loadDomains();
  }, []);

  useEffect(() => {
    if (!selectedDomain) return;
    const newAddr = `${localPart}@${selectedDomain}`;
    setAddress(newAddr);
  }, [localPart, selectedDomain]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  // â”€â”€â”€ Computed style helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const btnPrimary = {
    background: t.primary, borderColor: t.primary, color: '#fff',
    border: '1.5px solid', borderRadius: '10px', padding: '0.65rem 1.25rem',
    fontWeight: 600, cursor: 'pointer', display: 'inline-flex',
    alignItems: 'center', gap: '0.4rem', transition: 'opacity 0.15s', fontSize: '0.9rem',
  };
  const btnOutline = {
    background: 'transparent', border: `1.5px solid ${t.primary}`, color: t.primary,
    borderRadius: '10px', padding: '0.65rem 1rem', fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.15s', fontSize: '0.9rem',
  };
  const card = {
    background: t.cardBg, borderRadius: '20px',
    boxShadow: t.cardShadow, border: `1px solid ${t.border}`,
  };

  return (
    <div style={{ minHeight: '100vh', background: t.pageBg }}>
      {/* â”€â”€ Inbox item hover style â”€ */}
      <style>{`
        .inbox-msg-item { background: ${t.cardBg}; transition: background 0.15s; }
        .inbox-msg-item:hover { background: ${t.itemHoverBg} !important; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .theme-input::placeholder { color: ${t.textMuted}; opacity: 0.8; }
        .theme-select-wrap { position: relative; display: flex; align-items: center; }
        .theme-select {
          appearance: none !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          background-image: none !important;
          color: ${t.textPrimary} !important;
          background: ${t.pageBg} !important;
          border: none !important;
          box-shadow: none !important;
          font-family: inherit;
          line-height: 1.2;
          padding-right: 2rem !important;
        }
        .theme-select::-ms-expand { display: none; }
        .theme-select option { color: ${t.textPrimary}; background: ${t.cardBg}; }
        .theme-select-caret { position: absolute; right: 10px; pointer-events: none; color: ${t.textMuted}; font-size: 0.8rem; }
        .footer-link { color: ${t.primary}; text-decoration: none; font-weight: 600; }
        .footer-link:hover { color: ${t.primaryDark}; text-decoration: underline; }
      `}</style>

      {/* â”€â”€ Gradient Hero â”€ */}
      <div style={{ background: t.gradient, paddingBottom: '5rem' }}>
        <div className="container-xl">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 42, height: 42, background: 'rgba(255,255,255,0.18)',
                borderRadius: '12px', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className="bi bi-envelope-fill" style={{ color: '#fff', fontSize: '1.05rem' }} />
              </div>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.01em' }}>
                PBS Mail
              </span>
            </div>
            <Link href="/admin" style={{
              color: 'rgba(255,255,255,0.85)', textDecoration: 'none',
              fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem',
              background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.2)', borderRadius: '100px',
              padding: '0.4rem 0.9rem', fontWeight: 500,
            }}>
              <i className="bi bi-gear-fill" />
              <span className="d-none d-sm-inline">Login</span>
            </Link>
          </div>
          <div style={{ textAlign: 'center', padding: '0.25rem 0 1rem', color: '#fff' }}>
            <h1 style={{ fontWeight: 800, fontSize: 'clamp(1.4rem, 5vw, 2.4rem)', marginBottom: '0.5rem', lineHeight: 1.15 }}>
              Email Sementara, Tanpa Ribet
            </h1>
            <p style={{ opacity: 0.82, fontSize: '0.98rem', margin: '0 auto', maxWidth: 460 }}>
              Buat alias email instan. Terima, baca &amp; salin OTP langsung dari browser.
            </p>
          </div>
        </div>
      </div>

      {/* â”€â”€ Main content â”€ */}
      <div className="container-xl" style={{ marginTop: '-3.75rem', paddingBottom: '3rem' }}>
        <div className="row justify-content-center">
          <div className="col-12 col-lg-8 col-xl-7">

            {/* â”€â”€ Email Generator Card â”€ */}
            <div style={{ ...card, padding: '1.75rem', marginBottom: '1.25rem' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: t.textMuted, marginBottom: '0.875rem' }}>
                Alamat Email Anda
              </p>

              {/* Input group */}
              <div style={{
                display: 'flex', alignItems: 'stretch',
                border: `1.5px solid ${t.border}`, borderRadius: '12px',
                overflow: 'hidden', background: t.pageBg, marginBottom: '1rem',
              }}>
                <input
                  value={localPart}
                  onChange={(e) => setLocalPart((e.target.value || '').replace(/\s+/g, ''))}
                  style={{
                    flex: 1, border: 'none', background: 'transparent',
                    padding: '0.875rem 1rem', fontSize: '1rem', fontWeight: 500,
                    outline: 'none', color: t.textPrimary, minWidth: 0,
                  }}
                  className="theme-input"
                  placeholder="alias-kamu"
                  spellCheck="false"
                />
                <span style={{ padding: '0 0.4rem', color: t.textMuted, display: 'flex', alignItems: 'center', fontSize: '1rem' }}>@</span>
                <div className="theme-select-wrap">
                  <select
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(e.target.value)}
                    className="theme-select"
                    style={{
                      border: 'none', background: 'transparent',
                      appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                      backgroundImage: 'none',
                      padding: '0.875rem 2rem 0.875rem 0.35rem',
                      fontSize: '0.9rem', fontWeight: 500,
                      outline: 'none', cursor: 'pointer',
                      maxWidth: 170, minWidth: 140,
                    }}
                    aria-label="Pilih domain"
                  >
                    {(domains.length ? domains : [DEFAULT_DOMAIN]).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <span className="theme-select-caret">
                    <i className="bi bi-chevron-down" />
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  style={{ ...btnPrimary, flex: 1, justifyContent: 'center' }}
                  onClick={() => copyToClipboard(address)}
                  disabled={!address || !address.includes('@')}
                >
                  <i className="bi bi-clipboard" /> Salin Alamat
                </button>
                <button
                  style={btnOutline}
                  onClick={() => { setLocalPart(randomAlias(10)); setToast('âœ“ Alamat baru dibuat'); }}
                  disabled={!selectedDomain}
                  title="Buat alamat baru"
                >
                  <i className="bi bi-arrow-repeat" />
                  <span className="d-none d-sm-inline">Baru</span>
                </button>
              </div>

              {/* Address preview */}
              {address && address.includes('@') && (
                <div style={{
                  marginTop: '0.875rem', padding: '0.65rem 1rem',
                  background: t.pageBg, borderRadius: '8px',
                  border: `1px solid ${t.border}`,
                  fontSize: '0.85rem', color: t.textMuted,
                  fontFamily: 'monospace', wordBreak: 'break-all',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}>
                  <i className="bi bi-envelope" style={{ color: t.primary, flexShrink: 0 }} />
                  {address}
                </div>
              )}
            </div>

            {/* â”€â”€ Inbox Card â”€ */}
            <div style={{ ...card, overflow: 'hidden' }}>
              {/* Inbox header */}
              <div style={{
                padding: '1.1rem 1.5rem', borderBottom: `1px solid ${t.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: t.textPrimary }}>Kotak Masuk</span>
                    {messages.length > 0 && (
                      <span style={{
                        background: t.primary, color: '#fff',
                        borderRadius: '100px', fontSize: '0.68rem', fontWeight: 700,
                        padding: '0.1em 0.55em', lineHeight: 1.6,
                      }}>
                        {messages.length > 3 ? '3+' : messages.length}
                      </span>
                    )}
                  </div>
                  {messageFilter?.enabled && (
                    <p style={{ margin: 0, fontSize: '0.73rem', color: t.primary }}>Difilter oleh admin</p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {lastRefreshed && (
                    <span style={{ fontSize: '0.75rem', color: t.textMuted }}>{lastRefreshed}</span>
                  )}
                  <button
                    style={{ ...btnPrimary, padding: 0, width: 34, height: 34, borderRadius: '9px', justifyContent: 'center' }}
                    onClick={() => refreshInbox()}
                    disabled={loading}
                    title="Refresh"
                  >
                    <i className={`bi ${loading ? 'bi-hourglass-split' : 'bi-arrow-clockwise'}`} />
                  </button>
                </div>
              </div>

              {/* Error banner */}
              {error && (
                <div style={{
                  padding: '0.75rem 1.5rem', background: '#fff7ed', color: '#c2410c',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  fontSize: '0.85rem', borderBottom: `1px solid ${t.border}`,
                }}>
                  <i className="bi bi-exclamation-triangle-fill" />
                  <span>{error}</span>
                </div>
              )}

              {/* Messages */}
              <div style={{ minHeight: 190 }}>
                {loading && messages.length === 0 && (
                  <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: t.textMuted }}>
                    <div className="spinner-border spinner-border-sm mb-2" role="status">
                      <span className="visually-hidden">Memuat...</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>Memuat pesan...</p>
                  </div>
                )}

                {!loading && !error && messages.length === 0 && (
                  <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: '14px', margin: '0 auto 0.875rem',
                      background: t.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <i className="bi bi-inbox" style={{ fontSize: '1.5rem', color: t.textMuted }} />
                    </div>
                    <p style={{ color: t.textPrimary, fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                      Menunggu email masuk...
                    </p>
                    <p style={{ color: t.textMuted, fontSize: '0.8rem', marginBottom: 0 }}>
                      Refresh otomatis setiap {AUTO_REFRESH_MS / 1000} detik
                    </p>
                  </div>
                )}

                {messages.length > 0 && (
                  <div>
                    {displayedMessages.map((msg, idx) => (
                      <div
                        key={msg.id}
                        className="inbox-msg-item"
                        onClick={() => openMessage(msg.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openMessage(msg.id); }}
                        role="button"
                        tabIndex={0}
                        style={{
                          padding: '1rem 1.5rem',
                          borderBottom: idx < displayedMessages.length - 1 ? `1px solid ${t.border}` : 'none',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.35rem' }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{
                              fontWeight: 600, fontSize: '0.88rem', color: t.textPrimary,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {msg.subject || '(tanpa subjek)'}
                            </div>
                            {msg.from && (
                              <div style={{
                                fontSize: '0.76rem', color: t.textMuted, marginTop: '0.15rem',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {msg.from}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.73rem', color: t.textMuted, whiteSpace: 'nowrap' }}>
                              {formatMessageDate(msg.date)}
                            </span>
                            <button
                              type="button"
                              style={{ ...btnPrimary, padding: '0.3rem 0.65rem', fontSize: '0.75rem', borderRadius: '7px' }}
                              onClick={(e) => { e.stopPropagation(); copyOtpFromMessage(msg); }}
                              title="Salin OTP"
                            >
                              <i className="bi bi-clipboard-check" /> OTP
                            </button>
                          </div>
                        </div>
                        <p style={{
                          margin: 0, fontSize: '0.8rem', color: t.textMuted,
                          overflow: 'hidden', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5,
                        }}>
                          {msg.snippet || '(tidak ada pratinjau)'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <p style={{ textAlign: 'center', marginTop: '1.25rem', color: t.textMuted, fontSize: '0.78rem', marginBottom: 0 }}>
              Auto-refresh setiap {AUTO_REFRESH_MS / 1000} detik &bull; Maks 3 pesan terbaru
            </p>
          </div>
        </div>
      </div>

      {/* â”€â”€ Email Detail Modal â”€ */}
      {detail && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1040, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem', overflowY: 'auto' }}
          onClick={() => setDetail(null)}
        >
          <div
            style={{ ...card, width: '100%', maxWidth: 680, marginTop: '1rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h5 style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {detail.loading ? 'Memuat...' : detail.subject || '(tanpa subjek)'}
                </h5>
                {!detail.loading && !detail.error && (
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: t.textMuted }}>{detail.from}</p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  style={{ ...btnPrimary, padding: '0.35rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px' }}
                  onClick={copyOtpFromDetail}
                  disabled={detail.loading || Boolean(detail.error)}
                  title="Salin OTP"
                >
                  <i className="bi bi-clipboard-check" /> OTP
                </button>
                <button
                  onClick={() => setDetail(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, fontSize: '1.1rem', padding: '0.3rem', display: 'flex', alignItems: 'center' }}
                  aria-label="Tutup"
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>
            </div>
            <div style={{ padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
              {detail.loading && (
                <div style={{ textAlign: 'center', color: t.textMuted, padding: '3rem 0' }}>
                  <div className="spinner-border spinner-border-sm mb-2" role="status">
                    <span className="visually-hidden">Memuat...</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Memuat pesan...</p>
                </div>
              )}
              {detail.error && (
                <div style={{ background: '#fef2f2', color: '#b91c1c', borderRadius: 10, padding: '1rem', fontSize: '0.875rem' }}>
                  {detail.error}
                </div>
              )}
              {!detail.loading && !detail.error && (
                <>
                  <div style={{ background: t.pageBg, borderRadius: '10px', padding: '0.875rem 1rem', marginBottom: '1.25rem', border: `1px solid ${t.border}` }}>
                    <p style={{ margin: '0 0 0.25rem', fontSize: '0.78rem', color: t.textMuted }}>
                      <strong style={{ color: t.textPrimary }}>Dari:</strong> {detail.from}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: t.textMuted }}>
                      <strong style={{ color: t.textPrimary }}>Tanggal:</strong> {formatMessageDate(detail.date)}
                    </p>
                  </div>
                  <div className="email-body" style={{ color: t.textPrimary }}>
                    {detail.bodyHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: detail.bodyHtml }} />
                    ) : detail.bodyText ? (
                      <pre style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', wordWrap: 'break-word', color: t.textPrimary }}>
                        {detail.bodyText}
                      </pre>
                    ) : (
                      <p style={{ color: t.textMuted, fontSize: '0.875rem' }}>Tidak ada konten</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <footer style={{
        textAlign: 'center',
        padding: '1.5rem 1rem 2.5rem',
        color: t.textMuted,
        fontSize: '0.85rem'
      }}>
        Copyright 2026 |{' '}
        <a
          href="https://t.me/aryadwinata543"
          target="_blank"
          rel="noreferrer"
          className="footer-link"
        >
          Mas Arya
        </a>
      </footer>

      {/* â”€â”€ Toast â”€ */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: '#f1f5f9',
          padding: '0.6rem 1.25rem', borderRadius: '100px',
          fontSize: '0.85rem', fontWeight: 500, zIndex: 2000,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)', whiteSpace: 'nowrap',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
