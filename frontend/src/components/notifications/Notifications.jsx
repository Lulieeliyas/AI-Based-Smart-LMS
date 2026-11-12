import React, { useState, useEffect } from 'react';
import notificationService from '../../services/notificationService';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await notificationService.getNotifications();
      const responseData = response?.data;

      // Handle both normal arrays and paginated Django responses.
      const data = Array.isArray(responseData)
        ? responseData
        : Array.isArray(responseData?.results)
          ? responseData.results
          : [];

      setNotifications(data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError('Could not load notifications. Please log in again and retry.');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length;

  const markAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);

      setNotifications((previous) =>
        previous.map((notification) =>
          notification.id === id
            ? { ...notification, is_read: true }
            : notification
        )
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();

      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          is_read: true,
        }))
      );
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const getFilteredNotifications = () => {
    if (filter === 'unread') {
      return notifications.filter((notification) => !notification.is_read);
    }

    if (filter === 'read') {
      return notifications.filter((notification) => notification.is_read);
    }

    return notifications;
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'borrow_due':
        return '⏰';
      case 'overdue':
        return '⚠️';
      case 'return_confirmation':
        return '📤';
      case 'new_resource':
        return '📚';
      case 'system':
        return '📨';
      default:
        return '🔔';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading notifications...</p>
      </div>
    );
  }

  const filteredNotifications = getFilteredNotifications();

  return (
    <div className="notifications-page">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>🔔 Notifications</h2>

        <div>
          {unreadCount > 0 && (
            <button
              className="btn btn-primary me-2"
              onClick={markAllAsRead}
            >
              Mark All as Read
            </button>
          )}

          <span className="badge bg-secondary">
            {unreadCount} unread
          </span>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
          <button
            className="btn btn-sm btn-outline-danger ms-3"
            onClick={fetchNotifications}
          >
            Retry
          </button>
        </div>
      )}

      <div className="btn-group mb-4" role="group">
        <button
          className={`btn btn-outline-secondary ${
            filter === 'all' ? 'active' : ''
          }`}
          onClick={() => setFilter('all')}
        >
          All ({notifications.length})
        </button>

        <button
          className={`btn btn-outline-secondary ${
            filter === 'unread' ? 'active' : ''
          }`}
          onClick={() => setFilter('unread')}
        >
          Unread ({unreadCount})
        </button>

        <button
          className={`btn btn-outline-secondary ${
            filter === 'read' ? 'active' : ''
          }`}
          onClick={() => setFilter('read')}
        >
          Read ({notifications.length - unreadCount})
        </button>
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="text-center py-5 bg-light rounded">
          <h4>No notifications</h4>
          <p className="text-muted">You're all caught up!</p>
        </div>
      ) : (
        <div className="list-group">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`list-group-item list-group-item-action ${
                !notification.is_read
                  ? 'bg-light border-start border-primary border-4'
                  : ''
              }`}
            >
              <div className="d-flex justify-content-between align-items-start">
                <div className="d-flex align-items-start flex-grow-1">
                  <span className="me-3" style={{ fontSize: '24px' }}>
                    {getTypeIcon(notification.type)}
                  </span>

                  <div className="flex-grow-1">
                    <div className="d-flex justify-content-between align-items-center">
                      <h6 className="mb-1">{notification.title}</h6>
                      <small className="text-muted ms-2">
                        {formatDate(notification.created_at)}
                      </small>
                    </div>

                    <p className="mb-1">{notification.message}</p>

                    <span className="badge bg-light text-dark">
                      {notification.type?.replaceAll('_', ' ') || 'notification'}
                    </span>
                  </div>
                </div>

                {!notification.is_read && (
                  <button
                    className="btn btn-sm btn-outline-success ms-3"
                    onClick={() => markAsRead(notification.id)}
                    title="Mark as read"
                    aria-label="Mark notification as read"
                  >
                    ✓ Mark as read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
