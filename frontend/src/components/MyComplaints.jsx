// components/MyComplaints.jsx — User's own complaints with expandable details
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API, API_BASE } from '../config';

const FRAUD_TYPE_LABELS = {
  link: '🔗 Suspicious Link', call: '📞 Phone Call',
  ecommerce: '🛒 E-commerce', qr_code: '📱 QR Code', other: '⚠️ Other'
};
const PAYMENT_LABELS = {
  gpay: 'Google Pay', phonepay: 'PhonePe', paytm: 'Paytm', other: 'Other'
};

const MyComplaints = ({ token }) => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { fetchComplaints(); }, [filter]);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const res = await axios.get(`${API}/complaints/my${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComplaints(res.data);
    } catch (err) {
      console.error('Failed to fetch complaints', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => setExpanded(expanded === id ? null : id);

  if (loading) return <div className="loading-spinner"><div className="spinner" /><p style={{color:'var(--text-muted)'}}>Loading your complaints...</p></div>;

  return (
    <div className="animate-fade-in" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>📋 My Complaints</h2>
          <p className="subtitle" style={{ marginBottom: 0 }}>{complaints.length} total complaint{complaints.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        {['all', 'pending', 'fraud', 'not_fraud'].map(f => (
          <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}>
            {f === 'all' ? '📊 All' : f === 'pending' ? '⏳ Pending' : f === 'fraud' ? '🔴 Fraud' : '🟢 Not Fraud'}
          </button>
        ))}
      </div>

      {complaints.length === 0 ? (
        <div className="glass-card empty-state">
          <div className="empty-state-icon">📭</div>
          <p className="empty-state-text">No complaints found{filter !== 'all' ? ` with status "${filter}"` : ''}.</p>
        </div>
      ) : (
        <div className="glass-card glass-card-full" style={{ padding: '0', overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Phone Number</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((c) => (
                <React.Fragment key={c.complaint_id}>
                  <tr onClick={() => toggleExpand(c.complaint_id)} style={{ cursor: 'pointer' }}>
                    <td className="table-phone">{c.phone_number}</td>
                    <td>{FRAUD_TYPE_LABELS[c.fraud_type] || c.fraud_type}</td>
                    <td className="table-amount">₹{Number(c.amount).toLocaleString()}</td>
                    <td>
                      <span className={`badge badge-${c.status === 'fraud' ? 'fraud' : c.status === 'not_fraud' ? 'safe' : 'pending'}`}>
                        {c.status === 'fraud' ? '🔴 Fraud' : c.status === 'not_fraud' ? '🟢 Safe' : '⏳ Pending'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      {expanded === c.complaint_id ? '▲' : '▼'}
                    </td>
                  </tr>
                  {expanded === c.complaint_id && (
                    <tr>
                      <td colSpan={6} style={{ padding: '0 1rem 1rem' }}>
                        <div className="complaint-expand animate-fade">
                          <div className="complaint-detail-item">
                            <span className="complaint-detail-label">Transaction ID</span>
                            <span className="complaint-detail-value">{c.txn_id}</span>
                          </div>
                          <div className="complaint-detail-item">
                            <span className="complaint-detail-label">Payment Method</span>
                            <span className="complaint-detail-value">{PAYMENT_LABELS[c.payment_method] || c.payment_method}</span>
                          </div>
                          <div className="complaint-detail-item">
                            <span className="complaint-detail-label">Weighted Score</span>
                            <span className="complaint-detail-value">{c.weighted_vote?.toFixed(1)}</span>
                          </div>
                          <div className="complaint-detail-item">
                            <span className="complaint-detail-label">Evidence</span>
                            <span className="complaint-detail-value">{c.has_screenshot ? '✅ Attached' : '❌ None'}</span>
                          </div>
                          {c.description && (
                            <div className="complaint-detail-item" style={{ gridColumn: '1 / -1' }}>
                              <span className="complaint-detail-label">Description</span>
                              <span className="complaint-detail-value">{c.description}</span>
                            </div>
                          )}
                          {c.has_screenshot && c.screenshot_path && (
                            <div className="complaint-screenshot">
                              <span className="complaint-detail-label">Screenshot</span>
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
    </div>
  );
};

export default MyComplaints;
