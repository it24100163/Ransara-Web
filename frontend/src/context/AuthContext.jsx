import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState('customer');
  const [userData, setUserData] = useState(null);
  const [isActive, setIsActive] = useState(true);
  // true while the initial /users/me validation is in flight
  const [authLoading, setAuthLoading] = useState(true);

  // Called once on mount — validates the stored token server-side.
  // Role is set from the API response, NOT from localStorage, which prevents
  // client-side role spoofing via DevTools.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setAuthLoading(false);
      return;
    }

    api.get('/users/me', { skipGlobal401: true })
      .then((res) => {
        const user = res.data;
        setIsLoggedIn(true);
        setUserRole(user.role);
        setIsActive(user.is_active ?? true);
        setUserData(user);
      })
      .catch(() => {
        // Token is invalid or expired — clear all auth state
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('isActive');
        localStorage.removeItem('user_id');
        setIsLoggedIn(false);
        setUserRole('customer');
        setIsActive(true);
        setUserData(null);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  const login = useCallback((token, user) => {
    localStorage.setItem('token', token);
    // Keep 'role' in localStorage only as a convenience cache — AuthContext
    // re-validates via /users/me on every page load so this cannot be spoofed.
    localStorage.setItem('role', user.role);
    localStorage.setItem('isActive', user.is_active ? 'true' : 'false');
    setIsLoggedIn(true);
    setUserRole(user.role);
    setIsActive(user.is_active ?? true);
    setUserData(user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('isActive');
    localStorage.removeItem('user_id');
    setIsLoggedIn(false);
    setUserRole('customer');
    setIsActive(true);
    setUserData(null);
    window.location.href = '/';
  }, []);

  const value = {
    isLoggedIn,
    userRole,
    userData,
    isActive,
    authLoading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
