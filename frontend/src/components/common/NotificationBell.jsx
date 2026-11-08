import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import notificationService from '../../services/notificationService';

const NotificationBell = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const dropdownRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setUnreadCount(0);
      setRecentNotifications([]);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const [countResponse, notificationResponse] = await Promise.all([
        notificationService.getUnreadCount(),
        notificationService.getNotifications(),
      ]);

      const responseData = notificationResponse?.data;

      const notifications = Array.isArray(responseData)
        ? responseData
        : Array.isArray(responseData?.results)
          ? responseData.results
          : [];

      setUnreadCount(countResponse?.data?.unread_count ?? 0);
      setRecentNotifications(notifications.slice(0, 5));
    } catch (err) {
      console.error('Unable to load notifications:', err);

      setError(
        err.response?.status === 401
          ? 'Your session has expired. Please sign in again.'
          : 'Unable to load notifications. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setUnreadCount(0);
      setRecentNotifications([]);
      setError('');
      return undefined;
    }

    fetchNotifications();

    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, user, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const markAsRead = async (id) => {
    const selected = recentNotifications.find(
      (notification) => notification.id === id
    );

    if (!selected || selected.is_read) {
      return;
    }

    try {
      await notificationService.markAsRead(id);

      setRecentNotifications((previous) =>
        previous.map((notification) =>
          notification.id === id
            ? { ...notification, is_read: true }
            : notification
        )
      );

      setUnreadCount((previous) => Math.max(0, previous - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
      setError('Could not mark notification as read.');
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;

    try {
      await notificationService.markAllAsRead();

      setRecentNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          is_read: true,
        }))
      );

      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      setError('Could not mark all notifications as read.');
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'borrow_due':
      case 'reminder':
        return '⏰';
      case 'overdue':
        return '⚠️';
      case 'return_confirmation':
      case 'return':
        return '📤';
      case 'new_resource':
      case 'recommendation':
        return '📚';
      case 'system':
        return '📢';
      default:
        return '📨';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return '#dc3545';
      case 'high':
        return '#ffc107';
      case 'medium':
        return '#0dcaf0';
      default:
        return '#6c757d';
    }
  };

  const formatDate = (value) => {
    if (!value) return '';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    setShowDropdown(false);

    const link = notification.link || notification.url;

    if (link && typeof link === 'string' && link.startsWith('/')) {
      navigate(link);
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <li className="nav-item" style={{ position: 'relative' }}>
        <Link
          to="/login"
          className="nav-link text-white position-relative"
          aria-label="Login to see notifications"
        >
          <i className="bi bi-bell" style={{ fontSize: '1.2rem' }} />
        </Link>
      </li>
    );
  }

  return (
    <li
      className="nav-item"
      ref={dropdownRef}
      style={{ position: 'relative' }}
    >
      <button
        type="button"
        className="nav-link btn btn-link text-white position-relative"
        onClick={() => setShowDropdown((previous) => !previous)}
        style={{ fontSize: '1.2rem', padding: '0.5rem' }}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-haspopup="true"
        aria-expanded={showDropdown}
      >
        <i className="bi bi-bell" />

        {unreadCount > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div
          className="dropdown-menu show"
          style={{
            position: 'absolute',
            right: 0,
            left: 'auto',
            width: '380px',
            maxWidth: '90vw',
            maxHeight: '450px',
            overflowY: 'auto',
            padding: 0,
            borderRadius: '12px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            zIndex: 1050,
            top: '100%',
          }}
        >
          <div className="dropdown-header d-flex justify-content-between align-items-center py-3 px-4 border-bottom">
            <h6 className="mb-0 fw-bold">
              <i className="bi bi-bell me-2" />
              ማሳወቂያዎች / Notifications

              {unreadCount > 0 && (
                <span className="badge bg-danger ms-2">
                  {unreadCount} አዲስ / new
                </span>
              )}
            </h6>

            {unreadCount > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-link text-decoration-none"
                onClick={markAllAsRead}
              >
                ሁሉንም አንብብ / Mark all read
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-4">
              <div
                className="spinner-border spinner-border-sm text-primary"
                role="status"
              >
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2 text-muted small">
                በማዘጋጀት ላይ / Loading...
              </p>
            </div>
          ) : error ? (
            <div className="text-center py-4 px-3">
              <p className="text-danger small mb-2">{error}</p>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={fetchNotifications}
              >
                Retry
              </button>
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="text-center py-5 px-4">
              <span style={{ fontSize: '3rem' }}>🔔</span>
              <p className="text-muted mt-2 mb-0">
                ምንም ማሳወቂያ የለም / No notifications
              </p>
              <small className="text-muted">
                You're all caught up!
              </small>
            </div>
          ) : (
            recentNotifications.map((notification) => {
              const type =
                notification.notification_type ||
                notification.type ||
                'system';

              const priority = notification.priority || 'low';

              return (
                <div
                  key={notification.id}
                  className={`dropdown-item ${
                    !notification.is_read ? 'bg-light' : ''
                  }`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNotificationClick(notification)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleNotificationClick(notification);
                    }
                  }}
                  style={{
                    borderLeft: `4px solid ${getPriorityColor(priority)}`,
                    padding: '12px 16px',
                    cursor: 'pointer',
                    whiteSpace: 'normal',
                  }}
                >
                  <div className="d-flex align-items-start">
                    <span className="me-2" style={{ fontSize: '1.2rem' }}>
                      {getTypeIcon(type)}
                    </span>

                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="fw-bold small">
                          {notification.title}
                        </div>

                        <small
                          className="text-muted ms-2"
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          {notification.time_ago ||
                            formatDate(notification.created_at) ||
                            'Just now'}
                        </small>
                      </div>

                      <div className="small text-muted">
                        {notification.message}
                      </div>

                      <div className="mt-1 d-flex gap-1 flex-wrap">
                        {!notification.is_read && (
                          <span className="badge bg-primary">
                            አዲስ / New
                          </span>
                        )}

                        <span
                          className="badge"
                          style={{
                            backgroundColor: getPriorityColor(priority),
                            color: '#fff',
                          }}
                        >
                          {priority}
                        </span>

                        {(notification.link || notification.url) && (
                          <span className="badge bg-light text-dark border">
                            <i className="bi bi-arrow-right-circle" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div className="dropdown-divider m-0" />

          <div className="text-center py-2">
            <Link
              to="/notifications"
              className="text-decoration-none small"
              onClick={() => setShowDropdown(false)}
            >
              <i className="bi bi-arrow-right me-1" />
              ሁሉም ማሳወቂያዎች ይመልከቱ / See all notifications
            </Link>
          </div>
        </div>
      )}
    </li>
  );
};

export default NotificationBell;
