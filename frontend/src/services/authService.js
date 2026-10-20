import apiClient from './apiClient';

const authService = {
  // 🔐 Authentication
  login: (username, password) => {
    return apiClient.post('/users/auth/login/', { username, password });
  },
  
register: (userData) => apiClient.post('/users/auth/register/', userData),

lookupAuthorizedUser: (studentId) =>
  apiClient.post('/users/auth/authorized-user-lookup/', {
    student_id: studentId,
  }),
  
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_data');
  },
  
  refreshToken: (refresh) => {
    return apiClient.post('/users/token/refresh/', { refresh });
  },
  
  // 👤 Profile Management
  getProfile: () => {
    return apiClient.get('/users/auth/profile/');
  },
  
  updateProfile: (profileData) => {
    return apiClient.put('/users/auth/profile/', profileData);
  },
  
  partialUpdateProfile: (profileData) => {
    return apiClient.patch('/users/auth/profile/', profileData);
  },
  
  // 🔑 Password Management
  changePassword: (oldPassword, newPassword) => {
    return apiClient.post('/users/auth/change-password/', {
      old_password: oldPassword,
      new_password: newPassword
    });
  },
  
  // 🔓 Password Reset
  requestPasswordReset: (email) => {
    return apiClient.post('/users/auth/password-reset/', { email });
  },
  
  // 🔓 Confirm password reset with OTP
  confirmPasswordReset: (email, otp, newPassword) => {
    return apiClient.post('/users/auth/password-reset/confirm/', {
      email: email,
      otp: otp,
      new_password: newPassword
    });
  },
  
  // 📧 Email Verification
  verifyEmailOTP: (email, otp) => {
    return apiClient.post('/users/auth/verify-email/', { email, otp });
  },
  // ✅ Verify OTP before showing the password step
verifyOTP: (email, otp) => {
  return apiClient.post('/users/auth/verify-otp/', { email, otp });
},
   // 📧 Resend verification OTP
  resendVerification: (email) => {
    return apiClient.post('/users/auth/resend-verification/', { email });
  },
};

export default authService;