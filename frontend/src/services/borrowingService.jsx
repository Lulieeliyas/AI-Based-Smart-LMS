import apiClient from './apiClient';

const borrowingService = {
  // 👤 User endpoints
  getMyBorrowings: () => {
    return apiClient.get('/borrowing/borrow/history/');
  },

    // ✅ Check if user can borrow
  canBorrow: () => {
    return apiClient.get('/borrowing/can-borrow/');
  },

  borrowBook: (bookId, borrowData = {}) => {
    return apiClient.post('/borrowing/borrow/', { 
      book: bookId,
      ...borrowData 
    });
  },
  
  returnBook: (borrowingId) => {
    return apiClient.put(`/borrowing/borrow/${borrowingId}/return/`);
  },
  
  renewBorrowing: (borrowingId) => {
    return apiClient.put(`/borrowing/borrow/${borrowingId}/renew/`);
  },
  
    // ✅ Damage/Loss reporting
  reportDamage: (borrowingId, data) => {
    return apiClient.post(`/borrowing/borrow/${borrowingId}/report-damage/`, data);
  },

    // ✅ Payment endpoints
  createPayment: (borrowingId) => {
    return apiClient.post(`/borrowing/borrow/${borrowingId}/create-payment/`);
  },


  verifyPayment: (borrowingId, txRef) => {
    return apiClient.get(`/borrowing/borrow/${borrowingId}/verify-payment/`, {
      params: { tx_ref: txRef }
    });
  },
    getPaymentStatus: (borrowingId) => {
    return apiClient.get(`/borrowing/borrow/${borrowingId}/payment-status/`);
  },

  // ✅ ID Verification
  verifyID: (data) => {
    return apiClient.post('/borrowing/verify-id/', data);
  },
  

  // 📊 Admin/Librarian endpoints
  getAllBorrowings: () => {
    return apiClient.get('/borrowing/borrow/all/');
  },
  
  getBorrowingDetail: (borrowingId) => {
    return apiClient.get(`/borrowing/borrow/${borrowingId}/detail/`);
  },
  
  getBorrowingHistory: (borrowingId) => {
    return apiClient.get(`/borrowing/borrow/${borrowingId}/history/`);
  },
  
  getActiveBorrowings: () => {
    return apiClient.get('/borrowing/borrow/active/');
  },
  
  getOverdueBorrowings: () => {
    return apiClient.get('/borrowing/borrow/overdue/');
  },
  getMyBorrowingStatistics: () => {
    return apiClient.get('/borrowing/my-statistics/', { _silent: true });
  },
  
  getBorrowingStatistics: () => {
    return apiClient.get('/borrowing/borrow/statistics/', { _silent: true });
  },
};

export default borrowingService;