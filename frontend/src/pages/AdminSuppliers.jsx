import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, Edit2 as Edit, Trash2, Search, Phone, Mail, MapPin, X, Check } from 'lucide-react';
import api from '../api';

function SupplierModal({ onClose, onSaved, initial = null }) {
  const isEdit = !!initial;
  const [form, setForm] = useState(initial || { name: '', contact_email: '', contact_phone: '', contact_person: '', address: '', payment_terms: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Supplier name is required'); return; }
    if (form.contact_phone && !/^(\d{10}|\+\d{10,15})$/.test(form.contact_phone.replace(/[\s\-]/g, ''))) {
        setError('Phone number must be exactly 10 digits or international format (e.g. +94711234567)');
        return;
    }
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())) {
        setError('Please enter a valid email address');
        return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/suppliers/${initial.id}`, form);
      } else {
        await api.post('/suppliers/', form);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1.5px solid var(--border-light)', borderRadius: '8px', fontSize: '14px', color: 'var(--text-main)', backgroundColor: '#fafafa', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '480px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
            {isEdit ? 'Edit Supplier' : 'Add New Supplier'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {error && <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Company Name *</label>
            <input style={inputStyle} name="name" placeholder="Ransara Distributors Ltd." value={form.name} onChange={handle} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact Person</label>
              <input style={inputStyle} name="contact_person" placeholder="John Doe" value={form.contact_person} onChange={handle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</label>
              <input style={inputStyle} name="contact_phone" placeholder="+94 77 123 4567" value={form.contact_phone} onChange={handle} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</label>
            <input style={inputStyle} name="contact_email" type="email" placeholder="supplier@company.com" value={form.contact_email} onChange={handle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Address</label>
            <input style={inputStyle} name="address" placeholder="Colombo, Sri Lanka" value={form.address} onChange={handle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Terms</label>
            <input style={inputStyle} name="payment_terms" placeholder="Net 30, COD, etc." value={form.payment_terms} onChange={handle} />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'white', cursor: 'pointer', fontSize: '14px', color: 'var(--text-muted)', fontWeight: '500' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 2, padding: '11px', borderRadius: '8px', fontSize: '14px' }}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const navigate = useNavigate();

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers/');
      setSuppliers(res.data);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this supplier?')) return;
    try {
      await api.delete(`/suppliers/${id}`);
      setSuppliers(prev => prev.filter(s => s.id !== id));
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const filtered = suppliers.filter(s =>
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contact_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      {showModal && (
        <SupplierModal
          initial={editingSupplier}
          onClose={() => { setShowModal(false); setEditingSupplier(null); }}
          onSaved={fetchSuppliers}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '25px' }}>
        <div>
          <h1 className="text-title" style={{ fontSize: '28px', marginBottom: '6px' }}>Supplier Management</h1>
          <p className="text-subtitle" style={{ fontSize: '14px', margin: 0 }}>Manage your suppliers and track performance</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingSupplier(null); setShowModal(true); }} style={{ padding: '10px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: '600' }}>
          <Plus size={16} /> Add Supplier
        </button>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          <Search size={16} color="var(--text-light)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ paddingLeft: '38px', fontSize: '14px' }}
          />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-light)' }}>
                {['Company', 'Contact Person', 'Email', 'Phone', 'Products', 'Payment Terms', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 10px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>
                  <Building2 size={36} style={{ marginBottom: '10px', opacity: 0.3 }} />
                  <p>No suppliers found. Add your first supplier!</p>
                </td></tr>
              ) : (
                filtered.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '14px 10px', fontWeight: '600', color: 'var(--text-main)', fontSize: '14px' }}>{s.name}</td>
                    <td style={{ padding: '14px 10px', fontSize: '14px', color: 'var(--text-muted)' }}>{s.contact_person || '—'}</td>
                    <td style={{ padding: '14px 10px', fontSize: '13px', color: 'var(--text-muted)' }}>{s.contact_email || '—'}</td>
                    <td style={{ padding: '14px 10px', fontSize: '13px', color: 'var(--text-muted)' }}>{s.contact_phone || '—'}</td>
                    <td style={{ padding: '14px 10px', textAlign: 'center' }}>
                      <span style={{ backgroundColor: '#eefcf2', color: 'var(--color-primary)', fontSize: '12px', fontWeight: '600', padding: '3px 10px', borderRadius: '12px' }}>{s.product_count ?? 0}</span>
                    </td>
                    <td style={{ padding: '14px 10px', fontSize: '13px', color: 'var(--text-muted)' }}>{s.payment_terms || '—'}</td>
                    <td style={{ padding: '14px 10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button onClick={() => { setEditingSupplier(s); setShowModal(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><Edit size={15} /></button>
                      <button onClick={() => handleDelete(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminSuppliers;