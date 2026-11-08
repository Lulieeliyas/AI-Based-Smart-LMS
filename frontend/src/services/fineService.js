import apiClient from './apiClient';

const fineService = {
  // Fines
  getFines: () =>
    apiClient.get('/fines/'),

  // Fine reports
  getReports: () =>
    apiClient.get('/fines/reports/'),

  submitReport: (data) =>
    apiClient.post('/fines/reports/', data),

  reviewReport: (id, data) =>
    apiClient.post(`/fines/reports/${id}/review/`, data),

  // Fine extension requests
  getExtensionRequests: () =>
    apiClient.get('/fines/extensions/'),

  requestExtension: (data) =>
    apiClient.post('/fines/extensions/', data),

  reviewExtension: (id, data) =>
    apiClient.post(`/fines/extensions/${id}/review/`, data),

  // Chapa payments
  initializePayment: (data) =>
    apiClient.post('/fines/payments/initialize/', data),

  verifyPayment: (data) =>
    apiClient.post('/fines/payments/verify/', data),

  getPaymentHistory: () =>
    apiClient.get('/fines/payments/history/'),
};

export default fineService;
