import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, AlertCircle, Sparkles, ChevronDown, Mail, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── Typing indicator (three bouncing dots) ────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: '4px', padding: '14px 16px', alignSelf: 'flex-start' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: '7px', height: '7px', borderRadius: '50%',
          backgroundColor: 'rgba(0,0,0,0.35)',
          animation: 'fcdot 1.4s infinite ease-in-out both',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
      <style>{`
        @keyframes fcdot {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-7px); }
        }
      `}</style>
    </div>
  );
}

// ── Rate limit exceeded panel — shows "Leave a message" form ─────────────────
function RateLimitPanel({ onBack, token }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const sendAdminMessage = async () => {
    if (!subject.trim() || !message.trim()) {
      setError('Please fill in both fields.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/chat/admin-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || 'Failed to send. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 20px', textAlign: 'center', gap: '14px' }}>
        <CheckCircle size={52} color="#16a34a" />
        <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#111', margin: 0 }}>Message Sent!</h3>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: '1.5' }}>
          Our admin team will get back to you soon. Thank you for reaching out!
        </p>
        <button onClick={onBack} style={{ marginTop: '8px', padding: '10px 22px', borderRadius: '20px', background: 'var(--color-primary, #00a247)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
          Back to Chat
        </button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', gap: '12px', overflowY: 'auto' }}>
      <div style={{ padding: '14px', backgroundColor: '#fff7ed', borderRadius: '10px', border: '1px solid #fed7aa', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <AlertCircle size={16} color="#ea580c" style={{ flexShrink: 0, marginTop: '1px' }} />
        <div style={{ fontSize: '12px', color: '#9a3412', lineHeight: '1.5' }}>
          <strong>Chat limit reached</strong> — You've used your 30 messages/hour quota. Leave a message below and our admin team will respond!
        </div>
      </div>

      <div>
        <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '5px' }}>Subject</label>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="e.g. Question about my order"
          maxLength={255}
          style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
        />
      </div>

      <div style={{ flex: 1 }}>
        <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '5px' }}>Message</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Describe your question or issue in detail…"
          maxLength={2000}
          rows={5}
          style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
        />
        <div style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'right', marginTop: '3px' }}>{message.length}/2000</div>
      </div>

      {error && <div style={{ fontSize: '12px', color: '#dc2626', padding: '8px 12px', backgroundColor: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={onBack} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1.5px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#374151', fontFamily: 'inherit' }}>
          Back
        </button>
        <button
          onClick={sendAdminMessage}
          disabled={sending}
          style={{ flex: 2, padding: '10px', borderRadius: '8px', background: 'var(--color-primary, #00a247)', color: 'white', border: 'none', cursor: sending ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600', opacity: sending ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontFamily: 'inherit' }}
        >
          <Mail size={14} /> {sending ? 'Sending…' : 'Send to Admin'}
        </button>
      </div>
    </div>
  );
}

// ── Main Floating Chat Component ──────────────────────────────────────────────
export default function FloatingChat() {
  const { isLoggedIn } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [rateUsed, setRateUsed] = useState(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  const chatBodyRef = useRef(null);

  const token = localStorage.getItem('token');

  // Auto-scroll to bottom
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages, isTyping]);

  // Show scroll-down button when not at bottom
  const handleScroll = () => {
    if (!chatBodyRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatBodyRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 80);
  };

  // Check rate limit status on open
  useEffect(() => {
    if (!isOpen || !token) return;
    fetch(`${API_URL}/chat/rate-status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setRateLimited(data.is_limited);
          setRateUsed(data.used);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Load chat history when opened
  useEffect(() => {
    if (!isOpen || !token || messages.length > 0) return;
    fetch(`${API_URL}/chat/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(sessions => {
        if (sessions && sessions.length > 0) {
          const latest = sessions[0];
          setSessionToken(latest.session_token || null);
          setMessages(latest.messages || []);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Track unread while closed
  useEffect(() => {
    if (isOpen) { setUnreadCount(0); }
  }, [isOpen]);

  // Don't render for guests (unauthenticated users)
  if (!isLoggedIn) return null;

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isTyping) return;
    setInput('');

    const tempId = `temp-${Date.now()}`;
    const userMsg = { id: tempId, role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const res = await fetch(`${API_URL}/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text, session_token: sessionToken }),
      });

      if (res.status === 429) {
        // Rate limited — show leave-message panel
        setRateLimited(true);
        setMessages(prev => prev.filter(m => m.id !== tempId));
        return;
      }

      if (res.ok) {
        const data = await res.json();
        if (data.session_token && !sessionToken) setSessionToken(data.session_token);
        // Replace temp message with server version + append assistant reply
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== tempId);
          return [...filtered, data.user, data.assistant];
        });
        setRateUsed(p => p + 1);
        if (!isOpen) setUnreadCount(p => p + 1);
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setIsTyping(false);
    }
  };

  const renderMessageContent = (content) => {
    let text = content;
    let imageUrl = null;

    const imgMatch = text.match(/\[IMAGE:\s*(.*?)\]/);
    if (imgMatch) { imageUrl = imgMatch[1]; text = text.replace(imgMatch[0], '').trim(); }
    text = text.replace('[PAYMENT_TRIGGER]', '').trim();

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{text}</span>
        {imageUrl && (
          <img src={imageUrl} alt="Product" style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '10px', marginTop: '4px' }} />
        )}
      </div>
    );
  };

  const RATE_LIMIT = 30;

  return (
    <>
      {/* ── Floating Toggle Button ─────────────────────────────── */}
      <button
        onClick={() => setIsOpen(o => !o)}
        aria-label={isOpen ? 'Close chat' : 'Open AI chat'}
        style={{
          position: 'fixed', bottom: '28px', right: '28px', zIndex: 9998,
          width: '58px', height: '58px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #00a247, #007a35)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 24px rgba(0,162,71,0.45)',
          transition: 'transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        {isOpen
          ? <X size={24} color="white" />
          : <MessageCircle size={24} color="white" />
        }
        {!isOpen && unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            background: '#ef4444', color: 'white',
            fontSize: '10px', fontWeight: '800',
            width: '18px', height: '18px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid white',
          }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {/* ── Chat Window ───────────────────────────────────────── */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: '96px', right: '28px', zIndex: 9999,
          width: '360px', maxWidth: 'calc(100vw - 40px)',
          height: '540px', maxHeight: 'calc(100vh - 120px)',
          borderRadius: '20px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', backgroundColor: '#ffffff',
          animation: 'fcSlideUp 0.28s cubic-bezier(.34,1.56,.64,1)',
        }}>
          <style>{`
            @keyframes fcSlideUp {
              from { opacity: 0; transform: translateY(24px) scale(0.95); }
              to   { opacity: 1; transform: translateY(0)   scale(1);    }
            }
          `}</style>

          {/* Header */}
          <div style={{
            padding: '16px 18px 14px',
            background: 'linear-gradient(135deg, #00a247 0%, #007a35 100%)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={18} color="white" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>Ransara AI Assistant</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>
                {rateLimited ? '⚠️ Rate limit reached' : `${rateUsed}/${RATE_LIMIT} messages used this hour`}
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', padding: '4px', display: 'flex' }}>
              <X size={18} />
            </button>
          </div>

          {/* Rate-limit bar (thin progress strip under header) */}
          <div style={{ height: '3px', background: '#e5e7eb' }}>
            <div style={{ height: '100%', width: `${Math.min(100, (rateUsed / RATE_LIMIT) * 100)}%`, background: rateUsed >= RATE_LIMIT ? '#ef4444' : '#00a247', transition: 'width 0.3s' }} />
          </div>

          {/* Body — either chat or leave-a-message panel */}
          {rateLimited ? (
            <RateLimitPanel onBack={() => setRateLimited(false)} token={token} />
          ) : (
            <>
              {/* Messages */}
              <div
                ref={chatBodyRef}
                onScroll={handleScroll}
                style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '10px', scrollbarWidth: 'none' }}
              >
                {messages.length === 0 && (
                  <div style={{ textAlign: 'center', margin: 'auto', padding: '20px' }}>
                    <div style={{ fontSize: '36px', marginBottom: '12px' }}>👋</div>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#111', marginBottom: '6px' }}>Hi! I'm your Ransara AI</p>
                    <p style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.5' }}>Ask me about products, prices, orders, or anything supermarket-related!</p>
                  </div>
                )}

                {messages.map(msg => (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '82%', padding: '10px 14px', fontSize: '13px',
                      borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      backgroundColor: msg.role === 'user' ? '#00a247' : '#f3f4f6',
                      color: msg.role === 'user' ? 'white' : '#111',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    }}>
                      {renderMessageContent(msg.content)}
                    </div>
                    <span style={{ fontSize: '10px', color: '#9ca3af', marginTop: '3px', marginLeft: '4px', marginRight: '4px' }}>
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                ))}

                {isTyping && <TypingDots />}
                <div ref={messagesEndRef} />
              </div>

              {/* Scroll down button */}
              {showScrollBtn && (
                <button onClick={scrollToBottom} style={{
                  position: 'absolute', bottom: '76px', left: '50%', transform: 'translateX(-50%)',
                  background: 'white', border: '1px solid #e5e7eb', borderRadius: '20px',
                  padding: '6px 14px', fontSize: '12px', color: '#374151', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}>
                  <ChevronDown size={14} /> Scroll down
                </button>
              )}

              {/* Leave-message shortcut button */}
              <div style={{ padding: '0 14px 6px', textAlign: 'right' }}>
                <button
                  onClick={() => setRateLimited(true)}
                  style={{ background: 'none', border: 'none', fontSize: '11px', color: '#9ca3af', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Leave a message for admin
                </button>
              </div>

              {/* Input */}
              <div style={{ padding: '8px 14px 14px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Ask anything…"
                  disabled={isTyping}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: '20px',
                    border: '1.5px solid #e5e7eb', fontSize: '13px', outline: 'none',
                    backgroundColor: '#f9fafb', fontFamily: 'inherit',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#00a247'; }}
                  onBlur={e => { e.target.style.borderColor = '#e5e7eb'; }}
                />
                <button
                  onClick={sendMessage}
                  disabled={isTyping || !input.trim()}
                  style={{
                    width: '38px', height: '38px', borderRadius: '50%',
                    background: isTyping || !input.trim() ? '#e5e7eb' : 'linear-gradient(135deg, #00a247, #007a35)',
                    border: 'none', cursor: isTyping || !input.trim() ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    transition: 'background 0.2s',
                  }}
                >
                  <Send size={15} color={isTyping || !input.trim() ? '#9ca3af' : 'white'} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
