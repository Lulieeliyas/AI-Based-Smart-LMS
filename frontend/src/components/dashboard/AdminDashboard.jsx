import React from 'react';
import { Link } from 'react-router-dom';
import DashboardStats from './DashboardStats';

const AdminDashboard = ({ stats }) => {
  return (
    <div>
      <div className="row mb-4">
        <div className="col-12">
          <div className="card bg-dark text-white">
            <div className="card-body">
              <h2 className="card-title">🔧 Welcome, Admin!</h2>
              <p className="card-text">
                Oversee the entire library management system, manage users, and monitor all activities.
              </p>
            </div>
          </div>
        </div>
      </div>

      <DashboardStats stats={stats} />

      <div className="row mt-4">
        <div className="col-md-3">
          <div className="card shadow-sm">
            <div className="card-body text-center">
              <h3>👥</h3>
              <h6>User Management</h6>
              <Link to="/users" className="btn btn-dark btn-sm w-100">
                Manage Users
              </Link>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card shadow-sm">
            <div className="card-body text-center">
              <h3>📚</h3>
              <h6>Books</h6>
              <Link to="/books/manage" className="btn btn-primary btn-sm w-100">
                Manage Books
              </Link>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card shadow-sm">
            <div className="card-body text-center">
              <h3>📊</h3>
              <h6>Reports</h6>
              <Link to="/reports" className="btn btn-info btn-sm w-100">
                View Reports
              </Link>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card shadow-sm">
            <div className="card-body text-center">
              <h3>⚙️</h3>
              <h6>System Settings</h6>
              <button className="btn btn-secondary btn-sm w-100" disabled>
                Coming Soon
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-md-6">
          <div className="card shadow-sm">
            <div className="card-header bg-white">
              <h5 className="mb-0">📊 System Overview</h5>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-6 mb-3">
                  <div className="bg-light p-3 rounded">
                    <h6>Total Users</h6>
                    <h3>{stats.totalUsers || 0}</h3>
                    <small className="text-muted">
                      Students: {stats.students || 0} | Staff: {stats.staff || 0}
                    </small>
                  </div>
                </div>
                <div className="col-6 mb-3">
                  <div className="bg-light p-3 rounded">
                    <h6>Total Books</h6>
                    <h3>{stats.totalBooks || 0}</h3>
                    <small className="text-muted">
                      Available: {stats.availableBooks || 0}
                    </small>
                  </div>
                </div>
                <div className="col-6">
                  <div className="bg-light p-3 rounded">
                    <h6>Borrowings</h6>
                    <h3>{stats.totalBorrowings || 0}</h3>
                    <small className="text-muted">
                      Active: {stats.borrowedBooks || 0}
                    </small>
                  </div>
                </div>
                <div className="col-6">
                  <div className="bg-light p-3 rounded">
                    <h6>Digital Resources</h6>
                    <h3>{stats.digitalResources || 0}</h3>
                    <small className="text-muted">
                      Total uploads
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card shadow-sm">
            <div className="card-header bg-white">
              <h5 className="mb-0">🔔 Recent Activity</h5>
            </div>
            <div className="card-body" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {stats.recentActivities && stats.recentActivities.length > 0 ? (
                stats.recentActivities.slice(0, 5).map((activity, index) => (
                  <div key={index} className="border-bottom py-2">
                    <div className="d-flex justify-content-between">
                      <span><strong>{activity.user}</strong> {activity.action}</span>
                      <small className="text-muted">{activity.time}</small>
                    </div>
                    <small className="text-muted">{activity.details}</small>
                  </div>
                ))
              ) : (
                <p className="text-muted text-center">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;