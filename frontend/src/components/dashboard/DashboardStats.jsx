import React from 'react';

const DashboardStats = ({ stats }) => {
  if (!stats) return null;

  const statCards = [
    { label: 'Total Books', description: 'Total book copies', value: stats.total_books, icon: 'bi-book', color: 'blue' },
    { label: 'Available Books', description: 'Copies available', value: stats.available_books, icon: 'bi-book-half', color: 'green' },
    { label: 'Borrowed Books', description: 'Currently on loan', value: stats.borrowed_books, icon: 'bi-journal-arrow-up', color: 'teal' },
    { label: 'Overdue Books', description: 'Past their due date', value: stats.overdue_books, icon: 'bi-exclamation-circle', color: 'red' },
    { label: 'Total Borrowings', description: 'All borrowing records', value: stats.total_borrowings, icon: 'bi-arrow-left-right', color: 'purple' },
    { label: 'Active Users', description: 'Enabled user accounts', value: stats.active_users, icon: 'bi-people', color: 'blue' },
    { label: 'Book Categories', description: 'Available categories', value: stats.total_categories, icon: 'bi-grid', color: 'orange' },
    { label: 'Digital Resources', description: 'Digital collection', value: stats.total_digital_resources, icon: 'bi-file-earmark-pdf', color: 'teal' },
  ];

  const formatNumber = (value) => Number(value ?? 0).toLocaleString();

  return (
    <section className="admin-stats-section">
      <div className="admin-section-heading">
        <div>
          <h4>Library Overview</h4>
          <p>Current statistics from your library database</p>
        </div>
        <span className="admin-live-indicator"><span /> Live data</span>
      </div>
      <div className="admin-stats-grid">
        {statCards.map((stat) => (
          <article className={`admin-stat-card stat-${stat.color}`} key={stat.label}>
            <div className="admin-stat-top">
              <div className="admin-stat-icon"><i className={`bi ${stat.icon}`} /></div>
              <span className="admin-stat-indicator"><i className="bi bi-graph-up-arrow" /></span>
            </div>
            <div className="admin-stat-value">{formatNumber(stat.value)}</div>
            <div className="admin-stat-label">{stat.label}</div>
            <p className="admin-stat-description">{stat.description}</p>
          </article>
        ))}
      </div>
      {Number(stats.total_fines ?? 0) > 0 && (
        <div className="admin-fines-summary">
          <div className="admin-fines-icon"><i className="bi bi-cash-coin" /></div>
          <div><strong>Outstanding Fines</strong><p>Unpaid and partially paid balances</p></div>
          <strong className="admin-fines-amount">
            ETB {Number(stats.total_fines).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
        </div>
      )}
    </section>
  );
};
export default DashboardStats;
