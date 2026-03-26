// components/ReportFraud.jsx — Multi-step complaint form with screenshot upload
import React, { useState, useRef } from 'react';
import axios from 'axios';
import { API } from '../config';

const STEPS = ['Details', 'How it Happened', 'Evidence', 'Submit'];

const ReportFraud = ({ token }) => {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    phone_number: '',
    txn_id: '',
    amount: '',
    payment_method: '',
    fraud_type: '',
    description: '',
    screenshot: null,
  });
  const [preview, setPreview] = useState(null);

  const updateForm = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      updateForm('screenshot', file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      updateForm('screenshot', file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const removeFile = () => {
    updateForm('screenshot', null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validateStep = () => {
    if (step === 0) {
      const cleaned = form.phone_number.replace(/\D/g, '');
      if (cleaned.length < 10) { setError('Enter a valid 10-digit phone number'); return false; }
      if (!form.txn_id.trim()) { setError('Transaction ID is required'); return false; }
      if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) { setError('Enter a valid amount'); return false; }
    }
    if (step === 1) {
      if (!form.payment_method) { setError('Select a payment method'); return false; }
      if (!form.fraud_type) { setError('Select how the fraud happened'); return false; }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep()) {
      setError('');
      setStep(s => Math.min(s + 1, STEPS.length - 1));
    }
  };
  const prevStep = () => { setError(''); setStep(s => Math.max(s - 1, 0)); };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('phone_number', form.phone_number.replace(/\D/g, ''));
      formData.append('txn_id', form.txn_id);
      formData.append('amount', form.amount);
      formData.append('payment_method', form.payment_method);
      formData.append('fraud_type', form.fraud_type);
      formData.append('description', form.description);
      if (form.screenshot) {
        formData.append('screenshot', form.screenshot);
      }

      await axios.post(`${API}/complaints`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setMessage('✅ Complaint submitted successfully! Our team will review it.');
      setForm({ phone_number: '', txn_id: '', amount: '', payment_method: '', fraud_type: '', description: '', screenshot: null });
      setPreview(null);
      setStep(0);
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-card glass-card-wide animate-fade-in">
      <h2>📝 Report Fraud</h2>
      <p className="subtitle">Your reports help keep the community safe. Fill in the details below.</p>

      {/* Step Wizard */}
      <div className="step-wizard">
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <div className={`step-item ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}>
              <div className="step-circle">{i < step ? '✓' : i + 1}</div>
              <span className="step-label">{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`step-connector ${i < step ? 'active' : ''}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0: Basic Details */}
      {step === 0 && (
        <div className="animate-fade">
          <div className="form-group">
            <label className="form-label">📱 Fraud Phone Number *</label>
            <input type="tel" placeholder="Enter 10-digit number" value={form.phone_number}
              onChange={(e) => updateForm('phone_number', e.target.value)} maxLength={13} />
          </div>
          <div className="form-group">
            <label className="form-label">🔖 UPI Transaction ID *</label>
            <input type="text" placeholder="e.g. TXN202603261234" value={form.txn_id}
              onChange={(e) => updateForm('txn_id', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">💰 Amount Defrauded (₹) *</label>
            <input type="number" placeholder="e.g. 5000" value={form.amount} min="1"
              onChange={(e) => updateForm('amount', e.target.value)} />
          </div>
        </div>
      )}

      {/* Step 1: How it happened */}
      {step === 1 && (
        <div className="animate-fade">
          <div className="form-group">
            <label className="form-label">💳 Payment Method *</label>
            <select value={form.payment_method} onChange={(e) => updateForm('payment_method', e.target.value)}>
              <option value="">Select payment app</option>
              <option value="gpay">Google Pay (GPay)</option>
              <option value="phonepay">PhonePe</option>
              <option value="paytm">Paytm</option>
              <option value="other">Other UPI App</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">🕵️ How did the fraud happen? *</label>
            <select value={form.fraud_type} onChange={(e) => updateForm('fraud_type', e.target.value)}>
              <option value="">Select fraud type</option>
              <option value="link">🔗 Suspicious Link (phishing)</option>
              <option value="call">📞 Phone Call Fraud (vishing)</option>
              <option value="ecommerce">🛒 Fake E-commerce / Product</option>
              <option value="qr_code">📱 QR Code Scam</option>
              <option value="other">⚠️ Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">📝 Description (optional)</label>
            <textarea placeholder="Describe what happened in detail..." value={form.description}
              onChange={(e) => updateForm('description', e.target.value)} rows={4} />
          </div>
        </div>
      )}

      {/* Step 2: Evidence */}
      {step === 2 && (
        <div className="animate-fade">
          <div className="form-group">
            <label className="form-label">📎 Upload Screenshot (proof)</label>
            <div className={`upload-zone ${preview ? '' : ''}`}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
              onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}>
              <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange}
                style={{ display: 'none' }} />
              {!preview ? (
                <>
                  <div className="upload-zone-icon">📤</div>
                  <p className="upload-zone-text">
                    Drag & drop an image here, or <span>click to browse</span>
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>
                    PNG, JPG, WEBP up to 16MB
                  </p>
                </>
              ) : (
                <div className="upload-preview" onClick={(e) => e.stopPropagation()}>
                  <img src={preview} alt="Screenshot preview" />
                  <button className="upload-remove" onClick={(e) => { e.stopPropagation(); removeFile(); }}>✕</button>
                </div>
              )}
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
            💡 Uploading proof increases the weight of your report and helps us verify faster.
          </p>
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <div className="animate-fade">
          <h3 style={{ marginBottom: '1rem' }}>Review Your Report</h3>
          <div className="complaint-expand" style={{ marginBottom: '1.5rem' }}>
            <div className="complaint-detail-item">
              <span className="complaint-detail-label">Phone Number</span>
              <span className="complaint-detail-value" style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{form.phone_number}</span>
            </div>
            <div className="complaint-detail-item">
              <span className="complaint-detail-label">Transaction ID</span>
              <span className="complaint-detail-value">{form.txn_id}</span>
            </div>
            <div className="complaint-detail-item">
              <span className="complaint-detail-label">Amount</span>
              <span className="complaint-detail-value">₹{Number(form.amount).toLocaleString()}</span>
            </div>
            <div className="complaint-detail-item">
              <span className="complaint-detail-label">Payment Method</span>
              <span className="complaint-detail-value">{form.payment_method === 'gpay' ? 'Google Pay' : form.payment_method === 'phonepay' ? 'PhonePe' : form.payment_method === 'paytm' ? 'Paytm' : 'Other'}</span>
            </div>
            <div className="complaint-detail-item">
              <span className="complaint-detail-label">Fraud Type</span>
              <span className="complaint-detail-value">{form.fraud_type === 'link' ? 'Suspicious Link' : form.fraud_type === 'call' ? 'Phone Call' : form.fraud_type === 'ecommerce' ? 'E-commerce' : form.fraud_type === 'qr_code' ? 'QR Code' : 'Other'}</span>
            </div>
            <div className="complaint-detail-item">
              <span className="complaint-detail-label">Evidence</span>
              <span className="complaint-detail-value">{form.screenshot ? '✅ Screenshot attached' : '❌ No evidence'}</span>
            </div>
            {form.description && (
              <div className="complaint-detail-item" style={{ gridColumn: '1 / -1' }}>
                <span className="complaint-detail-label">Description</span>
                <span className="complaint-detail-value">{form.description}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="error-message">{error}</p>}
      {message && <p className="success-message">{message}</p>}

      {/* Navigation buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
        {step > 0 && !message && (
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={prevStep}>← Back</button>
        )}
        {step < STEPS.length - 1 && (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={nextStep}>Next →</button>
        )}
        {step === STEPS.length - 1 && !message && (
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={submitting}>
            {submitting ? '⏳ Submitting...' : '🚀 Submit Report'}
          </button>
        )}
      </div>
    </div>
  );
};

export default ReportFraud;
