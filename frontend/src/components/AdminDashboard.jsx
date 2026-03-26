// components/AdminDashboard.jsx — Admin view: stats + all complaints + verdict system
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API, API_BASE } from '../config';

const FRAUD_TYPE_LABELS = {
  link: '🔗 Link', call: '📞 Call',
  ecommerce: '🛒 E-com', qr_code: '📱 QR', other: '⚠️ Other'
};

const AdminDashboard = ({ token }) => {
  const [stats, setStats] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [verdictLoading, setVerdictLoading] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/stats`, { headers });
      setStats(res.data);
    } catch (err) { console.error(err); }
  }, [token]);

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, per_page: 15 });
      if (filter !== 'all') params.set('status', filter);
      if (search.trim()) params.set('search', search.trim());
      const res = await axios.get(`${API}/admin/complaints?${params}`, { headers });
      setComplaints(res.data.complaints);
      setTotalPages(res.data.total_pages);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [token, page, filter, search]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

  const handleVerdict = async (id, verdict) => {
    setVerdictLoading(id);
    try {
      await axios.put(`${API}/admin/complaints/${id}/verdict`, { verdict }, { headers });
      await fetchComplaints();
      await fetchStats();
    } catch (err) { console.error(err); }
    finally { setVerdictLoading(null); }
  };

  const getCredibilityColor = (score) => {
    if (score >= 1.2) return '#22c55e';
    if (score >= 0.8) return '#06b6d4';
    if (score >= 0.5) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      <h2>🛡️ Admin Dashboard</h2>
      <p className="subtitle">Review complaints and manage fraud verdicts.</p>

      {/* Stats */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-icon">📊</div>
            <div className="stat-card-value">{stats.total_complaints}</div>
            <div className="stat-card-label">Total Complaints</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">⏳</div>
            <div className="stat-card-value" style={{ color: 'var(--warning)' }}>{stats.pending}</div>
            <div className="stat-card-label">Pending Review</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">🔴</div>
            <div className="stat-card-value" style={{ color: 'var(--danger)' }}>{stats.fraud_confirmed}</div>
            <div className="stat-card-label">Fraud Confirmed</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">🟢</div>
            <div className="stat-card-value" style={{ color: 'var(--success)' }}>{stats.not_fraud}</div>
            <div className="stat-card-label">Not Fraud</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">👥</div>
            <div className="stat-card-value">{stats.total_users}</div>
            <div className="stat-card-label">Total Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-icon">📱</div>
            <div className="stat-card-value">{stats.unique_numbers_reported}</div>
            <div className="stat-card-label">Unique Numbers</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        {['all', 'pending', 'fraud', 'not_fraud'].map(f => (
          <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => { setFilter(f); setPage(1); }}>
            {f === 'all' ? '📊 All' : f === 'pending' ? '⏳ Pending' : f === 'fraud' ? '🔴 Fraud' : '🟢 Not Fraud'}
          </button>
        ))}
        <input className="filter-search" placeholder="🔍 Search phone or txn ID..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-spinner"><div className="spinner" /><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>
      ) : complaints.length === 0 ? (
        <div className="glass-card empty-state">
          <div className="empty-state-icon">📭</div>
          <p className="empty-state-text">No complaints found.</p>
        </div>
      ) : (
        <div className="glass-card glass-card-full" style={{ padding: 0, overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Phone</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Reporter</th>
                <th>Credibility</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map(c => (
                <React.Fragment key={c.complaint_id}>
                  <tr>
                    <td className="table-phone" style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === c.complaint_id ? null : c.complaint_id)}>
                      {c.phone_number}
                    </td>
                    <td>{FRAUD_TYPE_LABELS[c.fraud_type] || c.fraud_type}</td>
                    <td className="table-amount">₹{Number(c.amount).toLocaleString()}</td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{c.reporter_username}</span>
                      <br />
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                        {c.reporter_verified || 0}✓ / {c.reporter_rejected || 0}✗ of {c.reporter_total_complaints || 0}
                      </span>
                    </td>
                    <td>
                      <div className="credibility-bar">
                        <div className="credibility-fill">
                          <div className="credibility-fill-inner" style={{
                            width: `${Math.min(100, (c.reporter_credibility / 2) * 100)}%`,
                            background: getCredibilityColor(c.reporter_credibility)
                          }} />
                        </div>
                        <span className="credibility-value" style={{ color: getCredibilityColor(c.reporter_credibility) }}>
                          {c.reporter_credibility?.toFixed(2)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${c.status === 'fraud' ? 'fraud' : c.status === 'not_fraud' ? 'safe' : 'pending'}`}>
                        {c.status === 'fraud' ? 'Fraud' : c.status === 'not_fraud' ? 'Safe' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      {c.status === 'pending' ? (
                        <div className="verdict-btns">
                          <button className="btn btn-danger btn-sm"
                            disabled={verdictLoading === c.complaint_id}
                            onClick={() => handleVerdict(c.complaint_id, 'fraud')}>
                            {verdictLoading === c.complaint_id ? '...' : '🔴 Fraud'}
                          </button>
                          <button className="btn btn-success btn-sm"
                            disabled={verdictLoading === c.complaint_id}
                            onClick={() => handleVerdict(c.complaint_id, 'not_fraud')}>
                            {verdictLoading === c.complaint_id ? '...' : '🟢 Safe'}
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>Resolved</span>
                      )}
                    </td>
                  </tr>
                  {expanded === c.complaint_id && (
                    <tr>
                      <td colSpan={7} style={{ padding: '0 1rem 1rem' }}>
                        <div className="complaint-expand animate-fade">
                          <div className="complaint-detail-item">
                            <span className="complaint-detail-label">Transaction ID</span>
                            <span className="complaint-detail-value">{c.txn_id}</span>
                          </div>
                          <div className="complaint-detail-item">
                            <span className="complaint-detail-label">Payment Method</span>
                            <span className="complaint-detail-value">{c.payment_method}</span>
                          </div>
                          <div className="complaint-detail-item">
                            <span className="complaint-detail-label">Weighted Vote</span>
                            <span className="complaint-detail-value">{c.weighted_vote?.toFixed(2)}</span>
                          </div>
                          <div className="complaint-detail-item">
                            <span className="complaint-detail-label">Date</span>
                            <span className="complaint-detail-value">{c.created_at ? new Date(c.created_at).toLocaleString() : '—'}</span>
                          </div>
                          {c.description && (
                            <div className="complaint-detail-item" style={{ gridColumn: '1/-1' }}>
                              <span className="complaint-detail-label">Description</span>
                              <span className="complaint-detail-value">{c.description}</span>
                            </div>
                          )}
                          {c.has_screenshot && c.screenshot_path && (
                            <div className="complaint-screenshot">
                              <span className="complaint-detail-label">Screenshot Evidence</span>
                              <img src={`${API_BASE}/api/screenshot/${c.screenshot_path}`} alt="Evidence" />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>←</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, page - 3), page + 2).map(p => (
            <button key={p} className={`pagination-btn ${p === page ? 'active' : ''}`}
              onClick={() => setPage(p)}>{p}</button>
          ))}
          <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>→</button>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
