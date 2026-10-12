// src/services/digitalService.js
import apiClient from './apiClient';

const digitalService = {
  // ===== Resources =====
  getResources: (params = {}) =>
    apiClient.get('/digital/digital-resources/', { params }),

  getResource: (id) =>
    apiClient.get(`/digital/digital-resources/${id}/`),

  uploadResource: (formData) =>
    apiClient.post('/digital/digital-resources/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  updateResource: (id, formData) => {
    const isFormData = formData instanceof FormData;
    return apiClient.put(`/digital/digital-resources/${id}/`, formData, {
      headers: {
        'Content-Type': isFormData ? 'multipart/form-data' : 'application/json',
      },
    });
  },

  deleteResource: (id) =>
    apiClient.delete(`/digital/digital-resources/${id}/`),

  downloadResource: (id) =>
    apiClient.get(`/digital/digital-resources/${id}/download/`, {
      responseType: 'blob',
    }),

  // ===== Verification =====
  verifyResource: (id, action = 'verify', notes = '') =>
    apiClient.post(`/digital/digital-resources/${id}/verify/`, { action, notes }),

  // ===== Categories =====
  getCategories: () => apiClient.get('/digital/categories/'),
  createCategory: (data) => apiClient.post('/digital/categories/', data),

  // ===== Stats =====
  getStats: () => apiClient.get('/digital/stats/'),
};

export default digitalService;