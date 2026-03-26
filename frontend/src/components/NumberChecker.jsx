// components/NumberChecker.jsx — Public hero page to check a phone number's fraud status
import React, { useState } from 'react';
import axios from 'axios';
import { API } from '../config';

const FRAUD_TYPE_LABELS = {
  link: '🔗 Suspicious Link',
  call: '📞 Phone Call Fraud',
  ecommerce: '🛒 E-commerce Fraud',
  qr_code: '📱 QR Code Scam',
  other: '⚠️ Other'
};

const PAYMENT_LABELS = {
  gpay: 'Google Pay',
  phonepay: 'PhonePe',
  paytm: 'Paytm',
  other: 'Other UPI'
};

const NumberChecker = () => {
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleCheck = async (e) => {
    e.preventDefault();
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await axios.get(`${API}/check-number/${cleaned}`);
      setResult(res.data);
      setSearched(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to check number');
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#06b6d4';
      default: return '#22c55e';
    }
  };

  const getRiskEmoji = (level) => {
    switch (level) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      default: return '🟢';
    }
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="hero-section">
        <h1 className="hero-title">Is This Number Safe?</h1>
        <p className="hero-subtitle">
          Check any UPI phone number instantly. Our community-driven fraud reports help you stay protected.
        </p>

        <form onSubmit={handleCheck} className="search-box">
          <input
            type="tel"
            className="search-input"
            placeholder="Enter phone number (e.g. 9876543210)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={13}
          />
          <button type="submit" className="btn btn-primary search-btn" disabled={loading}>
            {loading ? '⏳ Checking...' : '🔍 Check'}
          </button>
        </form>

        {error && <p className="error-message" style={{ maxWidth: 550, margin: '0 auto' }}>{error}</p>}
      </div>

      {/* Results */}
      {searched && result && (
        <div className="risk-result glass-card glass-card-wide animate-fade-in">
          {result.total_complaints === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <h3>No Reports Found</h3>
              <p className="empty-state-text">
                This number <strong style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{result.phone_number}</strong> has no fraud complaints.
                It appears to be safe, but always stay cautious.
              </p>
            </div>
          ) : (
            <>
              {/* Risk Score */}
              <div className="risk-gauge-container">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span>{getRiskEmoji(result.risk_level)}</span>
                  <span className={`risk-score-value risk-level-${result.risk_level}`}>
                    {result.risk_score}
                  </span>
                  <span className="risk-score-label">/ 100</span>
                </div>
                <span className={`badge badge-${result.risk_level === 'high' ? 'fraud' : result.risk_level === 'medium' ? 'pending' : result.risk_level === 'low' ? 'pending' : 'safe'}`}
                  style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }}>
                  {result.risk_level === 'high' ? '⚠️ High Risk' :
                    result.risk_level === 'medium' ? '🟡 Medium Risk' :
                      result.risk_level === 'low' ? '🔵 Low Risk' : '✅ Safe'}
                </span>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.75rem', fontSize: '0.9rem' }}>
                  Number: <strong style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{result.phone_number}</strong>
                </p>
              </div>

              {/* Stats Row */}
              <div className="risk-stats-row">
                <div className="risk-stat">
                  <div className="risk-stat-value" style={{ color: 'var(--text-main)' }}>{result.total_complaints}</div>
                  <div className="risk-stat-label">Total Reports</div>
                </div>
                <div className="risk-stat">
                  <div className="risk-stat-value" style={{ color: 'var(--danger)' }}>{result.fraud_count}</div>
                  <div className="risk-stat-label">Confirmed Fraud</div>
                </div>
                <div className="risk-stat">
                  <div className="risk-stat-value" style={{ color: 'var(--success)' }}>{result.not_fraud_count}</div>
                  <div className="risk-stat-label">Not Fraud</div>
                </div>
              </div>

              {/* Pending */}
              {result.pending_count > 0 && (
                <p style={{ textAlign: 'center', color: 'var(--warning)', fontSize: '0.85rem', marginTop: '1rem' }}>
                  ⏳ {result.pending_count} report{result.pending_count > 1 ? 's' : ''} still under review
                </p>
              )}

              {/* Recent anonymized complaints */}
              {result.recent_complaints && result.recent_complaints.length > 0 && (
                <div className="recent-complaints-section">
                  <h3 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>Recent Reports</h3>
                  {result.recent_complaints.map((c, i) => (
                    <div key={i} className="recent-complaint-card">
                      <div className="recent-complaint-info">
                        <span className="recent-complaint-type">
                          {FRAUD_TYPE_LABELS[c.fraud_type] || c.fraud_type}
                        </span>
                        <span className="recent-complaint-meta">
                          via {PAYMENT_LABELS[c.payment_method] || c.payment_method}
                          {c.amount > 0 && ` • ₹${c.amount.toLocaleString()}`}
                          {c.has_evidence && ' • 📎 Evidence attached'}
                        </span>
                      </div>
                      <span className={`badge badge-${c.status === 'fraud' ? 'fraud' : c.status === 'not_fraud' ? 'safe' : 'pending'}`}>
                        {c.status === 'fraud' ? 'Fraud' : c.status === 'not_fraud' ? 'Safe' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default NumberChecker;
