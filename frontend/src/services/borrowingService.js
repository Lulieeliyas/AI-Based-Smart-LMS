
import apiClient from './apiClient';

const BASE_URL = '/borrowing/borrows';

const borrowingService = {

  // Personal borrowing records
  getMyBorrowings: () =>
    apiClient.get(`${BASE_URL}/`),

  // Check borrowing eligibility
  canBorrow: () =>
    apiClient.get(`${BASE_URL}/can-borrow/`),

  // Issue a book
  borrowBook: (bookId) =>
    apiClient.post(`${BASE_URL}/issue/`, {
      book_id: bookId,
    }),

  // Return a book
  returnBook: (borrowingId) =>
    apiClient.post(
      `${BASE_URL}/${borrowingId}/return/`
    ),

  // All borrowing records (staff only)
  getAllBorrowings: () =>
    apiClient.get(`${BASE_URL}/all/`),

  // Borrowing detail
  getBorrowingDetail: (borrowingId) =>
    apiClient.get(`${BASE_URL}/${borrowingId}/`),

  // Active borrowing records
  getActiveBorrowings: () =>
    apiClient.get(`${BASE_URL}/active/`),

  // Overdue borrowing records
  getOverdueBorrowings: () =>
    apiClient.get(`${BASE_URL}/overdue/`),

  // Personal statistics
  getMyBorrowingStatistics: () =>
    apiClient.get(`${BASE_URL}/my-statistics/`, {
      _silent: true,
    }),

  // Staff statistics
  getBorrowingStatistics: () =>
    apiClient.get(`${BASE_URL}/statistics/`, {
      _silent: true,
    }),
};

export default borrowingService;
