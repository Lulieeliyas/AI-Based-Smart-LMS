import React, { createContext, useState, useContext, useEffect } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../services/apiClient';

export const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
    const token = localStorage.getItem('access_token');
    const userData = localStorage.getItem('user_data');

    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('user_data');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    } else {
      setUser(null);
      setIsAuthenticated(false);
    }
    setLoading(false);
  };

  // ✅ LOGIN — blocks unverified users
  const login = async (username, password) => {
    try {
      const response = await apiClient.post('/users/auth/login/', {
        username,
        password,
      });

      const { access, refresh, user } = response.data;

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      localStorage.setItem('user_data', JSON.stringify(user));

      apiClient.defaults.headers.common['Authorization'] = `Bearer ${access}`;

      setUser(user);
      setIsAuthenticated(true);

      toast.success(`Welcome, ${user.first_name || user.username}!`);
      return { success: true, user };
    } catch (error) {
      let errorMsg = 'Login failed. Please check your credentials.';
      let requiresVerification = false;
      let email = '';

      if (error.response) {
        const data = error.response.data;

        // ✅ Handle 403 unverified email
        if (error.response.status === 403 && data.requires_verification) {
          errorMsg = data.error || 'Your email is not verified. Please verify it first.';
          requiresVerification = true;
          email = data.email || '';
          toast.warning(errorMsg);
          return { success: false, error: errorMsg, requiresVerification, email };
        }

        if (typeof data === 'object') {
          if (data.detail) errorMsg = data.detail;
          else if (data.error) errorMsg = data.error;
          else if (data.message) errorMsg = data.message;
          else if (data.non_field_errors) errorMsg = data.non_field_errors.join(', ');
          else {
            const firstKey = Object.keys(data)[0];
            if (firstKey) {
              errorMsg = `${firstKey}: ${
                Array.isArray(data[firstKey]) ? data[firstKey].join(', ') : data[firstKey]
              }`;
            }
          }
        } else {
          errorMsg = data;
        }
      } else if (error.request) {
        errorMsg = 'Network error. Please check your connection.';
      }

      toast.error(errorMsg);
      return { success: false, error: errorMsg, requiresVerification, email };
    }
  };

  // ✅ REGISTER — does NOT log in; user must verify email first
  const register = async (userData) => {
    try {
      const response = await apiClient.post('/users/auth/register/', userData);
      const data = response.data;

      // ✅ Store email for the verify page
      if (data.email) {
        sessionStorage.setItem('pending_verification_email', data.email);
      }

      toast.success(
        data.message ||
          'Registration successful. Please check your email for the OTP.'
      );

      // ✅ DO NOT store tokens or set user — user must verify first
      return {
        success: true,
        email: data.email,
        requiresVerification: data.requires_verification ?? true,
        message: data.message,
      };
    } catch (error) {
      let errorMsg = 'Registration failed. Please try again.';
      let errorObj = {};

      if (error.response) {
        if (error.response.data) {
          if (typeof error.response.data === 'object') {
            const data = error.response.data;
            if (data.detail) {
              errorMsg = data.detail;
            } else if (data.message) {
              errorMsg = data.message;
            } else if (data.non_field_errors) {
              errorMsg = data.non_field_errors.join(', ');
            } else {
              Object.keys(data).forEach((key) => {
                errorObj[key] = Array.isArray(data[key]) ? data[key][0] : data[key];
              });
              return { success: false, error: errorObj };
            }
          } else {
            errorMsg = error.response.data;
          }
        }
      } else if (error.request) {
        errorMsg = 'Network error. Please check your connection.';
      }

      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');
    sessionStorage.removeItem('pending_verification_email');
    delete apiClient.defaults.headers.common['Authorization'];
    setUser(null);
    setIsAuthenticated(false);
    toast.info('Logged out successfully');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        login,
        register,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};