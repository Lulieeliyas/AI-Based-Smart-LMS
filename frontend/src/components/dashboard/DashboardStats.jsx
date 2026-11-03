import React from 'react';

const DashboardStats = ({ stats }) => {
  // Loading state
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

  // Map the real data to the cards
  const statCards = [
    {
      label: 'Total Borrowed',
      value: stats.totalBorrowings || 0,
      icon: '📚',
      color: 'primary'
    },
    {
      label: 'Active',
      value: stats.borrowedBooks || 0,
      icon: '📖',
      color: 'success'
    },
    {
      label: 'Overdue',
      value: stats.overdueBooks || 0,
      icon: '⚠️',
      color: 'danger'
    },
    {
      label: 'Returned',
      value: stats.returnedBorrowings || 0,
      icon: '✅',
      color: 'info'
    }
  ];

  return (
    <div className="row g-3">
      {statCards.map((stat, index) => (
        <div key={index} className="col-md-3 col-6">
          <div className={`card bg-${stat.color} text-white h-100`}>
            <div className="card-body text-center py-3">
              <div style={{ fontSize: '2rem' }}>{stat.icon}</div>
              <h3 className="mb-0">{stat.value}</h3>
              <small>{stat.label}</small>
            </div>
          </div>
        </div>
      ))}
      
      {/* Fine Amount Alert */}
      {stats.total_fines > 0 && (
        <div className="col-12 mt-2">
          <div className="alert alert-warning mb-0">
            <i className="bi bi-exclamation-triangle me-2"></i>
            <strong>Outstanding Fine:</strong> ${stats.total_fines}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardStats;