import apiClient from './apiClient';

const notificationService = {
  // Get all notifications - CORRECT: /api/notifications/notifications/
  getNotifications: () => {
    return apiClient.get('/notifications/notifications/').catch(error => {
      console.warn('Notifications API not available:', error.message);
      return { data: [] };
    });
  },
  
  // Get unread notifications count - CORRECT: /api/notifications/notifications/unread-count/
  getUnreadCount: () => {
    return apiClient.get('/notifications/notifications/unread-count/').catch(error => {
      console.warn('Unread count API not available:', error.message);
      return { data: { count: 0 } };
    });
  },
  
  // Mark a notification as read - CORRECT: PATCH /api/notifications/notifications/{id}/
  markAsRead: (id) => {
    return apiClient.patch(`/notifications/notifications/${id}/`, { is_read: true }).catch(error => {
      console.warn('Mark as read API not available:', error.message);
      return { data: {} };
    });
  },
  
  // Mark all notifications as read - CORRECT: /api/notifications/notifications/mark-all-read/
  markAllAsRead: () => {
    return apiClient.post('/notifications/notifications/mark-all-read/').catch(error => {
      console.warn('Mark all as read API not available:', error.message);
      return { data: {} };
    });
  },
  
  // Delete a notification - CORRECT: /api/notifications/notifications/{id}/
  deleteNotification: (id) => {
    return apiClient.delete(`/notifications/notifications/${id}/`).catch(error => {
      console.warn('Delete notification API not available:', error.message);
      return { data: {} };
    });
  },
  
  // Create a notification (admin/librarian only)
  createNotification: (data) => {
    return apiClient.post('/notifications/notifications/', data).catch(error => {
      console.warn('Create notification API not available:', error.message);
      return { data: {} };
    });
  },
};

export default notificationService;