import apiClient from './apiClient';

const recommendationService = {
  getRecommendations: () => {
    return apiClient.get('/recommendations/', { _silent: true });
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

  recordActivity: (bookId, activityType) => {
    return apiClient.post('/recommendations/activity/', {
      book_id: bookId,
      activity_type: activityType,
    }, { _silent: true });
  },

  getUserActivities: () => {
    return apiClient.get('/recommendations/activities/', { _silent: true });
  },
};

export default recommendationService;