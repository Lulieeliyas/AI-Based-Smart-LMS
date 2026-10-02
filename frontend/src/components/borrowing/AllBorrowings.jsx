import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import borrowingService from '../../services/borrowingService';
import { useAuth } from '../../context/AuthContext';

const AllBorrowings = () => {
  const { user } = useAuth();
  const [borrowings, setBorrowings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'librarian') {
      fetchBorrowings();
      fetchStatistics();
    }
  }, [user]);

  const fetchBorrowings = async () => {
    setLoading(true);
    try {
      const response = await borrowingService.getAllBorrowings();
      setBorrowings(response.data || []);
    } catch (error) {
      console.error('Error fetching borrowings:', error);
      setError('Failed to load borrowings');
      toast.error('Failed to load borrowings');
    }
    setLoading(false);
  };

  const fetchStatistics = async () => {
    try {
      const response = await borrowingService.getBorrowingStatistics();
      setStats(response.data);
    } catch (error) {
      console.warn('Error fetching statistics:', error);
    }
  };

  const getFilteredBorrowings = () => {
    let filtered = borrowings;
    
    if (filter !== 'all') {
      filtered = filtered.filter(b => b.status === filter);
    }
    
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(b => 
        b.book_details?.title?.toLowerCase().includes(searchLower) ||
        b.book_details?.author?.toLowerCase().includes(searchLower) ||
        b.student_name?.toLowerCase().includes(searchLower) ||
        b.staff_name?.toLowerCase().includes(searchLower) ||
        b.student_id?.toLowerCase().includes(searchLower) ||
        b.staff_id?.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered;
  };

  const getStatusBadge = (status) => {
    const colors = {
      borrowed: 'primary',
      returned: 'success',
      overdue: 'danger',
      renewed: 'info',
      pending: 'warning',
      cancelled: 'secondary'
    };
    return colors[status] || 'secondary';
  };

  const getBorrowerInfo = (borrowing) => {
    if (borrowing.borrower_role === 'student') {
      return {
        name: borrowing.student_name || 'N/A',
        id: borrowing.student_id || 'N/A',
        role: 'Student'
      };
    } else if (borrowing.borrower_role === 'academic_staff') {
      return {
        name: borrowing.staff_name || 'N/A',
        id: borrowing.staff_id || 'N/A',
        role: 'Staff',
        position: borrowing.staff_position || 'N/A'
      };
    }
    return {
      name: borrowing.user_details?.username || 'N/A',
      id: 'N/A',
      role: borrowing.borrower_role || 'User'
    };
  };

  if (!user || (user.role !== 'admin' && user.role !== 'librarian')) {
    return (
      <div className="text-center py-5">
        <div style={{ fontSize: '4rem' }}>🔒</div>
        <h3>Access Denied</h3>
        <p className="text-muted">You need Librarian or Admin permissions to view this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading borrowings...</p>
      </div>
    );
  }

  const filteredBorrowings = getFilteredBorrowings();

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>📖 All Borrowings</h2>
        <button 
          className="btn btn-outline-primary btn-sm"
          onClick={fetchBorrowings}
        >
          <i className="bi bi-arrow-clockwise me-1"></i>
          Refresh
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="row g-3 mb-4">
          <div className="col-md-2 col-sm-4">
            <div className="card bg-primary text-white text-center py-2">
              <h5>{stats.total_borrowings}</h5>
              <small>Total</small>
            </div>
          </div>
          <div className="col-md-2 col-sm-4">
            <div className="card bg-success text-white text-center py-2">
              <h5>{stats.active_borrowings}</h5>
              <small>Active</small>
            </div>
          </div>
          <div className="col-md-2 col-sm-4">
            <div className="card bg-danger text-white text-center py-2">
              <h5>{stats.overdue_borrowings}</h5>
              <small>Overdue</small>
            </div>
          </div>
          <div className="col-md-2 col-sm-4">
            <div className="card bg-info text-white text-center py-2">
              <h5>{stats.student_borrowings}</h5>
              <small>Students</small>
            </div>
          </div>
          <div className="col-md-2 col-sm-4">
            <div className="card bg-warning text-white text-center py-2">
              <h5>{stats.staff_borrowings}</h5>
              <small>Staff</small>
            </div>
          </div>
          <div className="col-md-2 col-sm-4">
            <div className="card bg-secondary text-white text-center py-2">
              <h5>{stats.recent_borrowings}</h5>
              <small>Last 30 days</small>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="row mb-4">
        <div className="col-md-6">
          <div className="btn-group" role="group">
            <button 
              className={`btn btn-outline-secondary ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({borrowings.length})
            </button>
            <button 
              className={`btn btn-outline-secondary ${filter === 'borrowed' ? 'active' : ''}`}
              onClick={() => setFilter('borrowed')}
            >
              Borrowed ({borrowings.filter(b => b.status === 'borrowed').length})
            </button>
            <button 
              className={`btn btn-outline-secondary ${filter === 'overdue' ? 'active' : ''}`}
              onClick={() => setFilter('overdue')}
            >
              Overdue ({borrowings.filter(b => b.status === 'overdue').length})
            </button>
            <button 
              className={`btn btn-outline-secondary ${filter === 'returned' ? 'active' : ''}`}
              onClick={() => setFilter('returned')}
            >
              Returned ({borrowings.filter(b => b.status === 'returned').length})
            </button>
          </div>
        </div>
        <div className="col-md-6">
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Search by book title, author, student/staff name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {filteredBorrowings.length === 0 ? (
        <div className="text-center py-5 bg-light rounded">
          <div style={{ fontSize: '4rem' }}>📖</div>
          <h4>No borrowings found</h4>
          <p className="text-muted">Try adjusting your filters or search criteria</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-hover">
            <thead className="table-dark">
              <tr>
                <th>#</th>
                <th>Book</th>
                <th>Borrower</th>
                <th>Role</th>
                <th>Borrowed Date</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Fine</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBorrowings.map((borrowing, index) => {
                const borrower = getBorrowerInfo(borrowing);
                return (
                  <tr key={borrowing.id}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{borrowing.book_details?.title || 'N/A'}</strong>
                      <br />
                      <small className="text-muted">by {borrowing.book_details?.author || 'N/A'}</small>
                    </td>
                    <td>
                      <strong>{borrower.name}</strong>
                      <br />
                      <small className="text-muted">ID: {borrower.id}</small>
                    </td>
                    <td>
                      <span className="badge bg-info">
                        {borrower.role}
                      </span>
                      {borrower.position && (

                        <small className="text-muted">{borrower.position}</small>
                      )}
                    </td>
                    <td>{new Date(borrowing.borrow_date).toLocaleDateString()}</td>
                    <td>
                      {new Date(borrowing.due_date).toLocaleDateString()}
                      {borrowing.is_overdue && (
                        <span className="badge bg-danger ms-1">OVERDUE</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge bg-${getStatusBadge(borrowing.status)}`}>
                        {borrowing.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {borrowing.fine_amount > 0 ? (
                        <span className="text-danger">${borrowing.fine_amount}</span>
                      ) : (
                        <span className="text-muted">$0.00</span>
                      )}
                    </td>
                    <td>
                      <Link 
                        to={`/borrowings/${borrowing.id}`} 
                        className="btn btn-sm btn-outline-primary"
                      >
                        <i className="bi bi-eye"></i>
                      </Link>
                      {borrowing.status !== 'returned' && (
                        <button 
                          className="btn btn-sm btn-outline-success ms-1"
                          onClick={() => handleReturn(borrowing.id)}
                        >
                          <i className="bi bi-arrow-return-left"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AllBorrowings;