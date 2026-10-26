import apiClient from './apiClient';

const borrowingService = {
  // 👤 User endpoints
  getMyBorrowings: () => {
  return apiClient.get('/borrowing/borrows/');
},

    // ✅ Check if user can borrow
  canBorrow: () => {
    return apiClient.get('/borrowing/borrows/can-borrow/');
  },

  borrowBook: (bookId) => {
    return apiClient.post('/borrowing/borrows/issue/', {
      book_id: bookId,
    });
  },

  returnBook: (borrowingId) => {
    return apiClient.post(
      `/borrowing/borrows/${borrowingId}/return/`
    );
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
