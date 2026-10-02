import apiClient from './apiClient';

const bookService = {
  // Get all books
  getBooks: (params = {}) => {
    return apiClient.get('/books/books/', { params });
  },
  
  // Get book details
  getBookDetails: (id) => {
    return apiClient.get(`/books/books/${id}/`);
  },
  
  // Create book (librarian/admin)
  createBook: (bookData) => {
    return apiClient.post('/books/books/', bookData);
  },
  
  // Update book (librarian/admin)
  updateBook: (id, bookData) => {
    return apiClient.put(`/books/books/${id}/`, bookData);
  },
  
  // Delete book (librarian/admin)
  deleteBook: (id) => {
    return apiClient.delete(`/books/books/${id}/`);
  },
  
  // Get categories
  getCategories: () => {
    return apiClient.get('/books/categories/');
  },
  
createCategory: (categoryData) => {
  return apiClient.post('/books/categories/', categoryData);
},
  // Get book reviews
  getReviews: (bookId) => {
    return apiClient.get(`/books/books/${bookId}/reviews/`);
  },
  
  // Add review
  addReview: (bookId, reviewData) => {
    return apiClient.post(`/books/books/${bookId}/reviews/`, reviewData);
  },
  
  // Search books
  searchBooks: (query, filters = {}) => {
    return apiClient.get('/books/books/search/', { 
      params: { search: query, ...filters } 
    });
  },
};

export default bookService;