
import React, {
  createContext,
  useState,
  useContext,
  useCallback,
} from 'react';

import notificationService from '../services/notificationService';

export const NotificationContext = createContext(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider'
    );
  }

  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const refreshNotifications = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const [countResponse, notificationResponse] = await Promise.all([
        notificationService.getUnreadCount(),
        notificationService.getNotifications(),
      ]);

      const responseData = notificationResponse?.data;

      const notificationList = Array.isArray(responseData)
        ? responseData
        : Array.isArray(responseData?.results)
          ? responseData.results
          : [];

      setNotifications(notificationList);
      setUnreadCount(countResponse?.data?.unread_count ?? 0);

      return notificationList;
    } catch (err) {
      console.error('Failed to refresh notifications:', err);
      setError('Unable to load notifications.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addNotification = useCallback((notification) => {
    setNotifications((previous) => {
      if (previous.some((item) => item.id === notification.id)) {
        return previous;
      }

      return [notification, ...previous];
    });

    if (!notification.is_read) {
      setUnreadCount((previous) => previous + 1);
    }
  }, []);

  const markAsRead = useCallback(async (id) => {
    const selected = notifications.find(
      (notification) => notification.id === id
    );

    if (!selected || selected.is_read) {
      return;
    }

    await notificationService.markAsRead(id);

    setNotifications((previous) =>
      previous.map((notification) =>
        notification.id === id
          ? { ...notification, is_read: true }
          : notification
      )
    );

    setUnreadCount((previous) => Math.max(0, previous - 1));
  }, [notifications]);

  const markAllAsRead = useCallback(async () => {
    if (unreadCount === 0) {
      return;
    }

    await notificationService.markAllAsRead();

    setNotifications((previous) =>
      previous.map((notification) => ({
        ...notification,
        is_read: true,
      }))
    );

    setUnreadCount(0);
  }, [unreadCount]);

  const value = {
    notifications,
    unreadCount,
    isLoading,
    error,
    addNotification,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;
