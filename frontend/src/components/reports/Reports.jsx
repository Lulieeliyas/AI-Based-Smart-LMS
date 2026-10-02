// src/components/reports/Reports.jsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import borrowingService from '../../services/borrowingService';
import bookService from '../../services/bookService';
import userService from '../../services/userService';

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [borrowStats, setBorrowStats] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [topBooks, setTopBooks] = useState([]);
  const [overdueList, setOverdueList] = useState([]);
  const [activeBorrowings, setActiveBorrowings] = useState([]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [bs, us, books, overdue, active] = await Promise.allSettled([
      borrowingService.getBorrowingStatistics(),
      userService.getUserStatistics(),
      bookService.getBooks({ ordering: '-borrow_count', page: 1 }),
      borrowingService.getOverdueBorrowings(),
      borrowingService.getActiveBorrowings(),
    ]);

    if (bs.status === 'fulfilled') setBorrowStats(bs.value.data);
    if (us.status === 'fulfilled') setUserStats(us.value.data);
    if (books.status === 'fulfilled') {
      const d = books.value.data;
      setTopBooks((d?.results || d || []).slice(0, 10));
    }
    if (overdue.status === 'fulfilled') {
      const d = overdue.value.data;
      setOverdueList(d?.results || d || []);
    }
    if (active.status === 'fulfilled') {
      const d = active.value.data;
      setActiveBorrowings(d?.results || d || []);
    }

    setLoading(false);
  };

  const handleExportCSV = () => {
    if (!overdueList.length) {
      toast.info('No overdue data to export');
      return;
    }
    const headers = [
      'Book',
      'Borrower',
      'Student/Staff ID',
      'Borrowed Date',
      'Due Date',
      'Days Overdue',
      'Fine',
    ];
    const rows = overdueList.map((b) => {
      const dueDate = new Date(b.due_date);
      const today = new Date();
      const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
      return [
        b.book_details?.title || b.book?.title || 'N/A',
        b.student_name || b.staff_name || b.user?.username || 'N/A',
        b.student_id || b.staff_id || '—',
        new Date(b.borrow_date).toLocaleDateString(),
        dueDate.toLocaleDateString(),
        daysOverdue,
        b.fine_amount || 0,
      ];
    });

    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `overdue-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report downloaded');
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 className="mb-1">📊 Reports & Analytics</h2>
          <p className="text-muted mb-0">Library usage statistics and trends</p>
        </div>
        <button className="btn btn-outline-primary" onClick={handleExportCSV}>
          <i className="bi bi-download me-1"></i> Export Overdue CSV
        </button>
      </div>

      {/* Borrowing Stats */}
      <h5 className="mb-3">📖 Borrowing Statistics</h5>
      {borrowStats && (
        <div className="row g-3 mb-4">
          <div className="col-md-3 col-6">
            <div className="card bg-primary text-white text-center py-3">
              <h3>{borrowStats.total_borrowings}</h3>
              <small>Total Borrowings</small>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="card bg-success text-white text-center py-3">
              <h3>{borrowStats.active_borrowings}</h3>
              <small>Active</small>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="card bg-danger text-white text-center py-3">
              <h3>{borrowStats.overdue_borrowings}</h3>
              <small>Overdue</small>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="card bg-info text-white text-center py-3">
              <h3>{borrowStats.returned_borrowings}</h3>
              <small>Returned</small>
            </div>
          </div>
          <div className="col-md-4 col-6">
            <div className="card text-center py-2">
              <h5>{borrowStats.student_borrowings}</h5>
              <small className="text-muted">Student Borrowings</small>
            </div>
          </div>
          <div className="col-md-4 col-6">
            <div className="card text-center py-2">
              <h5>{borrowStats.staff_borrowings}</h5>
              <small className="text-muted">Staff Borrowings</small>
            </div>
          </div>
          <div className="col-md-4 col-12">
            <div className="card text-center py-2">
              <h5>{borrowStats.recent_borrowings}</h5>
              <small className="text-muted">Last 30 Days</small>
            </div>
          </div>
        </div>
      )}

      {/* User Stats */}
      <h5 className="mb-3">👥 User Statistics</h5>
      {userStats && (
        <div className="row g-3 mb-4">
          <div className="col-md-3 col-6">
            <div className="card bg-info text-white text-center py-3">
              <h3>{userStats.total_users}</h3>
              <small>Total Users</small>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="card bg-success text-white text-center py-3">
              <h3>{userStats.active_users}</h3>
              <small>Active</small>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="card bg-primary text-white text-center py-3">
              <h3>{userStats.verified_users}</h3>
              <small>Verified</small>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="card bg-warning text-white text-center py-3">
              <h3>{userStats.new_users_this_month}</h3>
              <small>New This Month</small>
            </div>
          </div>

          {userStats.roles_distribution && (
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <strong>Users by Role</strong>
                </div>
                <div className="card-body">
                  {Object.entries(userStats.roles_distribution).map(
                    ([role, count]) => (
                      <div
                        key={role}
                        className="d-flex justify-content-between border-bottom py-1"
                      >
                        <span className="text-capitalize">
                          {role.replace('_', ' ')}
                        </span>
                        <strong>{count}</strong>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top Books */}
      <h5 className="mb-3">🔥 Most Borrowed Books</h5>
      <div className="card mb-4">
        <div className="table-responsive">
          <table className="table table-sm mb-0">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Author</th>
                <th>Available</th>
              </tr>
            </thead>
            <tbody>
              {topBooks.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center text-muted py-4">
                    No data
                  </td>
                </tr>
              ) : (
                topBooks.map((b, idx) => (
                  <tr key={b.id}>
                    <td>{idx + 1}</td>
                    <td>{b.title}</td>
                    <td>{b.author}</td>
                    <td>
                      {b.available_quantity}/{b.quantity}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overdue */}
      <h5 className="mb-3 text-danger">⏰ Overdue Books</h5>
      <div className="card">
        <div className="table-responsive">
          <table className="table table-sm mb-0">
            <thead className="table-light">
              <tr>
                <th>Book</th>
                <th>Borrower</th>
                <th>Due Date</th>
                <th>Fine</th>
              </tr>
            </thead>
            <tbody>
              {overdueList.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center text-muted py-4">
                    No overdue books 🎉
                  </td>
                </tr>
              ) : (
                overdueList.map((b) => (
                  <tr key={b.id}>
                    <td>{b.book_details?.title || b.book?.title}</td>
                    <td>
                      {b.student_name || b.staff_name || b.user?.username}
                    </td>
                    <td className="text-danger">
                      {new Date(b.due_date).toLocaleDateString()}
                    </td>
                    <td className="text-danger">
                      ${b.fine_amount || 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;