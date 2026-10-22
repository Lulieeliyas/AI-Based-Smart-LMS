import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import notificationService from '../../services/notificationService';

// Demo notifications for when backend is not available
const DEMO_NOTIFICATIONS = [
  {
    id: 1,
    title: '📚 እንኳን ደህና መጡ! / Welcome!',
    message: 'መጽሐፍትን ይመልከቱ እና ምክሮችን ያግኙ / Explore books and get recommendations',
    notification_type: 'system',
    priority: 'medium',
    is_read: false,
    time_ago: 'አሁን / Just now',
    link: '/books'
  },
  {
    id: 2,
    title: '⏰ መጽሐፍ ሊመለስ ቀርቷል / Book Due Soon',
    message: 'የ"Python Programming" መጽሐፍ በ2 ቀን ውስጥ ሊመለስ ነው / "Python Programming" is due in 2 days',
    notification_type: 'reminder',
    priority: 'high',
    is_read: false,
    time_ago: '1 ሰአት በፊት / 1 hour ago',
    link: '/borrowings'
  },
  {
    id: 3,
    title: '🤖 አዲስ ምክር / New Recommendations',
    message: 'በፍላጎትዎ ላይ የተመሰረቱ አዲስ መጽሐፍት / New books based on your interests',
    notification_type: 'recommendation',
    priority: 'medium',
    is_read: false,
    time_ago: '3 ሰአት በፊት / 3 hours ago',
    // link: '/recommendations'
  },
  {
    id: 4,
    title: '📖 መጽሐፍ ተመልሷል / Book Returned',
    message: '"JavaScript: The Good Parts" በተሳካ ሁኔታ ተመልሷል / "JavaScript: The Good Parts" returned successfully',
    notification_type: 'return',
    priority: 'low',
    is_read: true,
    time_ago: '5 ሰአት በፊት / 5 hours ago',
    link: '/books'
  },
  {
    id: 5,
    title: '⚠️ ጊዜ አልፏል / Overdue',
    message: '"Data Structures" መጽሐፍ ለመመለስ 3 ቀን አልፏል / "Data Structures" is 3 days overdue',
    notification_type: 'overdue',
    priority: 'urgent',
    is_read: false,
    time_ago: '2 ቀን በፊት / 2 days ago',
    link: '/borrowings'
  }
];

