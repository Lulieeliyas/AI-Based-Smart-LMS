
import apiClient from './apiClient';

const notificationService = {
  getNotifications: () =>
    apiClient.get('/notifications/notifications/'),

  getUnreadCount: () =>
    apiClient.get('/notifications/notifications/unread-count/'),

  markAsRead: (id) =>
    apiClient.patch(`/notifications/notifications/${id}/`, {
      is_read: true,
    }),

  markAllAsRead: () =>
    apiClient.post('/notifications/notifications/mark-all-read/'),

  deleteNotification: (id) =>
    apiClient.delete(`/notifications/notifications/${id}/`),
};

export default notificationService;

