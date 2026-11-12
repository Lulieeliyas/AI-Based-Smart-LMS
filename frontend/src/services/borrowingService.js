import apiClient from './apiClient';
const BASE_URL = '/borrowing/borrows';

const borrowingService = {
  getMyBorrowings: () => apiClient.get(`${BASE_URL}/`),
  canBorrow: () => apiClient.get(`${BASE_URL}/can-borrow/`),
  borrowBook: (bookId, borrowData = {}) => apiClient.post(`${BASE_URL}/issue/`, { ...borrowData, book_id: bookId }),
  returnBook: (borrowingId) => apiClient.post(`${BASE_URL}/${borrowingId}/return/`),
  getAllBorrowings: () => apiClient.get(`${BASE_URL}/all/`),
  getBorrowingDetail: (borrowingId) => apiClient.get(`${BASE_URL}/${borrowingId}/`),
  getBorrowingHistory: (borrowingId) => apiClient.get(`${BASE_URL}/${borrowingId}/`),
  getActiveBorrowings: () => apiClient.get(`${BASE_URL}/active/`),
  getOverdueBorrowings: () => apiClient.get(`${BASE_URL}/overdue/`),
  getMyBorrowingStatistics: () => apiClient.get(`${BASE_URL}/my-statistics/`, { _silent: true }),
  getBorrowingStatistics: () => apiClient.get(`${BASE_URL}/statistics/`, { _silent: true }),
  getPendingRequests: () => apiClient.get(`${BASE_URL}/pending-requests/`),
  getReturnRequests: () => apiClient.get(`${BASE_URL}/return-requests/`),
  approveBorrowing: (borrowingId) => apiClient.post(`${BASE_URL}/${borrowingId}/approve/`),
  rejectBorrowing: (borrowingId, reason = '') => apiClient.post(`${BASE_URL}/${borrowingId}/reject/`, { reason }),
  inspectReturn: (borrowingId, data) => apiClient.post(`${BASE_URL}/${borrowingId}/inspect-return/`, {
    damage_status: data.damage_status,
    damage_notes: data.damage_notes || '',
    damage_fine: data.damage_fine ?? '0',
  }),
  verifyFinePayment: (borrowingId, transactionReference = '') => apiClient.post(`${BASE_URL}/${borrowingId}/verify-payment/`, { transaction_reference: transactionReference }),
  finalizeReturn: (borrowingId) => apiClient.post(`${BASE_URL}/${borrowingId}/finalize-return/`),
  renewBorrowing: (borrowingId) => apiClient.put(`/borrowing/borrow/${borrowingId}/renew/`),
  reportDamage: (borrowingId, data) => apiClient.post(`/borrowing/borrow/${borrowingId}/report-damage/`, data),
  createPayment: (borrowingId) => apiClient.post(`/borrowing/borrow/${borrowingId}/create-payment/`),
  verifyPayment: (borrowingId, txRef) => apiClient.get(`/borrowing/borrow/${borrowingId}/verify-payment/`, { params: { tx_ref: txRef } }),
  getPaymentStatus: (borrowingId) => apiClient.get(`/borrowing/borrow/${borrowingId}/payment-status/`),
  verifyID: (data) => apiClient.post('/borrowing/verify-id/', data),
};
export default borrowingService;
