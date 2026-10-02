import React from 'react';

const RecentActivities = ({ activities }) => {
  if (!activities || activities.length === 0) {
    return (
      <p className="text-muted text-center mb-0">No recent activities</p>
    );
  }

  const getActivityIcon = (action) => {
    const icons = {
      login: '🔐',
      logout: '🚪',
      borrow: '📖',
      return: '📚',
      search: '🔍',
      view: '👁️',
      update: '✏️',
      create: '➕',
      delete: '🗑️',
      export: '📤',
      recommendation_click: '⭐'
    };
    return icons[action] || '📌';
  };

  return (
    <div className="list-group list-group-flush">
      {activities.map((activity, index) => (
        <div key={activity.id || index} className="list-group-item px-0">
          <div className="d-flex align-items-start">
            <span className="me-3" style={{ fontSize: '1.2rem' }}>
              {getActivityIcon(activity.action)}
            </span>
            <div className="flex-grow-1">
              <p className="mb-0 small">{activity.description || activity.action}</p>
              <small className="text-muted">
                {activity.time_ago || new Date(activity.created_at).toLocaleString()}
              </small>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RecentActivities;