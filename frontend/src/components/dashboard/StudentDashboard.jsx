import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import DashboardStats from './DashboardStats';
import RecentActivities from './RecentActivities';
import bookService from '../../services/bookService';
import borrowingService from '../../services/borrowingService';
import recommendationService from '../../services/recommendationService';
import notificationService from '../../services/notificationService';

const StudentDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [recentBorrowings, setRecentBorrowings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');

    try {
      // Fetch all data in parallel
      const [
        statsRes,
        activitiesRes,
        recommendationsRes,
        notificationsRes,
        borrowingsRes
      ] = await Promise.allSettled([
        borrowingService.getMyBorrowingStatistics(),
        recommendationService.getUserActivities(),
        recommendationService.getRecommendations(),
        notificationService.getNotifications(),
        borrowingService.getMyBorrowings()
      ]);

      // Process stats
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data);
      } else {
          // Calculate from borrowings
  const borrowings = borrowingsRes.status === 'fulfilled'
    ? (borrowingsRes.value.data?.results || borrowingsRes.value.data || [])
    : [];

  setStats({
    total_borrowings: borrowings.length,
    active_borrowings: borrowings.filter(b =>
      ['borrowed', 'renewed', 'overdue'].includes(b.status)
    ).length,
    overdue_borrowings: borrowings.filter(b =>
      b.is_overdue || b.status === 'overdue'
    ).length,
    returned_borrowings: borrowings.filter(b =>
      b.status === 'returned'
    ).length,
    total_fines: borrowings.reduce((sum, b) =>
      sum + (parseFloat(b.fine_amount) || 0), 0
    ),
  });
}

      // Process activities
      if (activitiesRes.status === 'fulfilled') {
        const activitiesData = activitiesRes.value.data;
        setActivities(Array.isArray(activitiesData) ? activitiesData.slice(0, 5) : []);
      }

      // Process recommendations
      if (recommendationsRes.status === 'fulfilled') {
        const recData = recommendationsRes.value.data;
        let recs = recData?.results || recData || [];
        if (!Array.isArray(recs)) recs = [];
        setRecommendations(recs.slice(0, 4));
      }

      // Process notifications
      if (notificationsRes.status === 'fulfilled') {
        const notifData = notificationsRes.value.data;
        let notifs = notifData?.results || notifData || [];
        if (!Array.isArray(notifs)) notifs = [];
        setNotifications(notifs.slice(0, 5));
      }

      // Process recent borrowings
      if (borrowingsRes.status === 'fulfilled') {
        const borrowData = borrowingsRes.value.data;
        let borrowings = borrowData?.results || borrowData || [];
        if (!Array.isArray(borrowings)) borrowings = [];
        setRecentBorrowings(borrowings.slice(0, 3));
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Some data could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="student-dashboard">
      {/* Welcome Banner */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card bg-primary text-white border-0 shadow">
            <div className="card-body py-4">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h2 className="card-title mb-2">
                    📚 Welcome, {user?.first_name || user?.username || 'Student'}!
                  </h2>
                  <p className="card-text mb-0">
                    Explore books, borrow resources, and get personalized recommendations.
                  </p>
                </div>
                <div className="d-none d-md-block">
                  <span style={{ fontSize: '4rem' }}>🎓</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-warning alert-dismissible fade show">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Stats Cards */}
      <DashboardStats stats={stats} />

      {/* Quick Actions */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-header bg-white">
              <h5 className="mb-0">⚡ Quick Actions</h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-3 col-6">
                  <Link to="/books" className="btn btn-primary w-100 py-3">
                    <i className="bi bi-search me-2"></i>
                    Search Books
                  </Link>
                </div>
                <div className="col-md-3 col-6">
                  <Link to="/borrowings" className="btn btn-info w-100 py-3 text-white">
                    <i className="bi bi-journal-bookmark me-2"></i>
                    My Borrowings
                  </Link>
                </div>
                <div className="col-md-3 col-6">
                  {/* <Link to="/recommendations" className="btn btn-success w-100 py-3">
                    <i className="bi bi-stars me-2"></i>
                    Recommendations
                  </Link> */}
                </div>
                <div className="col-md-3 col-6">
                  <Link to="/digital" className="btn btn-warning w-100 py-3">
                    <i className="bi bi-laptop me-2"></i>
                    Digital Resources
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Borrowings & Notifications */}
      <div className="row mt-4">
        {/* Recent Borrowings */}
        <div className="col-md-7">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-white d-flex justify-content-between align-items-center">
              <h5 className="mb-0">📖 Recent Borrowings</h5>
              <Link to="/borrowings" className="btn btn-sm btn-outline-primary">
                View All
              </Link>
            </div>
            <div className="card-body">
              {recentBorrowings.length > 0 ? (
                <div className="list-group list-group-flush">
                  {recentBorrowings.map((borrowing) => (
                    <div key={borrowing.id} className="list-group-item px-0">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <h6 className="mb-1">
                            {borrowing.book_details?.title || borrowing.book?.title || 'Unknown Book'}
                          </h6>
                          <small className="text-muted">
                            Due: {new Date(borrowing.due_date).toLocaleDateString()}
                          </small>
                        </div>
                        <span className={`badge bg-${
                          borrowing.status === 'returned' ? 'success' :
                          borrowing.status === 'overdue' ? 'danger' :
                          borrowing.status === 'borrowed' ? 'primary' : 'secondary'
                        }`}>
                          {borrowing.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <i className="bi bi-journal-x display-4 text-muted"></i>
                  <p className="text-muted mt-2 mb-0">No recent borrowings</p>
                  <Link to="/books" className="btn btn-sm btn-primary mt-2">
                    Browse Books
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="col-md-5">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-white d-flex justify-content-between align-items-center">
              <h5 className="mb-0">🔔 Notifications</h5>
              <Link to="/notifications" className="btn btn-sm btn-link">
                View All
              </Link>
            </div>
            <div className="card-body" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <div key={notif.id} className="border-bottom py-2">
                    <small className="text-muted">
                      {notif.time_ago || new Date(notif.created_at).toLocaleDateString()}
                    </small>
                    <p className="mb-0 small">{notif.message}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <i className="bi bi-bell-slash display-4 text-muted"></i>
                  <p className="text-muted mt-2 mb-0">No new notifications</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Books */}
      <div className="row mt-4">
        <div className="col-12">
          <div className="card shadow-sm">
            <div className="card-header bg-white d-flex justify-content-between align-items-center">
              <h5 className="mb-0">📚 Recommended for You</h5>
              {/* <Link to="/recommendations" className="btn btn-sm btn-outline-primary">
                View All
              </Link> */}
            </div>
            <div className="card-body">
              {recommendations.length > 0 ? (
                <div className="row">
                  {recommendations.map((rec) => (
                    <div key={rec.id || rec.book?.id} className="col-md-3 col-sm-6 mb-3">
                      <div className="card h-100 shadow-sm card-hover">
                        <div className="card-body">
                          <div className="text-center mb-2" style={{ fontSize: '2.5rem' }}>
                            📖
                          </div>
                          <h6 className="card-title text-truncate">
                            {rec.book?.title || rec.title || 'Unknown Book'}
                          </h6>
                          <p className="card-text text-muted small">
                            {rec.book?.author || rec.author || 'Unknown Author'}
                          </p>
                          {rec.score && (
                            <span className="badge bg-info">
                              Match: {(rec.score * 100).toFixed(0)}%
                            </span>
                          )}
                          <Link
                            to={`/books/${rec.book?.id || rec.id}`}
                            className="btn btn-sm btn-outline-primary w-100 mt-2"
                          >
                            View Book
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <i className="bi bi-stars display-4 text-muted"></i>
                  <p className="text-muted mt-2">
                    No recommendations yet. Start borrowing books!
                  </p>
                  <Link to="/books" className="btn btn-primary">
                    Browse Books
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      {activities.length > 0 && (
        <div className="row mt-4">
          <div className="col-12">
            <div className="card shadow-sm">
              <div className="card-header bg-white">
                <h5 className="mb-0">📋 Recent Activities</h5>
              </div>
              <div className="card-body">
                <RecentActivities activities={activities} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;