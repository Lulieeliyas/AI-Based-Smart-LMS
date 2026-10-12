import apiClient from './apiClient';

const reportService = {
  // 📊 Generate Reports
  generateCirculationReport: (data = {}) => {
    return apiClient.post('/reports/generate/circulation/', data);
  },
  
  generateActivityReport: (data = {}) => {
    return apiClient.post('/reports/generate/activity/', data);
  },
  
  generateOverdueReport: (data = {}) => {
    return apiClient.post('/reports/generate/overdue/', data);
  },
  
  generatePopularBooksReport: (data = {}) => {
    return apiClient.post('/reports/generate/popular/', data);
  },
  
  generateInventoryReport: (data = {}) => {
    return apiClient.post('/reports/generate/inventory/', data);
  },
  
  // 📊 Generic report generation
  generateReport: (data) => {
    const reportType = data?.report_type || 'borrowing';
    
    const endpointMap = {
      borrowing: '/reports/generate/circulation/',
      circulation: '/reports/generate/circulation/',
      activity: '/reports/generate/activity/',
      overdue: '/reports/generate/overdue/',
      popular: '/reports/generate/popular/',
      inventory: '/reports/generate/inventory/',
      analytics: '/reports/analytics/dashboard/',
    };
    
    const endpoint = endpointMap[reportType] || '/reports/generate/circulation/';
    
    if (reportType === 'analytics') {
      return apiClient.get(endpoint);
    }
    
    return apiClient.post(endpoint, data);
  },
  
  // 📋 Get dashboard analytics
  getDashboardAnalytics: () => {
    return apiClient.get('/reports/analytics/dashboard/');
  },
  
  // 📋 Get report list
  getReports: () => {
    return apiClient.get('/reports/reports/');
  },
  
  // 📄 Get specific report
  getReport: (id) => {
    return apiClient.get(`/reports/reports/${id}/`);
  },
  
  // ⬇️ Download report
  downloadReport: (id) => {
    return apiClient.get(`/reports/reports/${id}/download/`, {
      responseType: 'blob',
    });
  },
};

export default reportService;