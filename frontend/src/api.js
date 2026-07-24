import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Every request ekakata latest token eka attach karanawa.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Invalid/expired token ekak nam witharak 401 page ekata yawanawa.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const skipGlobal401 = error.config?.skipGlobal401;

    if (status === 401 && !skipGlobal401) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('isActive');
      localStorage.removeItem('user_id');

      if (window.location.pathname !== '/401') {
        window.location.href = '/401';
      }
    }

    return Promise.reject(error);
  }
);

export default api;