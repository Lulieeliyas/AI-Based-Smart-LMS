import apiClient from './apiClient';

const publicService = {
  // Public statistics
  getStats: () => {
    return apiClient.get('/users/public/stats/');
  },

  // Public books
  getBooks: (params = {}) => {
    return apiClient.get('/users/public/books/', { params });
  },

  getBookDetail: (id) => {
    return apiClient.get(`/users/public/books/${id}/`);
  },

  getRecentBooks: (limit = 10) => {
    return apiClient.get('/users/public/books/recent/', { params: { limit } });
  },

  getPopularBooks: (limit = 10) => {
    return apiClient.get('/users/public/books/popular/', { params: { limit } });
  },

  // Documentation
  getDocumentation: () => {
    return apiClient.get('/users/public/documentation/');
  },
};

export default publicService;