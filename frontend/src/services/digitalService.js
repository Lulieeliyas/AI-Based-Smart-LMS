import apiClient from './apiClient';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '');
const BACKEND_BASE = API_BASE.replace(/\/api$/, '');

export function toAbsoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return '';
  const str = String(pathOrUrl).trim();
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('blob:')) {
    return str;
  }
  const cleanPath = str.startsWith('/') ? str : `/${str}`;
  return `${BACKEND_BASE}${cleanPath}`;
}

function toFormData(data = {}) {
  if (data instanceof FormData) return data;
  const body = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (value instanceof Blob || value instanceof File) {
      body.append(key, value);
    } else {
      body.append(key, String(value));
    }
  });
  return body;
}

function wrapData(res) {
  const d = res.data;
  if (Array.isArray(d)) {
    // Make it work both for callers expecting array directly and callers reading .data
    d.data = d;
    d.results = d;
    return d;
  }
  if (d && typeof d === 'object') {
    if (!('data' in d)) {
      d.data = d;
    }
    return d;
  }
  return d;
}

const digitalService = {
  toAbsoluteUrl,
  BACKEND_BASE,

  // ===== Resources =====
  getResources: async (params = {}) => {
    const res = await apiClient.get('/digital/resources/', { params });
    return wrapData(res);
  },

  getResource: async (id) => {
    const res = await apiClient.get(`/digital/resources/${id}/`);
    return wrapData(res);
  },

  createResource: async (payload) => {
    const formData = toFormData(payload);
    const res = await apiClient.post('/digital/resources/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return wrapData(res);
  },

  // Alias for backward compatibility
  uploadResource: async (payload) => {
    return digitalService.createResource(payload);
  },

  updateResource: async (id, payload) => {
    const formData = toFormData(payload);
    const res = await apiClient.patch(`/digital/resources/${id}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return wrapData(res);
  },

  deleteResource: async (id) => {
    const res = await apiClient.delete(`/digital/resources/${id}/`);
    return res.data;
  },

  // ===== Verification & Publishing =====
  verifyResource: async (id, statusOrAction = 'verified', notes = '') => {
    let quality_status = statusOrAction;
    if (statusOrAction === 'verify' || statusOrAction === 'approve') {
      quality_status = 'verified';
    } else if (statusOrAction === 'reject') {
      quality_status = 'rejected';
    }
    const res = await apiClient.post(`/digital/resources/${id}/verify/`, {
      quality_status,
      quality_notes: notes,
      status: quality_status,
      action: statusOrAction,
    });
    return wrapData(res);
  },

  publishResource: async (id, is_published = true) => {
    const res = await apiClient.post(`/digital/resources/${id}/publish/`, { is_published });
    return wrapData(res);
  },

  // Direct stream/inline view URL
  getViewUrl: (id) => {
    return `${API_BASE}/digital/resources/${id}/view/`;
  },

  // Download binary blob
  downloadResource: async (id) => {
    return apiClient.get(`/digital/resources/${id}/download/`, {
      responseType: 'blob',
    });
  },

  // ===== Categories =====
  getCategories: async () => {
    const res = await apiClient.get('/digital/categories/');
    return wrapData(res);
  },

  createCategory: async (payload) => {
    const res = await apiClient.post('/digital/categories/', payload);
    return wrapData(res);
  },

  updateCategory: async (id, payload) => {
    const res = await apiClient.patch(`/digital/categories/${id}/`, payload);
    return wrapData(res);
  },

  deleteCategory: async (id) => {
    const res = await apiClient.delete(`/digital/categories/${id}/`);
    return res.data;
  },

  // ===== Stats =====
  getStats: async () => {
    const res = await apiClient.get('/digital/stats/');
    return wrapData(res);
  },
};

export default digitalService;
