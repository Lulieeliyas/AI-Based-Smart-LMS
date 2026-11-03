import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import notificationService from '../../services/notificationService';

// Demo notifications used when the backend is unavailable
const DEMO_NOTIFICATIONS = [
  {
    id: 1,
    title: '📚 Welcome!',
    message: 'Explore books and get recommendations',
    notification_type: 'system',
    priority: 'medium',
    is_read: false,
    time_ago: 'Just now',
    link: '/books',
  },
  {
    id: 2,
    title: '⏰ Book Due Soon',
    message: '"Python Programming" is due in 2 days',
    notification_type: 'reminder',
    priority: 'high',
    is_read: false,
    time_ago: '1 hour ago',
    link: '/borrowings',
  },
  {
    id: 3,
    title: '🤖 New Recommendations',
    message: 'New books based on your interests',
    notification_type: 'recommendation',
    priority: 'medium',
    is_read: false,
    time_ago: '3 hours ago',
    // link: '/recommendations',
  },
  {
    id: 4,
    title: '📖 Book Returned',
    message: '"JavaScript: The Good Parts" returned successfully',
    notification_type: 'return',
    priority: 'low',
    is_read: true,
    time_ago: '5 hours ago',
    link: '/books',
  },
  {
    id: 5,
    title: '⚠️ Overdue',
    message: '"Data Structures" is 3 days overdue',
    notification_type: 'overdue',
    priority: 'urgent',
    is_read: false,
    time_ago: '2 days ago',
    link: '/borrowings',
  },
];

