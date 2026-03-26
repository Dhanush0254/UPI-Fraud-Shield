// src/config.js — Centralized API configuration
// In production, set VITE_API_URL environment variable to your deployed backend URL
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

export { API, API_BASE };
