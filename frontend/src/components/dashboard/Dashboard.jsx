
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
<<<<<<< HEAD
import { getSystemStats } from '../../services/adminStatsService';
import DashboardStats from './DashboardStats';
import AdminFeatures from '../admin/AdminFeatures';
import './Dashboard.css';

const Dashboard = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchStats = useCallback(async () => {
        if (!isAdmin) return;

        setLoading(true);
        setError('');

        try {
            const data = await getSystemStats();

            if (!data || typeof data !== 'object') {
                throw new Error('The server returned invalid dashboard statistics.');
            }

            setStats(data);
        } catch (err) {
            console.error('Dashboard statistics error:', err);

            setError(
                err.response?.data?.detail ||
                err.response?.data?.error ||
                err.message ||
                'Unable to load dashboard statistics.'
            );
        } finally {
            setLoading(false);
        }
    }, [isAdmin]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const welcomeName =
        user?.first_name ||
        user?.username ||
        'User';

    return (
        <main className={isAdmin ? 'admin-dashboard' : ''}>
            {/* Welcome panel */}
            <section className="admin-welcome">
                <div className="admin-welcome-content">
                    <span className="admin-welcome-eyebrow">
                        AI Library Management System
                    </span>

                    <h2>
                        Welcome back, {welcomeName}
                    </h2>

                    <p>
                        {isAdmin
                            ? 'Manage your library, monitor system activity, and keep track of your library resources from one place.'
                            : user?.role === 'academic_staff'
                                ? 'Explore library resources and manage your borrowing activities.'
                                : 'Explore library resources and discover books for your learning.'}
                    </p>
                </div>

                <i
                    className="bi bi-journal-bookmark-fill admin-welcome-decoration"
                    aria-hidden="true"
                />
            </section>

            {/* Administrator dashboard statistics */}
            {isAdmin && (
                <>
                    {loading && !stats ? (
                        <div className="admin-dashboard-state">
                            <div
                                className="spinner-border text-primary"
                                role="status"
                            >
                                <span className="visually-hidden">
                                    Loading...
                                </span>
                            </div>
                            <p>Loading live library statistics...</p>
                        </div>
                    ) : error && !stats ? (
                        <div className="admin-dashboard-error" role="alert">
                            <strong>
                                <i className="bi bi-exclamation-triangle me-2" />
                                Unable to load dashboard statistics
                            </strong>

                            <p>{error}</p>

                            <button
                                type="button"
                                className="admin-refresh-button"
                                onClick={fetchStats}
                                disabled={loading}
                            >
                                <i className="bi bi-arrow-clockwise" />
                                Try Again
                            </button>
                        </div>
                    ) : (
                        <>
                            {error && (
                                <div className="alert alert-warning" role="alert">
                                    {error}
                                </div>
                            )}

                            <DashboardStats stats={stats} />

                            <div className="d-flex justify-content-end mt-3">
                                <button
                                    type="button"
                                    className="admin-refresh-button"
                                    onClick={fetchStats}
                                    disabled={loading}
                                >
                                    <i className={`bi ${
                                        loading
                                            ? 'bi-arrow-repeat'
                                            : 'bi-arrow-clockwise'
                                    }`} />
                                    {loading
                                        ? 'Refreshing...'
                                        : 'Refresh Statistics'}
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}

            {/* Quick actions */}
            <section className="mt-4">
                <div className="admin-section-heading">
                    <div>
                        <h4>Quick Actions</h4>
                        <p>Quick access to frequently used library services</p>
                    </div>
                </div>

                <div className="row g-3">
                    <div className="col-md-4 col-sm-6">
                        <Link
                            to="/books"
                            className="btn btn-outline-primary w-100 py-3"
                        >
                            <i className="bi bi-search me-2" />
                            Search Books
                        </Link>
                    </div>

                    <div className="col-md-4 col-sm-6">
                        <Link
                            to="/borrowings"
                            className="btn btn-outline-primary w-100 py-3"
                        >
                            <i className="bi bi-journal-arrow-up me-2" />
                            My Borrowings
                        </Link>
                    </div>

                    <div className="col-md-4 col-sm-6">
                        <Link
                            to="/digital"
                            className="btn btn-outline-primary w-100 py-3"
                        >
                            <i className="bi bi-file-earmark-pdf me-2" />
                            Digital Resources
                        </Link>
                    </div>
                </div>
            </section>

            {/* Administrator feature dropdowns */}
            {isAdmin && <AdminFeatures />}
        </main>
    );
=======

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalBooks: 0,
    borrowedBooks: 0,
    overdueBooks: 0,
    availableBooks: 0,
  });

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setStats({
        totalBooks: 150,
        borrowedBooks: 45,
        overdueBooks: 8,
        availableBooks: 97,
      });
      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome Section */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card bg-primary text-white shadow-lg">
            <div className="card-body p-4">
              <h2 className="card-title">
                👋 Welcome, {user?.first_name || user?.username || 'Guest'}!
              </h2>
              <p className="card-text">
                {user?.role === 'student' && 'Explore new books and get personalized recommendations.'}
                {user?.role === 'librarian' && 'Manage library resources and assist students.'}
                {user?.role === 'admin' && 'Oversee the entire library management system.'}
                {!user?.role && 'Welcome to the AI Library Management System.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="row g-3">
        <div className="col-md-3 col-sm-6">
          <div className="card bg-primary text-white shadow-sm">
            <div className="card-body text-center py-3">
              <div style={{ fontSize: '2.5rem' }}>📚</div>
              <h3 className="mb-0">{stats.totalBooks}</h3>
              <small>Total Books</small>
            </div>
          </div>
        </div>
        <div className="col-md-3 col-sm-6">
          <div className="card bg-success text-white shadow-sm">
            <div className="card-body text-center py-3">
              <div style={{ fontSize: '2.5rem' }}>✅</div>
              <h3 className="mb-0">{stats.availableBooks}</h3>
              <small>Available</small>
            </div>
          </div>
        </div>
        <div className="col-md-3 col-sm-6">
          <div className="card bg-warning text-dark shadow-sm">
            <div className="card-body text-center py-3">
              <div style={{ fontSize: '2.5rem' }}>📖</div>
              <h3 className="mb-0">{stats.borrowedBooks}</h3>
              <small>Borrowed</small>
            </div>
          </div>
        </div>
        <div className="col-md-3 col-sm-6">
          <div className="card bg-danger text-white shadow-sm">
            <div className="card-body text-center py-3">
              <div style={{ fontSize: '2.5rem' }}>⚠️</div>
              <h3 className="mb-0">{stats.overdueBooks}</h3>
              <small>Overdue</small>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="row mt-4">
        <div className="col-md-6">
          <div className="card shadow-sm">
            <div className="card-header bg-white">
              <h5 className="mb-0">⚡ Quick Actions</h5>
            </div>
            <div className="card-body">
              <div className="row g-2">
                <div className="col-md-6">
                  <Link to="/books" className="btn btn-primary w-100 py-3">
                    <div style={{ fontSize: '1.5rem' }}>🔍</div>
                    Search Books
                  </Link>
                </div>
                <div className="col-md-6">
                  <Link to="/borrowings" className="btn btn-info text-white w-100 py-3">
                    <div style={{ fontSize: '1.5rem' }}>📖</div>
                    My Borrowings
                  </Link>
                </div>
                <div className="col-md-6">
                  <Link to="/digital" className="btn btn-secondary w-100 py-3">
                    <div style={{ fontSize: '1.5rem' }}>💻</div>
                    Digital Resources
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card shadow-sm">
            <div className="card-header bg-white">
              <h5 className="mb-0">📊 Quick Stats</h5>
            </div>
            <div className="card-body">
              <div className="row g-2">
                <div className="col-6">
                  <div className="bg-light p-3 rounded text-center">
                    <h6>Total Borrowings</h6>
                    <h3 className="text-primary">52</h3>
                  </div>
                </div>
                <div className="col-6">
                  <div className="bg-light p-3 rounded text-center">
                    <h6>Active Users</h6>
                    <h3 className="text-success">24</h3>
                  </div>
                </div>
                <div className="col-6">
                  <div className="bg-light p-3 rounded text-center">
                    <h6>Categories</h6>
                    <h3 className="text-warning">12</h3>
                  </div>
                </div>
                <div className="col-6">
                  <div className="bg-light p-3 rounded text-center">
                    <h6>Digital Resources</h6>
                    <h3 className="text-info">36</h3>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
>>>>>>> 3d92b850 (Implement librarian return inspection and fine management)
};

export default Dashboard;
