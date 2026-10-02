import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import DashboardStats from './DashboardStats';
import bookService from '../../services/bookService';
import borrowingService from '../../services/borrowingService';
import userService from '../../services/userService';

const LibrarianDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBooks: 0,
    totalUsers: 0,
    activeBorrowings: 0,
    overdueBooks: 0,
    totalBorrowings: 0,
    returnedBorrowings: 0,
  });
  const [recentBorrowings, setRecentBorrowings] = useState([]);
  const [overdueBorrowings, setOverdueBorrowings] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    const [booksRes, usersRes, borrowStatsRes, allBorrowRes, overdueRes] =
      await Promise.allSettled([
        bookService.getBooks({ page: 1 }),
        userService.getUsers(),
        borrowingService.getBorrowingStatistics(),
        borrowingService.getAllBorrowings(),
        borrowingService.getOverdueBorrowings(),
      ]);

    // ----- Books -----
    let totalBooks = 0;
    if (booksRes.status === 'fulfilled') {
      const data = booksRes.value.data;
      totalBooks = data?.count || data?.results?.length || data?.length || 0;
    }

    // ----- Users -----
    let totalUsers = 0;
    if (usersRes.status === 'fulfilled') {
      const data = usersRes.value.data;
      totalUsers = data?.count || data?.results?.length || data?.length || 0;
    }

    // ----- Borrowing stats -----
    let borrowStats = {};
    if (borrowStatsRes.status === 'fulfilled') {
      borrowStats = borrowStatsRes.value.data || {};
    }

    // ----- Recent borrowings -----
    if (allBorrowRes.status === 'fulfilled') {
      const data = allBorrowRes.value.data;
      const list = data?.results || data || [];
      setRecentBorrowings(Array.isArray(list) ? list.slice(0, 5) : []);
    }

    // ----- Overdue -----
    if (overdueRes.status === 'fulfilled') {
      const data = overdueRes.value.data;
      const list = data?.results || data || [];
      setOverdueBorrowings(Array.isArray(list) ? list.slice(0, 5) : []);
    }

    setStats({
      totalBooks,
      totalUsers,
      totalBorrowings: borrowStats.total_borrowings || 0,
      activeBorrowings: borrowStats.active_borrowings || 0,
      overdueBooks: borrowStats.overdue_borrowings || 0,
      returnedBorrowings: borrowStats.returned_borrowings || 0,
    });

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-2">Loading librarian dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Welcome banner */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card bg-success text-white border-0 shadow">
            <div className="card-body py-4">
              <h2 className="card-title mb-2">
                📚 Welcome, {user?.first_name || user?.username}!
              </h2>
              <p className="card-text mb-0">
                Manage books, users, and borrowing operations.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-3 col-6">
          <div className="card bg-primary text-white text-center py-3">
            <h3 className="mb-0">{stats.totalBooks}</h3>
            <small>Total Books</small>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="card bg-info text-white text-center py-3">
            <h3 className="mb-0">{stats.totalUsers}</h3>
            <small>Total Users</small>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="card bg-warning text-white text-center py-3">
            <h3 className="mb-0">{stats.activeBorrowings}</h3>
            <small>Active Borrowings</small>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="card bg-danger text-white text-center py-3">
            <h3 className="mb-0">{stats.overdueBooks}</h3>
            <small>Overdue</small>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="row g-3 mb-4">
        <div className="col-md-3 col-6">
          <Link to="/books/manage" className="btn btn-primary w-100 py-3">
            <i className="bi bi-book me-2"></i>
            Manage Books
          </Link>
        </div>
        <div className="col-md-3 col-6">
          <Link to="/borrowings/all" className="btn btn-info text-white w-100 py-3">
            <i className="bi bi-journal-check me-2"></i>
            All Borrowings
          </Link>
        </div>
        <div className="col-md-3 col-6">
          <Link to="/users" className="btn btn-warning w-100 py-3">
            <i className="bi bi-people me-2"></i>
            Manage Users
          </Link>
        </div>
        <div className="col-md-3 col-6">
          <Link to="/reports" className="btn btn-secondary w-100 py-3">
            <i className="bi bi-graph-up me-2"></i>
            Reports
          </Link>
        </div>
      </div>

      {/* Recent + Overdue */}
      <div className="row">
        <div className="col-md-6 mb-3">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-white d-flex justify-content-between">
              <h5 className="mb-0">📖 Recent Borrowings</h5>
              <Link to="/borrowings/all" className="btn btn-sm btn-link">
                View All
              </Link>
            </div>
            <div className="card-body">
              {recentBorrowings.length === 0 ? (
                <p className="text-muted mb-0">No recent borrowings</p>
              ) : (
                recentBorrowings.map((b) => (
                  <div key={b.id} className="border-bottom py-2">
                    <div className="d-flex justify-content-between">
                      <strong>
                        {b.book_details?.title || b.book?.title || 'Unknown'}
                      </strong>
                      <span
                        className={`badge bg-${
                          b.status === 'overdue'
                            ? 'danger'
                            : b.status === 'returned'
                            ? 'success'
                            : 'primary'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                    <small className="text-muted">
                      {b.student_name || b.staff_name || b.user?.username || 'N/A'}{' '}
                      • {new Date(b.borrow_date).toLocaleDateString()}
                    </small>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6 mb-3">
          <div className="card shadow-sm h-100">
            <div className="card-header bg-white d-flex justify-content-between">
              <h5 className="mb-0 text-danger">⏰ Overdue Books</h5>
              <Link
                to="/borrowings/all"
                className="btn btn-sm btn-link text-danger"
              >
                View All
              </Link>
            </div>
            <div className="card-body">
              {overdueBorrowings.length === 0 ? (
                <p className="text-muted mb-0">No overdue books 🎉</p>
              ) : (
                overdueBorrowings.map((b) => (
                  <div key={b.id} className="border-bottom py-2">
                    <div className="d-flex justify-content-between">
                      <strong>
                        {b.book_details?.title || b.book?.title || 'Unknown'}
                      </strong>
                      <span className="badge bg-danger">OVERDUE</span>
                    </div>
                    <small className="text-muted">
                      Due: {new Date(b.due_date).toLocaleDateString()}
                      {b.fine_amount > 0 && (
                        <> • Fine: ${b.fine_amount}</>
                      )}
                    </small>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LibrarianDashboard;