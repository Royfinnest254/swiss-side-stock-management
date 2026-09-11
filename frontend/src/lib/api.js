import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Request Interceptor: Attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('swiss_side_session');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response Interceptor: Handle 401
api.interceptors.response.use((response) => {
  return response.data;
}, (error) => {
  if (error.response && error.response.status === 401) {
    localStorage.removeItem('swiss_side_session');
    localStorage.removeItem('swiss_side_user');
    localStorage.removeItem('swiss_side_role');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
  const payload = error.response?.data;
  const normalizedError = payload instanceof Blob
    ? error
    : Object.assign(error, payload && typeof payload === 'object' ? payload : {});
  return Promise.reject(normalizedError);
});

// Multipart form upload helper
api.postForm = (url, formData, config = {}) => api.post(url, formData, {
  ...config,
  headers: {
    ...config.headers,
    'Content-Type': 'multipart/form-data',
  },
});

export function getApiErrorMessage(error, fallback = 'Something went wrong') {
  return error?.error || error?.message || fallback;
}

export default api;
