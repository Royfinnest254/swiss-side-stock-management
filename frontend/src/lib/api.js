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
  return Promise.reject(error.response?.data || error);
});

// Multipart form upload helper
api.postForm = async (url, formData) => {
  const token = localStorage.getItem('swiss_side_session');
  const response = await axios.post(`/api${url}`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export default api;
