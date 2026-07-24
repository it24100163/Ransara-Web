import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, CheckCircle, UserPlus } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', confirm_password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) { setError('Passwords do not match'); return; }
    const pwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=[\]{}|;':",./<>?`~])[A-Za-z\d!@#$%^&*()_\-+=[\]{}|;':",./<>?`~]{8,}$/;
    if (!pwdRegex.test(form.password)) {
      setError('Password must be at least 8 chars long and contain an uppercase, lowercase, number, and special character');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/users/register', { 
        first_name: form.first_name, 
        last_name: form.last_name, 
        email: form.email, 
        password: form.password, 
        role: 'customer' 
      });
      if (res.status < 300) {
        setSuccess(true);
        setTimeout(() => navigate('/login'), 2500);
      } else {
        setError(res.data.detail || 'Registration failed');
      }
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  // BUG-1 fix: Use AuthContext.login() so the global auth state is updated correctly.
  // Previously wrote localStorage directly, leaving the context out of sync on Google OAuth.
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await api.post('/users/google-login', { credential: credentialResponse.credential });
      const data = res.data;
      if (res.status < 300) {
        login(data.access_token, {
          ...data.user,
          role: data.role,
          is_active: data.is_active,
        });
        setSuccess(true);
        setTimeout(() => {
          navigate(data.role === 'admin' ? '/admin' : '/');
        }, 1500);
      } else {
        setError(data.detail || 'Google Login failed');
      }
    } catch {
      setError('Connection error. Please check if the server is running.');
    }
  };

  if (success) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div style={{ textAlign: 'center', backgroundColor: 'white', padding: '50px', borderRadius: '16px', boxShadow: '0 4px 30px rgba(0,0,0,0.08)' }}>
        <CheckCircle size={60} color="var(--color-primary)" style={{ marginBottom: '20px' }} />
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>Account Created!</h2>
        <p style={{ color: 'var(--text-muted)' }}>Redirecting you to login...</p>
      </div>
    </div>
  );

  const inputStyle = { width: '100%', padding: '12px 14px 12px 40px', border: '1.5px solid var(--border-light)', borderRadius: '8px', fontSize: '14px', color: 'var(--text-main)', outline: 'none', backgroundColor: '#fafafa', fontFamily: 'inherit', boxSizing: 'border-box' };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', padding: '30px 20px' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 30px rgba(0,0,0,0.08)', padding: '40px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ width: '52px', height: '52px', backgroundColor: 'var(--color-primary)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <UserPlus size={26} color="white" />
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px' }}>Create Account</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Join Ransara Fresh today</p>
          </div>

          {error && (
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[['first_name', 'First Name'], ['last_name', 'Last Name']].map(([name, label]) => (
                <div key={name} style={{ position: 'relative' }}>
                  <User size={15} color="var(--text-light)" style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input style={inputStyle} name={name} placeholder={label} value={form[name]} onChange={handle} required />
                </div>
              ))}
            </div>

            <div style={{ position: 'relative' }}>
              <Mail size={15} color="var(--text-light)" style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input style={inputStyle} name="email" type="email" placeholder="Email address" value={form.email} onChange={handle} required />
            </div>

            <div style={{ position: 'relative' }}>
              <Lock size={15} color="var(--text-light)" style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input style={inputStyle} name="password" type="password" placeholder="Min 8 chars · uppercase, number, special char" value={form.password} onChange={handle} required />
            </div>

            {form.password && (
              <div style={{ backgroundColor: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '12px' }}>
                <div style={{ marginBottom: '8px', fontWeight: '600', color: 'var(--text-main)' }}>Password Strength:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ color: form.password.length >= 8 ? '#16a34a' : 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px', transition: 'color 0.2s' }}>
                    {form.password.length >= 8 ? <CheckCircle size={14} /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1.5px solid var(--text-light)' }} />} 8+ characters
                  </div>
                  <div style={{ color: /[A-Z]/.test(form.password) ? '#16a34a' : 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px', transition: 'color 0.2s' }}>
                    {/[A-Z]/.test(form.password) ? <CheckCircle size={14} /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1.5px solid var(--text-light)' }} />} Uppercase
                  </div>
                  <div style={{ color: /[a-z]/.test(form.password) ? '#16a34a' : 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px', transition: 'color 0.2s' }}>
                    {/[a-z]/.test(form.password) ? <CheckCircle size={14} /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1.5px solid var(--text-light)' }} />} Lowercase
                  </div>
                  <div style={{ color: /\d/.test(form.password) ? '#16a34a' : 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px', transition: 'color 0.2s' }}>
                    {/\d/.test(form.password) ? <CheckCircle size={14} /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1.5px solid var(--text-light)' }} />} Number
                  </div>
                  <div style={{ color: /[!@#$%^&*()_\-+=\[\]{}|;':",.\/<>?`~]/.test(form.password) ? '#16a34a' : 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px', gridColumn: 'span 2', transition: 'color 0.2s' }}>
                    {/[!@#$%^&*()_\-+=\[\]{}|;':",.\/<>?`~]/.test(form.password) ? <CheckCircle size={14} /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1.5px solid var(--text-light)' }} />} Special character (!@#$%...)
                  </div>
                </div>
              </div>
            )}

            <div style={{ position: 'relative' }}>
              <Lock size={15} color="var(--text-light)" style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input style={inputStyle} name="confirm_password" type="password" placeholder="Confirm password" value={form.confirm_password} onChange={handle} required />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '13px', fontSize: '15px', borderRadius: '8px', marginTop: '4px', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }}></div>
            <span style={{ margin: '0 10px', fontSize: '12px', color: 'var(--text-light)', fontWeight: '600' }}>OR</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-light)' }}></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                setError('Google Login Failed');
              }}
            />
          </div>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: '600', textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}