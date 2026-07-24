/**
 * useNotifications.js
 * -------------------
 * Custom hook that opens a WebSocket connection to /ws/notifications (customers)
 * or /ws/admin (admins) and provides a live unread count + event list.
 *
 * Features:
 *  - Auto-reconnects with exponential back-off (max 30 s) if the WS drops.
 *  - Falls back gracefully to polling when the WS URL is unavailable.
 *  - Cleans up the socket on unmount / logout.
 *  - Exposes { unreadCount, events, clearCount } for use in NavBar / AdminPanel.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';

const WS_BASE = (() => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  return apiUrl.replace(/^http/, 'ws'); // http → ws, https → wss
})();

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]; // ms

export function useNotifications({ isLoggedIn, userRole }) {
  const [unreadCount, setUnreadCount]   = useState(0);
  const [events,      setEvents]        = useState([]);

  const wsRef       = useRef(null);
  const retryRef    = useRef(0);
  const retryTimer  = useRef(null);
  const mountedRef  = useRef(true);

  // ── REST fallback — used on initial load and when WS is unavailable ────────
  const fetchCountREST = useCallback(() => {
    api.get('/orders/notifications/unread-count')
      .then(res => {
        if (mountedRef.current) {
          setUnreadCount(res.data?.count ?? res.data?.unread_count ?? 0);
        }
      })
      .catch(() => {});
  }, []);

  // ── Handle incoming WS message ─────────────────────────────────────────────
  const handleMessage = useCallback((raw) => {
    try {
      const event = JSON.parse(raw);
      if (event.type === 'order_update') {
        setEvents(prev => [event, ...prev].slice(0, 50)); // keep last 50
        setUnreadCount(prev => prev + 1);
      }
    } catch (_) {}
  }, []);

  // ── Open WebSocket ─────────────────────────────────────────────────────────
  const openSocket = useCallback(() => {
    if (!isLoggedIn || wsRef.current) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const path = userRole === 'admin' ? '/ws/admin' : '/ws/notifications';
    const url  = `${WS_BASE}${path}?token=${encodeURIComponent(token)}`;

    let ws;
    try {
      ws = new WebSocket(url);
    } catch (_) {
      scheduleReconnect();
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Notifications connected');
      retryRef.current = 0; // reset back-off on successful connect
    };

    ws.onmessage = (e) => handleMessage(e.data);

    ws.onclose = () => {
      wsRef.current = null;
      if (mountedRef.current && isLoggedIn) {
        scheduleReconnect();
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [isLoggedIn, userRole, handleMessage]);

  // ── Exponential back-off reconnect ─────────────────────────────────────────
  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    const delay = RECONNECT_DELAYS[Math.min(retryRef.current, RECONNECT_DELAYS.length - 1)];
    retryRef.current += 1;
    console.log(`[WS] Reconnecting in ${delay / 1000}s (attempt ${retryRef.current})`);
    retryTimer.current = setTimeout(() => {
      if (mountedRef.current) openSocket();
    }, delay);
  }, [openSocket]);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    if (!isLoggedIn) {
      setUnreadCount(0);
      setEvents([]);
      return;
    }

    // Fetch initial count from REST so the badge is correct before WS connects
    fetchCountREST();

    // Open WebSocket
    openSocket();

    // Fallback: re-poll REST every 60 s in case WS is blocked (corporate proxy etc.)
    const pollInterval = setInterval(fetchCountREST, 60_000);

    return () => {
      mountedRef.current = false;
      clearInterval(pollInterval);
      clearTimeout(retryTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isLoggedIn, userRole]); // re-run when login state changes

  const clearCount = useCallback(() => setUnreadCount(0), []);

  return { unreadCount, events, clearCount };
}
