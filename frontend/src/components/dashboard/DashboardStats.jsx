import React from 'react';

const DashboardStats = ({ stats }) => {
  if (!stats) {
    return (
      <div className="row g-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="col-md-3 col-6">
            <div className="card bg-light">
              <div className="card-body text-center py-4">
                <div className="spinner-border spinner-border-sm text-primary"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Borrowed',
      value: stats.total_borrowings || 0,
      icon: '📚',
      color: 'primary'
    },
    {
      label: 'Active',
      value: stats.active_borrowings || 0,
      icon: '📖',
      color: 'success'
    },
    {
      label: 'Overdue',
      value: stats.overdue_borrowings || 0,
      icon: '⚠️',
      color: 'danger'
    },
    {
      label: 'Returned',
      value: stats.returned_borrowings || 0,
      icon: '✅',
      color: 'info'
    }
  ];

  return (
    <div className="row g-3">
      {statCards.map((stat, index) => (
        <div key={index} className="col-md-3 col-6">
          <div className={`card bg-${stat.color} text-white h-100`}>
            <div className="card-body text-center">
              <div style={{ fontSize: '2rem' }}>{stat.icon}</div>
              <h3 className="mb-0">{stat.value}</h3>
              <small>{stat.label}</small>
            </div>
          </div>
        </div>
      ))}
      
      {/* Fine Amount */}
      {stats.total_fines > 0 && (
        <div className="col-12 mt-2">
          <div className="alert alert-warning mb-0">
            <i className="bi bi-exclamation-triangle me-2"></i>
            <strong>Outstanding Fine:</strong> ${stats.total_fines}
            <span className="ms-2">Please clear your fines to continue borrowing.</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardStats;