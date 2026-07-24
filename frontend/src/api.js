import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request Interceptor: Attach auth token ──
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ── Response Interceptor: Handle auth errors ──
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    // Allow individual requests to opt out of the global redirect
    // by setting { skipGlobal403: true } in their request config.
    const skipGlobal401 = error.config?.skipGlobal401;
const skipGlobal403 = error.config?.skipGlobal403;

if (status === 401 && !skipGlobal401) {
      // Session expired or not authenticated → branded error page
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('user_id');
      localStorage.removeItem('isActive');
      window.location.href = '/401';
    } else if (status === 403 && !skipGlobal403) {
      // Authenticated but not authorised → branded error page
      // Only redirect if this is a role-level denial, not a data-fetch 403.
      window.location.href = '/403';
    }
    return Promise.reject(error);
  }
);

export default api;
