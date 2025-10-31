import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:5000', // point directly to your backend
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically attach JWT token from localStorage (if available)
apiClient.interceptors.request.use((config) => {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('app_token') : null;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Token attach error:', error);
  }
  return config;
});

export default apiClient;
