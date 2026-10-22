import apiClient from './apiClient';

const userService = {
  // ========== Authentication ==========
  
  register: (userData) => {
    return apiClient.post('/users/auth/register/', userData);
  },
  
  login: (credentials) => {
    return apiClient.post('/users/auth/login/', credentials);
  },
  
  logout: (refreshToken) => {
    return apiClient.post('/users/auth/logout/', { refresh: refreshToken });
  },
  
  // ========== Profile Management ==========
  
  getProfile: () => {
    return apiClient.get('/users/auth/profile/');
  },
  
  updateProfile: (data) => {
    // Detect if we're sending a file (FormData) or plain JSON
    const isFormData = data instanceof FormData;

    const config = isFormData
      ? {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      : {};

    return apiClient.put('/users/auth/profile/', data, config);
  },

  
  partialUpdateProfile: (data) => {
    const isFormData = data instanceof FormData;

    const config = isFormData
      ? {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      : {};

    return apiClient.patch('/users/auth/profile/', data, config);
  },

changePassword: (oldPasswordOrData, newPassword) => {
  let payload;
  if (typeof oldPasswordOrData === 'object' && oldPasswordOrData !== null) {
    payload = {
      old_password: oldPasswordOrData.old_password || oldPasswordOrData.oldPassword,
      new_password: oldPasswordOrData.new_password || oldPasswordOrData.newPassword,
    };
  } else {
    payload = { old_password: oldPasswordOrData, new_password: newPassword };
  }
  return apiClient.post('/users/auth/change-password/', payload);
},
  
  // ========== Admin User Management ==========

    uploadAuthorizedUsersCSV: (file) => {
  const formData = new FormData();
  formData.append('file', file);

  return apiClient.post(
    '/users/admin/authorized-users/upload-csv/',
    formData
  );
},

  getAuthorizedUsers: () => {
  return apiClient.get('/users/admin/authorized-users/');
},

createAuthorizedUser: (data) => {
  return apiClient.post('/users/admin/authorized-users/', data);
},
  
  getUsers: () => {
  return apiClient.get('/users/users/');
},
  
  getUser: (userId) => {
    return apiClient.get(`/users/users/${userId}/`);
  },
  
  createUser: (data) => {
    return apiClient.post('/users/users/', data);
  },
  
  updateUser: (userId, data) => {
    const isFormData = data instanceof FormData;
    const config = isFormData
      ? { headers: { 'Content-Type': 'multipart/form-data' } }
      : {};
    return apiClient.put(`/users/users/${userId}/`, data, config);
  },

  
  partialUpdateUser: (userId, data) => {
    const isFormData = data instanceof FormData;
    const config = isFormData
      ? { headers: { 'Content-Type': 'multipart/form-data' } }
      : {};
    return apiClient.patch(`/users/users/${userId}/`, data, config);
  },
  
  deleteUser: (userId) => {
    return apiClient.delete(`/users/users/${userId}/`);
  },
  
  // ========== User Status Management ==========
  
  activateUser: (userId) => {
    return apiClient.patch(`/users/users/${userId}/`, { is_active: true });
  },
  
  deactivateUser: (userId) => {
    return apiClient.patch(`/users/users/${userId}/`, { is_active: false });
  },
  
  toggleUserActive: (userId, currentStatus) => {
    return apiClient.patch(`/users/users/${userId}/`, { is_active: !currentStatus });
  },
  
  // ========== Role Management ==========
  
  updateUserRole: (userId, role) => {
    return apiClient.patch(`/users/users/${userId}/`, { role: role });
  },
  
  // ========== Email Verification ==========
  
  verifyEmail: (token) => {
    return apiClient.get(`/users/auth/verify-email/${token}/`);
  },
  
  resendVerification: (email) => {
    return apiClient.post('/users/auth/resend-verification/', { email });
  },
  
  // ========== Password Reset ==========
  
  requestPasswordReset: (email) => {
    return apiClient.post('/users/auth/password-reset/', { email });
  },
  
  confirmPasswordReset: (token, newPassword) => {
    return apiClient.post('/users/auth/password-reset/confirm/', { 
      token, 
      new_password: newPassword 
    });
  },
  
  // ========== Guest Upgrade ==========
  
  upgradeGuest: (role = 'student') => {
    return apiClient.post('/users/auth/upgrade/', { role });
  },
  
  // ========== User Statistics ==========
  
  getUserStatistics: () => {
    return apiClient.get('/users/users/statistics/');
  },
  
  getUserActivities: (userId) => {
    return apiClient.get(`/users/users/${userId}/activities/`);
  },
};

export default userService;