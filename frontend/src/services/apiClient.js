import axios from 'axios';
import { toast } from 'react-toastify';

// Use import.meta.env for Vite instead of process.env
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  // headers: {
  //   'Content-Type': 'application/json',
  // },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
let isRefreshing = false;
let failedQueue = [];
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 1;

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const clearAuthAndRedirect = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_data');
  delete apiClient.defaults.headers.common['Authorization'];
  
  // Only redirect if not already on login page
  if (!window.location.pathname.includes('/login')) {
    toast.error('Session expired. Please login again.');
    setTimeout(() => {
      window.location.href = '/login';
    }, 500);
  }
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Prevent infinite loop - if we've already retried, give up
    if (originalRequest._retry && originalRequest._retryCount > 2) {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }
    
    // Only handle 401 errors that haven't been retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Check if we're on a login page - don't try to refresh there
      if (window.location.pathname.includes('/login')) {
        return Promise.reject(error);
      }
      
      if (isRefreshing) {
        // Queue the request to try again after refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }).catch(err => {
          // If refresh failed, clear auth and redirect
          clearAuthAndRedirect();
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (!refreshToken) {
          clearAuthAndRedirect();
          throw new Error('No refresh token available');
        }

        // Try to refresh the token
        const response = await axios.post(
          `${API_URL}/users/token/refresh/`,
          { refresh: refreshToken },
          { timeout: 10000 } // 10 second timeout
        );
        
        const { access } = response.data;
        
        if (!access) {
          throw new Error('No access token in refresh response');
        }
        
        // Store new access token
        localStorage.setItem('access_token', access);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${access}`;
        
        // Process any queued requests
        processQueue(null, access);
        
        // Retry the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${access}`;
        return apiClient(originalRequest);
        
      } catch (refreshError) {
        // Refresh failed - clear everything
        processQueue(refreshError, null);
        clearAuthAndRedirect();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    // Handle other errors without trying to refresh
    if (error.response?.status === 400) {
      const message = error.response.data?.detail || error.response.data?.message || 'Invalid request';
      if (!error.config._silent) {
        toast.error(message);
      }
    } else if (error.response?.status === 403) {
      if (!error.config._silent) {
        toast.error('You do not have permission to perform this action');
      }
    } else if (error.response?.status === 404) {
      // Don't show 404 errors to user - just log them
      console.warn('API endpoint not found:', error.config?.url);
    } else if (error.response?.status === 500) {
      if (!error.config._silent) {
        toast.error('Server error. Please try again later.');
      }
    } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      if (!error.config._silent) {
        toast.error('Request timeout. Please try again.');
      }
    } else if (error.message === 'Network Error') {
      if (!error.config._silent) {
        toast.error('Network error. Please check your connection.');
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;