const NotificationBell = () => {
  const { user, isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [useDemo, setUseDemo] = useState(false);
  const dropdownRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    // Only fetch notifications if user is authenticated
    if (isAuthenticated && user) {
      fetchNotifications();
      
      const interval = setInterval(() => {
        fetchNotifications();
      }, 30000);
      
      return () => {
        clearInterval(interval);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    } else {
      // Show demo notifications if not authenticated
      setUseDemo(true);
      const demoUnread = DEMO_NOTIFICATIONS.filter(n => !n.is_read).length;
      setUnreadCount(demoUnread);
      setRecentNotifications(DEMO_NOTIFICATIONS.slice(0, 5));
      setShowDropdown(false);
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isAuthenticated, user]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const [countResponse, notifResponse] = await Promise.all([
        notificationService.getUnreadCount(),
        notificationService.getNotifications()
      ]);
      
      const count = countResponse?.data?.unread_count ?? 0;
      let notifications = notifResponse?.data || [];
      
      // Ensure notifications is an array
      if (!Array.isArray(notifications)) {
        if (notifications && typeof notifications === 'object' && notifications.results) {
          notifications = notifications.results;
        } else {
          notifications = [];
        }
      }
      
      setUnreadCount(count);
      setRecentNotifications(notifications.slice(0, 5));
      setUseDemo(false);
    } catch (error) {
      // If 401 (Unauthorized), use demo notifications
      if (error.response?.status === 401) {
        console.warn('User not authenticated, using demo notifications');
        setUseDemo(true);
        const demoUnread = DEMO_NOTIFICATIONS.filter(n => !n.is_read).length;
        setUnreadCount(demoUnread);
        setRecentNotifications(DEMO_NOTIFICATIONS.slice(0, 5));
      } else if (error.response?.status === 404) {
        // If endpoint not found, use demo notifications
        console.warn('Notifications endpoint not found, using demo notifications');
        setUseDemo(true);
        const demoUnread = DEMO_NOTIFICATIONS.filter(n => !n.is_read).length;
        setUnreadCount(demoUnread);
        setRecentNotifications(DEMO_NOTIFICATIONS.slice(0, 5));
      } else {
        // Other errors - also fallback to demo
        console.warn('Error fetching notifications:', error.message);
        setUseDemo(true);
        const demoUnread = DEMO_NOTIFICATIONS.filter(n => !n.is_read).length;
        setUnreadCount(demoUnread);
        setRecentNotifications(DEMO_NOTIFICATIONS.slice(0, 5));
      }
    }
    setIsLoading(false);
  };

  const markAsRead = async (id) => {
    try {
      if (!useDemo && isAuthenticated) {
        await notificationService.markAsRead(id);
      }
      
      setRecentNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
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
      
      setRecentNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#dc3545';
      case 'high': return '#ffc107';
      case 'medium': return '#0dcaf0';
      default: return '#6c757d';
    }
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
      return '📢';
    default:
      return '📨';
  }
};


  const notificationList = Array.isArray(recentNotifications) ? recentNotifications : [];

  // If user is not authenticated, show a login prompt
  if (!isAuthenticated || !user) {
    return (
      <li className="nav-item" style={{ position: 'relative' }}>
        <Link to="/login" className="nav-link text-white position-relative">
          <i className="bi bi-bell" style={{ fontSize: '1.2rem' }}></i>
        </Link>
      </li>
    );
  }

  return (
    <li className="nav-item" ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        className="nav-link btn btn-link text-white position-relative"
        onClick={() => setShowDropdown(!showDropdown)}
        style={{ fontSize: '1.2rem', padding: '0.5rem' }}
      >
        <i className="bi bi-bell"></i>
        {unreadCount > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger pulse-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="dropdown-menu show" style={{ 
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
          top: '100%'
        }}>
          {/* Header */}
          <div className="dropdown-header d-flex justify-content-between align-items-center py-3 px-4 border-bottom">
            <h6 className="mb-0 fw-bold">
              <i className="bi bi-bell me-2"></i>
              ማሳወቂያዎች / Notifications
              {unreadCount > 0 && (
                <span className="badge bg-danger ms-2">{unreadCount} አዲስ / new</span>
              )}
            </h6>
            <div>
              {unreadCount > 0 && (
                <button 
                  className="btn btn-sm btn-link text-decoration-none me-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    markAllAsRead();
                  }}
                >
                  ሁሉንም አንብብ / Mark all read
                </button>
              )}
              <Link to="/notifications" className="btn btn-sm btn-link text-decoration-none">
                ሁሉም / View All
              </Link>
            </div>
          </div>
          
          <div className="dropdown-divider m-0"></div>
          
          {/* Loading State */}
          {isLoading ? (
            <div className="text-center py-4">
              <div className="spinner-border spinner-border-sm text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2 text-muted small">በማዘጋጀት ላይ / Loading...</p>
            </div>
          ) : notificationList.length === 0 ? (
            /* Empty State */
            <div className="text-center py-5 px-4">
              <span style={{ fontSize: '3rem' }}>🔔</span>
              <p className="text-muted mt-2 mb-0">ምንም ማሳወቂያ የለም / No notifications</p>
              <small className="text-muted">እርስዎ ሁሉንም አንብበዋል / You're all caught up!</small>
            </div>
          ) : (
            /* Notification List */
            notificationList.map((notification) => (
              <div 
                key={notification.id}
                className={`dropdown-item ${!notification.is_read ? 'bg-light' : ''}`}
                style={{ 
                  borderLeft: `4px solid ${getPriorityColor(notification.priority)}`,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onClick={() => {
                  if (!notification.is_read) {
                    markAsRead(notification.id);
                  }
                  if (notification.link) {
                    window.location.href = notification.link;
                  }
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
                        {notification.time_ago || 'አሁን / Just now'}
                      </small>
                    </div>
                    <div className="small text-muted">{notification.message}</div>
                    <div className="mt-1 d-flex gap-1 flex-wrap">
                      {!notification.is_read && (
                        <span className="badge bg-primary">አዲስ / New</span>
                      )}
                      <span className={`badge bg-${getPriorityColor(notification.priority)}`}>
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
          
          {/* Demo Mode Indicator */}
          {useDemo && (
            <div className="text-center py-1 px-3 border-top">
              <small className="text-muted">⚠️ ማሳያ ውሂብ / Demo mode</small>
            </div>
          )}
          
          {/* Footer */}
          <div className="dropdown-divider m-0"></div>
          <div className="text-center py-2">
            <Link to="/notifications" className="text-decoration-none small">
              <i className="bi bi-arrow-right me-1"></i>
              ሁሉም ማሳወቂያዎች ይመልከቱ / See all notifications
            </Link>
          </div>
        </div>
      )}
    </li>
  );
};

export default NotificationBell;
