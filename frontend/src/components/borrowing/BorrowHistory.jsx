import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import borrowingService from '../../services/borrowingService';
import ReturnBookModal from './ReturnBookModal';

const BorrowHistory = () => {
  const [borrowings, setBorrowings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  
  // Return modal state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedBorrowing, setSelectedBorrowing] = useState(null);

  useEffect(() => {
    fetchBorrowings();
  }, []);

  const fetchBorrowings = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await borrowingService.getMyBorrowings();
      let data = response.data;

      // Handle paginated response
      if (data && data.results) {
        data = data.results;
      }

      // Ensure array
      if (!Array.isArray(data)) {
        data = [];
      }

      // Process data
      data = data.map(item => ({
        ...item,
        book_details: item.book_details || item.book || {},
        is_overdue: item.is_overdue || false,
        payment_amount: item.payment_amount || 0
      }));

      setBorrowings(data);
    } catch (error) {
      console.error('Error fetching borrowings:', error);
      setError('Failed to load your borrowings. Please try again.');
      setBorrowings([]);
    }
    setLoading(false);
  };

  const handleRenew = async (id) => {
    try {
      await borrowingService.renewBorrowing(id);
      toast.success('Book renewed successfully!');
      fetchBorrowings();
    } catch (error) {
      console.error('Error renewing borrowing:', error);
      toast.error(error.response?.data?.error || 'Failed to renew book');
    }
  };

  const handleReturnClick = (borrowing) => {
    setSelectedBorrowing(borrowing);
    setShowReturnModal(true);
  };

  const handleReturnSuccess = () => {
    toast.success('Book returned successfully!');
    setShowReturnModal(false);
    setSelectedBorrowing(null);
    fetchBorrowings();
  };

  const getFilteredBorrowings = () => {
    switch (filter) {
      case 'active':
        return borrowings.filter(b => 
          ['borrowed', 'renewed', 'overdue'].includes(b.status)
        );
      case 'returned':
        return borrowings.filter(b => b.status === 'returned');
      case 'overdue':
        return borrowings.filter(b => b.is_overdue || b.status === 'overdue');
      default:
        return borrowings;
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      borrowed: 'primary',
      returned: 'success',
      overdue: 'danger',
      renewed: 'info',
      pending: 'warning',
      cancelled: 'secondary',
      damaged: 'warning',
      lost: 'danger'
    };
    return colors[status] || 'secondary';
  };

  const getBookTitle = (borrowing) => {
    return borrowing.book_details?.title || 
           borrowing.book?.title || 
           'Unknown Book';
  };

  const getBookAuthor = (borrowing) => {
    return borrowing.book_details?.author || 
           borrowing.book?.author || 
           'Unknown Author';
  };

  const getBookId = (borrowing) => {
    return borrowing.book?.id || borrowing.book_details?.id || borrowing.book;
  };

  const canReturn = (borrowing) => {
    return !['returned', 'cancelled', 'damaged', 'lost'].includes(borrowing.status);
  };

  const canRenew = (borrowing) => {
    return ['borrowed', 'overdue'].includes(borrowing.status);
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading your borrowings...</p>
      </div>
    );
  }

  const filteredBorrowings = getFilteredBorrowings();

  // Counts for filters
  const counts = {
    all: borrowings.length,
    active: borrowings.filter(b => ['borrowed', 'renewed', 'overdue'].includes(b.status)).length,
    returned: borrowings.filter(b => b.status === 'returned').length,
    overdue: borrowings.filter(b => b.is_overdue || b.status === 'overdue').length
  };

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>📖 My Borrowings</h2>
          <p className="text-muted mb-0">View and manage your borrowed books</p>
        </div>
        <Link to="/books" className="btn btn-primary">
          <i className="bi bi-plus-circle me-1"></i>
          Borrow New Book
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4">
        <div className="btn-group flex-wrap">
          <button
            className={`btn btn-outline-secondary ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({counts.all})
          </button>
          <button
            className={`btn btn-outline-primary ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active ({counts.active})
          </button>
          <button
            className={`btn btn-outline-success ${filter === 'returned' ? 'active' : ''}`}
            onClick={() => setFilter('returned')}
          >
            Returned ({counts.returned})
          </button>
          <button
            className={`btn btn-outline-danger ${filter === 'overdue' ? 'active' : ''}`}
            onClick={() => setFilter('overdue')}
          >
            Overdue ({counts.overdue})
          </button>
        </div>
      </div>

      {/* Borrowings List */}
      {filteredBorrowings.length === 0 ? (
        <div className="text-center py-5 bg-light rounded">
          <div style={{ fontSize: '4rem' }}>📖</div>
          <h4>No borrowings found</h4>
          <p className="text-muted">
            {filter === 'all' 
              ? "You haven't borrowed any books yet."
              : `No ${filter} borrowings found.`}
          </p>
          <Link to="/books" className="btn btn-primary">
            Browse Books
          </Link>
        </div>
      ) : (
        <div className="row">
          {filteredBorrowings.map((borrowing) => (
            <div key={borrowing.id} className="col-md-6 mb-4">
              <div className="card shadow-sm h-100">
                <div className="card-body">
                  {/* Header */}
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <h5 className="card-title mb-1">
                        <Link 
                          to={`/books/${getBookId(borrowing)}`}
                          className="text-decoration-none"
                        >
                          {getBookTitle(borrowing)}
                        </Link>
                      </h5>
                      <p className="text-muted small mb-0">
                        by {getBookAuthor(borrowing)}
                      </p>
                    </div>
                    <span className={`badge bg-${getStatusBadge(borrowing.status)}`}>
                      {borrowing.status?.toUpperCase()}
                    </span>
                  </div>

                  {/* Warning badges */}
                  <div className="mb-3">
                    {borrowing.is_overdue && (
                      <span className="badge bg-danger me-1">OVERDUE</span>
                    )}
                    {borrowing.damage_status && borrowing.damage_status !== 'none' && (
                      <span className="badge bg-warning me-1">
                        DAMAGE: {borrowing.damage_status.toUpperCase()}
                      </span>
                    )}
                    {borrowing.payment_status === 'pending' && borrowing.payment_amount > 0 && (
                      <span className="badge bg-warning">
                        PAYMENT PENDING: ${borrowing.payment_amount}
                      </span>
                    )}
                  </div>

                  {/* Dates */}
                  <div className="row small mb-3">
                    <div className="col-6">
                      <strong>Borrowed:</strong>
                      <br />
                      {new Date(borrowing.borrow_date).toLocaleDateString()}
                    </div>
                    <div className="col-6">
                      <strong>Due:</strong>
                      <br />
                      <span className={borrowing.is_overdue ? 'text-danger' : ''}>
                        {new Date(borrowing.due_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {borrowing.return_date && (
                    <div className="small mb-3 text-success">
                      <strong>Returned:</strong>{' '}
                      {new Date(borrowing.return_date).toLocaleDateString()}
                    </div>
                  )}

                  {borrowing.fine_amount > 0 && (
                    <div className="alert alert-warning py-2 mb-3">
                      <small>
                        <strong>Fine:</strong> ${borrowing.fine_amount}
                      </small>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="d-flex gap-2">
                    {canRenew(borrowing) && (
                      <button
                        className="btn btn-sm btn-outline-info flex-fill"
                        onClick={() => handleRenew(borrowing.id)}
                      >
                        <i className="bi bi-arrow-repeat me-1"></i>
                        Renew
                      </button>
                    )}
                    
                    {canReturn(borrowing) && (
                      <button
                        className="btn btn-sm btn-success flex-fill"
                        onClick={() => handleReturnClick(borrowing)}
                      >
                        <i className="bi bi-arrow-return-left me-1"></i>
                        Return
                      </button>
                    )}

                    <Link
                      to={`/books/${getBookId(borrowing)}`}
                      className="btn btn-sm btn-outline-secondary flex-fill"
                    >
                      <i className="bi bi-eye me-1"></i>
                      View Book
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && selectedBorrowing && (
        <ReturnBookModal
          borrowing={selectedBorrowing}
          onClose={() => {
            setShowReturnModal(false);
            setSelectedBorrowing(null);
          }}
          onSuccess={handleReturnSuccess}
        />
      )}
    </div>
  );
};

export default BorrowHistory;