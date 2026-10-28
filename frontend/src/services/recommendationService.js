import apiClient from './apiClient';

const recommendationService = {
  getRecommendations: (params = {}) => {
    return apiClient.get('/recommendations/', { params, _silent: true });
  },

  getPersonalizedRecommendations: (params = {}) => {
    return apiClient.get('/recommendations/for-me/', { params, _silent: true });
  },

  generateRecommendations: () => {
    return apiClient.post('/recommendations/generate/', {}, { _silent: true });
  },

  getSimilarBooks: (bookId, limit = 6) => {
    return apiClient.get(`/recommendations/similar/${bookId}/`, {
      params: { limit },
      _silent: true,
    });
  },

  getPopularBooks: (limit = 6) => {
    return apiClient.get('/recommendations/popular/', {
      params: { limit },
      _silent: true,
    });
  },

  getTrendingBooks: (limit = 6) => {
    return apiClient.get('/recommendations/trending/', {
      params: { limit },
      _silent: true,
    });
  },

  recordActivity: (bookId, activityType, rating = null) => {
    const payload = {
      book_id: bookId,
      activity_type: activityType,
    };
    if (rating !== null) {
      payload.rating = rating;
    }
    return apiClient.post('/recommendations/activity/', payload, { _silent: true });
  },

  getUserActivities: () => {
    return apiClient.get('/recommendations/activities/', { _silent: true });
  },

  getModelStatus: () => {
    return apiClient.get('/recommendations/status/', { _silent: true });
  },
};

export default recommendationService;
