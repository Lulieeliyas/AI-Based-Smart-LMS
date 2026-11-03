import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DashboardStats from './DashboardStats';

const AdminDashboard = ({ stats = {} }) => {
  const { user } = useAuth();
  const username = user?.first_name || user?.username || 'Admin';

  return (
    <div>
      <div className="row mb-4">
        <div className="col-12">
          <div className="card bg-dark text-white">
            <div className="card-body p-4">
              <h2 className="card-title h3">Welcome, {username}!</h2>
              <p className="card-text mb-0">
                Oversee the entire library management system, manage users, and monitor all activities.
              </p>
            </div>
          </div>
        </div>
      </div>

      <DashboardStats stats={stats} />

      <div className="row g-3 mt-4">
        <div className="col-6 col-md-3">
          <div className="card shadow-sm h-100">
            <div className="card-body text-center d-flex flex-column justify-content-center p-2 p-md-3">
              <h3 className="mb-2">👥</h3>
              <h6 className="mb-2 text-truncate">Users</h6>
              <Link to="/users" className="btn btn-dark btn-sm w-100 mt-auto">
                Manage
              </Link>
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="card shadow-sm h-100">
            <div className="card-body text-center d-flex flex-column justify-content-center p-2 p-md-3">
              <h3 className="mb-2">📚</h3>
              <h6 className="mb-2 text-truncate">Books</h6>
              <Link to="/books/manage" className="btn btn-primary btn-sm w-100 mt-auto">
                Manage
              </Link>
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="card shadow-sm h-100">
            <div className="card-body text-center d-flex flex-column justify-content-center p-2 p-md-3">
              <h3 className="mb-2">📊</h3>
              <h6 className="mb-2 text-truncate">Reports</h6>
              <Link to="/reports" className="btn btn-info btn-sm w-100 mt-auto">
                View
              </Link>
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="card shadow-sm h-100">
            <div className="card-body text-center d-flex flex-column justify-content-center p-2 p-md-3">
              <h3 className="mb-2">⚙️</h3>
              <h6 className="mb-2 text-truncate">Settings</h6>
              <button className="btn btn-secondary btn-sm w-100 mt-auto" disabled>
                Soon
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-4">
        <div className="col-12 col-md-6">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-white">
              <h5 className="mb-0">📊 System Overview</h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-6">
                  <div className="bg-light p-3 rounded h-100">
                    <h6 className="text-muted small">Total Users</h6>
                    <h3 className="mb-1">{stats.totalUsers || 0}</h3>
                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                      Students: {stats.students || 0} | Staff: {stats.staff || 0}
                    </small>
                  </div>
                </div>
                <div className="col-6">
                  <div className="bg-light p-3 rounded h-100">
                    <h6 className="text-muted small">Total Books</h6>
                    <h3 className="mb-1">{stats.totalBooks || 0}</h3>
                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                      Avail: {stats.availableBooks || 0}
                    </small>
                  </div>
                </div>
                <div className="col-6">
                  <div className="bg-light p-3 rounded h-100">
                    <h6 className="text-muted small">Borrowings</h6>
                    <h3 className="mb-1">{stats.totalBorrowings || 0}</h3>
                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                      Active: {stats.borrowedBooks || 0}
                    </small>
                  </div>
                </div>
                <div className="col-6">
                  <div className="bg-light p-3 rounded h-100">
                    <h6 className="text-muted small">Digital Resources</h6>
                    <h3 className="mb-1">{stats.digitalResources || 0}</h3>
                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                      Uploads
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-white">
              <h5 className="mb-0">🔔 Recent Activity</h5>
            </div>
            <div className="card-body" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {stats.recentActivities && stats.recentActivities.length > 0 ? (
                stats.recentActivities.slice(0, 5).map((activity, index) => (
                  <div key={index} className="border-bottom py-2">
                    <div className="d-flex justify-content-between align-items-start">
                      <span className="small">
                        <strong>{activity.user}</strong> {activity.action}
                      </span>
                      <small className="text-muted text-nowrap ms-2">{activity.time}</small>
                    </div>
                    <small className="text-muted d-block">{activity.details}</small>
                  </div>
                ))
              ) : (
                <p className="text-muted text-center mb-0 mt-3">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;