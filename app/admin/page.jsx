"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function useBootstrap() {
  useEffect(() => {
    import('bootstrap/dist/js/bootstrap.bundle.min.js');
  }, []);
}

export default function AdminPage() {
  const router = useRouter();
  useBootstrap();
  const [accessToken, setAccessToken] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [stats, setStats] = useState(null);
  const [aliases, setAliases] = useState([]);
  const [domains, setDomains] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('disconnected');
  const [toast, setToast] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const ensureSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace('/admin/login');
        return;
      }
      setAccessToken(data.session.access_token || '');
      setUserEmail(data.session.user?.email || '');
      setSessionChecked(true);
    };
    ensureSession();
  }, [router]);

  const authHeaders = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

  async function fetchWithAdmin(path, options = {}) {
    const headers = { ...(options.headers || {}), ...authHeaders };
    if (options.body) headers['Content-Type'] = 'application/json';
    const res = await fetch(path, { cache: 'no-store', ...options, headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message = body.error || `Request failed with ${res.status}`;
      throw new Error(message);
    }
    return res.json();
  }

  const loadAll = async () => {
    if (!sessionChecked) return;
    if (!accessToken) return;
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        fetchWithAdmin('/api/admin/stats'),
        fetchWithAdmin('/api/admin/aliases'),
        fetchWithAdmin('/api/admin/domains'),
        fetchWithAdmin('/api/admin/logs?limit=50')
      ]);

      const [statsRes, aliasesRes, domainsRes, logsRes] = results;
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (aliasesRes.status === 'fulfilled') setAliases(aliasesRes.value.aliases || []);
      if (domainsRes.status === 'fulfilled') setDomains(domainsRes.value.domains || []);
      if (logsRes.status === 'fulfilled') setLogs(logsRes.value.logs || []);

      const anyError = results.some((r) => r.status === 'rejected');
      setStatus('connected');
      setToast(anyError ? '⚠ Some data failed to load' : '✓ Data loaded successfully');
    } catch (err) {
      console.error(err);
      setStatus('disconnected');
      setToast(`✗ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) loadAll();
  }, [accessToken, sessionChecked]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function handleAddDomain() {
    if (!newDomain.trim()) return;
    try {
      await fetchWithAdmin('/api/admin/domains', {
        method: 'POST',
        body: JSON.stringify({ name: newDomain.trim() })
      });
      setNewDomain('');
      await loadAll();
      setToast('✓ Domain added');
    } catch (err) {
      setToast(`✗ ${err.message}`);
    }
  }

  async function removeDomain(name) {
    if (!window.confirm(`Delete domain "${name}"?`)) return;
    try {
      await fetchWithAdmin(`/api/admin/domains/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      await loadAll();
      setToast('✓ Domain removed');
    } catch (err) {
      setToast(`✗ ${err.message}`);
    }
  }

  async function removeAlias(address) {
    try {
      await fetchWithAdmin(`/api/admin/aliases/${encodeURIComponent(address)}`, {
        method: 'DELETE'
      });
      await loadAll();
      setToast('✓ Alias removed');
    } catch (err) {
      setToast(`✗ ${err.message}`);
    }
  }

  async function clearAllLogs() {
    if (!window.confirm('Clear all logs? This cannot be undone.')) return;
    try {
      await fetchWithAdmin('/api/admin/logs', { method: 'DELETE' });
      await loadAll();
      setToast('✓ Logs cleared');
    } catch (err) {
      setToast(`✗ ${err.message}`);
    }
  }

  async function revokeToken() {
    if (!window.confirm('Revoke token? You will need to re-authenticate.')) return;
    try {
      await fetchWithAdmin('/auth/revoke', { method: 'POST' });
      setToast('✓ Token revoked');
    } catch (err) {
      setToast(`✗ ${err.message}`);
    }
  }

  return (
    <main style={{ background: '#f8fafc', minHeight: '100vh' }}>
      <header className="bg-white border-bottom sticky-top">
        <div className="container-xl py-3">
          <div className="d-flex align-items-center justify-content-between gap-3">
            <div className="d-flex align-items-center gap-2">
              <div className="bg-primary text-white d-flex align-items-center justify-content-center rounded" style={{ width: 40, height: 40 }}>
                <i className="bi bi-gear-fill" />
              </div>
              <h1 className="h5 mb-0">Admin Dashboard</h1>
            </div>
            <div className="d-flex align-items-center gap-2">
              <span className={`badge ${status === 'connected' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>
                <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.5rem' }} />
                {status === 'connected' ? 'Connected' : 'Disconnected'}
              </span>
              <Link href="/" className="btn btn-sm btn-outline-secondary">
                <i className="bi bi-arrow-left me-1" /> Back
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container-xl py-4">
        <div className="row mb-4">
          <div className="col-12">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h6 className="fw-bold mb-3">Admin Session</h6>
              <div className="row g-3 align-items-end">
                <div className="col-md-9">
                  <label className="form-label small fw-500">Signed in as</label>
                  <input
                    type="text"
                    className="form-control"
                    value={userEmail || 'Unknown'}
                    readOnly
                  />
                </div>
                <div className="col-md-3">
                  <button className="btn btn-primary w-100" onClick={loadAll} disabled={loading || !accessToken}>
                    <i className={`bi ${loading ? 'bi-hourglass-split' : 'bi-arrow-clockwise'} me-2`} />
                    {loading ? 'Loading...' : 'Reload'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {stats && (
          <div className="row g-3 mb-4">
            <div className="col-sm-6 col-lg-3">
              <div className="bg-white rounded-lg shadow-sm p-4 text-center">
                <div className="text-primary mb-2" style={{ fontSize: '1.5rem' }}>
                  <i className="bi bi-at" />
                </div>
                <h3 className="mb-1">{stats.totalAliases}</h3>
                <p className="text-muted small">Total Aliases</p>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="bg-white rounded-lg shadow-sm p-4 text-center">
                <div className="text-success mb-2" style={{ fontSize: '1.5rem' }}>
                  <i className="bi bi-arrow-up-right-circle" />
                </div>
                <h3 className="mb-1">{stats.totalHits}</h3>
                <p className="text-muted small">Total Hits</p>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="bg-white rounded-lg shadow-sm p-4 text-center">
                <div className="text-warning mb-2" style={{ fontSize: '1.5rem' }}>
                  <i className="bi bi-globe" />
                </div>
                <h3 className="mb-1">{stats.totalDomains}</h3>
                <p className="text-muted small">Domains</p>
              </div>
            </div>
            <div className="col-sm-6 col-lg-3">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <p className="text-muted small mb-1">Last Activity</p>
                <p className="mb-0 small fw-500">{stats.lastAliasCreatedAt?.split('T')[0] || '-'}</p>
              </div>
            </div>
          </div>
        )}

        <ul className="nav nav-tabs bg-white rounded-lg shadow-sm p-3 mb-4" role="tablist">
          <li className="nav-item">
            <button className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
              <i className="bi bi-diagram-3 me-2" /> Dashboard
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${activeTab === 'domains' ? 'active' : ''}`} onClick={() => setActiveTab('domains')}>
              <i className="bi bi-globe me-2" /> Domains
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${activeTab === 'aliases' ? 'active' : ''}`} onClick={() => setActiveTab('aliases')}>
              <i className="bi bi-at me-2" /> Aliases
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
              <i className="bi bi-clock-history me-2" /> Logs
            </button>
          </li>
        </ul>

        {activeTab === 'domains' && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <h6 className="fw-bold mb-3">Manage Domains</h6>
            <div className="input-group mb-3">
              <input className="form-control" placeholder="example.com" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
              <button className="btn btn-primary" onClick={handleAddDomain} disabled={!newDomain.trim()}>
                <i className="bi bi-plus-lg me-1" /> Add
              </button>
            </div>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {domains.length === 0 ? (
                <p className="text-muted small">No domains</p>
              ) : (
                domains.map((d) => (
                  <div key={d.name} className="d-flex align-items-center justify-content-between p-2 border-bottom">
                    <div>
                      <div className="fw-500">{d.name}</div>
                      <small className="text-muted">Created {d.createdAt?.split('T')[0]}</small>
                    </div>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => removeDomain(d.name)} disabled={loading}>
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'aliases' && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <h6 className="fw-bold mb-3">Recent Aliases (showing {Math.min(20, aliases.length)} of {aliases.length})</h6>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {aliases.length === 0 ? (
                <p className="text-muted small">No aliases</p>
              ) : (
                aliases.slice(0, 20).map((a) => (
                  <div key={a.address} className="d-flex align-items-center justify-content-between p-2 border-bottom">
                    <div className="flex-grow-1 min-width-0">
                      <div className="fw-500 text-break" style={{ fontSize: '0.9rem' }}>{a.address}</div>
                      <small className="text-muted">Hits: {a.hits || 0}</small>
                    </div>
                    <button className="btn btn-sm btn-outline-danger ms-2" onClick={() => removeAlias(a.address)} disabled={loading}>
                      <i className="bi bi-trash" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bold mb-0">Activity Log (latest 50)</h6>
              <button className="btn btn-sm btn-outline-danger" onClick={clearAllLogs} disabled={loading || logs.length === 0}>
                Clear All
              </button>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {logs.length === 0 ? (
                <p className="text-muted small">No logs</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-hover">
                    <thead>
                      <tr>
                        <th style={{ fontSize: '0.8rem' }}>Email</th>
                        <th style={{ fontSize: '0.8rem' }}>Subject</th>
                        <th style={{ fontSize: '0.8rem' }}>From</th>
                        <th style={{ fontSize: '0.8rem' }}>Last Seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((l) => (
                        <tr key={l.id}>
                          <td style={{ fontSize: '0.8rem' }} className="text-nowrap">{l.alias?.split('@')[0] || '-'}</td>
                          <td style={{ fontSize: '0.8rem' }} className="text-truncate">{l.subject || '-'}</td>
                          <td style={{ fontSize: '0.8rem' }} className="text-truncate">{l.from || '-'}</td>
                          <td style={{ fontSize: '0.8rem' }} className="text-nowrap">{l.lastSeenAt?.split('T')[1]?.slice(0, 5) || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <h6 className="fw-bold mb-3">Token Management</h6>
            <div className="row g-2">
              <div className="col-sm-6">
                <Link href="/login" target="_blank" className="btn btn-primary w-100">
                  <i className="bi bi-google me-2" /> Start OAuth
                </Link>
              </div>
              <div className="col-sm-6">
                <button className="btn btn-outline-danger w-100" onClick={revokeToken} disabled={loading}>
                  <i className="bi bi-shield-x me-2" /> Revoke Token
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="position-fixed bottom-0 start-50 translate-middle-x mb-3 px-3 py-2 rounded-pill" style={{ background: toast.startsWith('✓') ? '#10b981' : '#ef4444', color: 'white', zIndex: 2000, fontSize: '0.875rem' }}>
          {toast}
        </div>
      )}
    </main>
  );
}
