
import axios from 'axios';
import { toast } from 'react-toastify';

// API base URL: Vercel production or local development
const API_URL = (
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000/api'
).replace(/\/+$/, '');

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    Accept: 'application/json',
  },
});

// Separate client prevents refresh requests from triggering
// the normal API response interceptor.
const refreshClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// Attach the access token to API requests.
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });

  failedQueue = [];
}

function clearAuthAndRedirect() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_data');

  delete apiClient.defaults.headers.common.Authorization;

  if (!window.location.pathname.includes('/login')) {
    toast.error('Your session has expired. Please log in again.');
    window.location.assign('/login');
  }
}

apiClient.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      if (error.message === 'Network Error') {
        toast.error(
          'Cannot connect to the backend. Check the server and API URL.'
        );
      }

      return Promise.reject(error);
    }

    const status = error.response?.status;
    const requestUrl = originalRequest.url || '';

    // Do not refresh tokens for login, registration, or refresh requests.
    const isAuthEndpoint =
      /\/(login|register|token\/refresh)\/?$/i.test(requestUrl);

    if (status === 401 && !isAuthEndpoint) {
      // Do not retry a request more than once.
      if (originalRequest._retry) {
        return Promise.reject(error);
      }

      const refreshToken = localStorage.getItem('refresh_token');

      if (!refreshToken) {
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers =
              originalRequest.headers || {};

            originalRequest.headers.Authorization = `Bearer ${token}`;

            return apiClient(originalRequest);
          })
          .catch((queueError) => Promise.reject(queueError));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // API_URL already has its trailing slash removed.
        const response = await refreshClient.post(
          '/users/token/refresh/',
          { refresh: refreshToken }
        );

        const accessToken = response.data?.access;

        if (!accessToken) {
          throw new Error(
            'Token refresh response did not contain an access token.'
          );
        }

        localStorage.setItem('access_token', accessToken);

        apiClient.defaults.headers.common.Authorization =
          `Bearer ${accessToken}`;

        processQueue(null, accessToken);

        originalRequest.headers =
          originalRequest.headers || {};

        originalRequest.headers.Authorization =
          `Bearer ${accessToken}`;

        return await apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuthAndRedirect();

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Do not show an authentication toast for failed login attempts.
    if (status === 400) {
      const message =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        'Invalid request. Please check your input.';

      toast.error(message);
    } else if (status === 403) {
      toast.error('You do not have permission to do this.');
    } else if (status === 404) {
      console.error(
        'API endpoint not found:',
        error.config?.baseURL,
        error.config?.url
      );
    } else if (status >= 500) {
      toast.error('Backend server error. Please try again later.');
    } else if (
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.toLowerCase().includes('timeout')
    ) {
      toast.error('Request timed out. Please try again.');
    } else if (error.message === 'Network Error') {
      toast.error(
        'Network error. Check the backend, API URL, and CORS settings.'
      );
    }

    return Promise.reject(error);
  }
);

export default apiClient;