const NotificationBell = () => {
  const { user, isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [useDemo, setUseDemo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);

  /* ---------- Outside click ---------- */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ---------- Fetch / demo mode ---------- */
  useEffect(() => {
    const loadDemo = () => {
      setUseDemo(true);
      const demoUnread = DEMO_NOTIFICATIONS.filter(n => !n.is_read).length;
      setUnreadCount(demoUnread);
      setRecentNotifications(DEMO_NOTIFICATIONS.slice(0, 5));
    };

    if (isAuthenticated && user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    } else {
      loadDemo();
      setShowDropdown(false);
    }
  }, [isAuthenticated, user]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const [countResponse, notifResponse] = await Promise.all([
        notificationService.getUnreadCount(),
        notificationService.getNotifications(),
      ]);

      const count = countResponse?.data?.unread_count ?? 0;
      let notifications = notifResponse?.data || [];

      if (!Array.isArray(notifications)) {
        notifications = Array.isArray(notifications?.results) ? notifications.results : [];
      }

      setUnreadCount(count);
      setRecentNotifications(notifications.slice(0, 5));
      setUseDemo(false);
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401 || status === 404 || !status) {
        setUseDemo(true);
        const demoUnread = DEMO_NOTIFICATIONS.filter(n => !n.is_read).length;
        setUnreadCount(demoUnread);
        setRecentNotifications(DEMO_NOTIFICATIONS.slice(0, 5));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      if (!useDemo && isAuthenticated) {
        await notificationService.markAsRead(id);
      }
      setRecentNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      if (!useDemo && isAuthenticated) {
        await notificationService.markAllAsRead();
      }
      setRecentNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#dc3545';
      case 'high':   return '#ffc107';
      case 'medium': return '#0dcaf0';
      default:       return '#6c757d';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'borrow_due': return '⏰';
      case 'overdue':    return '⚠️';
      case 'return_confirmation':
      case 'return':     return '📤';
      case 'new_resource':
      case 'recommendation': return '📚';
      case 'system':     return '📢';
      case 'reminder':   return '⏰';
      default:           return '📨';
    }
  };

  const notificationList = Array.isArray(recentNotifications) ? recentNotifications : [];

  /* ---------- Not authenticated ---------- */
  if (!isAuthenticated || !user) {
    return (
      <li className="nav-item" style={{ position: 'relative' }}>
        <Link to="/login" className="nav-link text-white position-relative" aria-label="Login to see notifications">
          <i className="bi bi-bell" style={{ fontSize: '1.2rem' }}></i>
        </Link>
      </li>
    );
  }

  /* ---------- Authenticated ---------- */
  return (
    <li className="nav-item" ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="nav-link btn btn-link text-white position-relative"
        onClick={() => setShowDropdown(s => !s)}
        style={{ fontSize: '1.2rem', padding: '0.5rem' }}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-haspopup="true"
        aria-expanded={showDropdown}
      >
        <i className="bi bi-bell"></i>
        {unreadCount > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger pulse-badge">
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
            maxHeight: '450px',
            overflowY: 'auto',
            padding: 0,
            borderRadius: '12px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            zIndex: 1050,
            top: '100%',
          }}
        >
          {/* Header */}
          <div className="dropdown-header d-flex justify-content-between align-items-center py-3 px-4 border-bottom">
            <h6 className="mb-0 fw-bold">
              <i className="bi bi-bell me-2"></i>
              Notifications
              {unreadCount > 0 && (
                <span className="badge bg-danger ms-2">{unreadCount} new</span>
              )}
            </h6>
            <div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-link text-decoration-none me-2"
                  onClick={(e) => { e.stopPropagation(); markAllAsRead(); }}
                >
                  Mark all read
                </button>
              )}
              <Link to="/notifications" className="btn btn-sm btn-link text-decoration-none">
                View All
              </Link>
            </div>
          </div>

          <div className="dropdown-divider m-0"></div>

          {/* Loading */}
          {isLoading ? (
            <div className="text-center py-4">
              <div className="spinner-border spinner-border-sm text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2 text-muted small">Loading...</p>
            </div>
          ) : notificationList.length === 0 ? (
            /* Empty */
            <div className="text-center py-5 px-4">
              <span style={{ fontSize: '3rem' }}>🔔</span>
              <p className="text-muted mt-2 mb-0">No notifications</p>
              <small className="text-muted">You're all caught up!</small>
            </div>
          ) : (
            /* List */
            notificationList.map((notification) => (
              <div
                key={notification.id}
                className={`dropdown-item ${!notification.is_read ? 'bg-light' : ''}`}
                style={{
                  borderLeft: `4px solid ${getPriorityColor(notification.priority)}`,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  whiteSpace: 'normal',
                }}
                onClick={() => {
                  if (!notification.is_read) markAsRead(notification.id);
                  if (notification.link) window.location.href = notification.link;
                }}
              >
                <div className="d-flex align-items-start">
                  <span className="me-2" style={{ fontSize: '1.2rem' }}>
                    {getTypeIcon(notification.notification_type)}
                  </span>
                  <div className="flex-grow-1">
                    <div className="d-flex justify-content-between align-items-start">
                      <div className="fw-bold small">{notification.title}</div>
                      <small className="text-muted ms-2" style={{ whiteSpace: 'nowrap' }}>
                        {notification.time_ago || 'Just now'}
                      </small>
                    </div>
                    <div className="small text-muted">{notification.message}</div>
                    <div className="mt-1 d-flex gap-1 flex-wrap">
                      {!notification.is_read && (
                        <span className="badge bg-primary">New</span>
                      )}
                      <span
                        className="badge"
                        style={{ backgroundColor: getPriorityColor(notification.priority), color: '#fff' }}
                      >
                        {notification.priority}
                      </span>
                      {notification.link && (
                        <span className="badge bg-light text-dark border">
                          <i className="bi bi-arrow-right-circle"></i>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Demo mode indicator */}
          {useDemo && (
            <div className="text-center py-1 px-3 border-top">
              <small className="text-muted">⚠️ Demo data</small>
            </div>
          )}

          {/* Footer */}
          <div className="dropdown-divider m-0"></div>
          <div className="text-center py-2">
            <Link to="/notifications" className="text-decoration-none small">
              <i className="bi bi-arrow-right me-1"></i>
              See all notifications
            </Link>
          </div>
        </div>
      )}
    </li>
  );
};

export default NotificationBell;