import React, { useState, useEffect } from 'react';
import notificationService from '../../services/notificationService';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await notificationService.getNotifications();
      const data = response.data || [];
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
    setLoading(false);
  };

  const markAsRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, is_read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await notificationService.deleteNotification(id);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getFilteredNotifications = () => {
    if (filter === 'unread') {
      return notifications.filter(n => !n.is_read);
    }
    if (filter === 'read') {
      return notifications.filter(n => n.is_read);
    }
    return notifications;
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'info';
      default: return 'secondary';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'borrowing': return '📖';
      case 'return': return '📤';
      case 'overdue': return '⚠️';
      case 'reminder': return '⏰';
      case 'recommendation': return '🤖';
      case 'reservation': return '📌';
      default: return '📨';
    }
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
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

      {/* Filters */}
      <div className="btn-group mb-4" role="group">
        <button 
          className={`btn btn-outline-secondary ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({notifications.length})
        </button>
        <button 
          className={`btn btn-outline-secondary ${filter === 'unread' ? 'active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          Unread ({unreadCount})
        </button>
        <button 
          className={`btn btn-outline-secondary ${filter === 'read' ? 'active' : ''}`}
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
                !notification.is_read ? 'bg-light border-start border-primary border-4' : ''
              }`}
            >
              <div className="d-flex justify-content-between align-items-start">
                <div className="d-flex align-items-start flex-grow-1">
                  <span className="me-3" style={{ fontSize: '24px' }}>
                    {getTypeIcon(notification.notification_type)}
                  </span>
                  <div className="flex-grow-1">
                    <div className="d-flex justify-content-between align-items-center">
                      <h6 className="mb-1">{notification.title}</h6>
                      <small className="text-muted ms-2">
                        {notification.time_ago || 'Just now'}
                      </small>
                    </div>
                    <p className="mb-1">{notification.message}</p>
                    <div className="mt-1">
                      <span className={`badge bg-${getPriorityColor(notification.priority)} me-2`}>
                        {notification.priority}
                      </span>
                      <span className="badge bg-light text-dark">
                        {notification.notification_type}
                      </span>
                      {notification.link && (
                        <a 
                          href={notification.link} 
                          className="btn btn-sm btn-outline-primary ms-2"
                          onClick={() => {
                            if (!notification.is_read) {
                              markAsRead(notification.id);
                            }
                          }}
                        >
                          View Details
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="ms-3">
                  {!notification.is_read && (
                    <button 
                      className="btn btn-sm btn-outline-success me-1"
                      onClick={() => markAsRead(notification.id)}
                      title="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                  <button 
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => deleteNotification(notification.id)}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;