import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import bookService from '../../services/bookService';
import borrowingService from '../../services/borrowingService';
import recommendationService from '../../services/recommendationService';
import BorrowBookModal from '../borrowing/BorrowBookModal';

const BookDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [book, setBook] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [similarBooks, setSimilarBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [canBorrow, setCanBorrow] = useState(true);
  const [borrowingStatus, setBorrowingStatus] = useState(null);
  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState(5);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Fetch book details
  const fetchBookDetails = async () => {
    try {
      const response = await bookService.getBookDetails(id);
      setBook(response.data);
      setError('');
    } catch (error) {
      console.error('Error fetching book details:', error);
      if (error.response?.status === 404) {
        setError('Book not found');
      } else {
        setError('Failed to load book details');
      }
      setBook(null);
    }
  };

  // Fetch reviews
  const fetchReviews = async () => {
    try {
      const response = await bookService.getReviews(id);
      const data = response.data?.results || response.data || [];
      setReviews(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn('Reviews not available:', error);
      setReviews([]);
    }
  };

  // Fetch similar books
  const fetchSimilarBooks = async () => {
    try {
      const response = await recommendationService.getSimilarBooks(id, 6);
      const data = response.data?.results || response.data || [];
      setSimilarBooks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn('Similar books not available:', error);
      setSimilarBooks([]);
    }
  };

  // Check if user can borrow
  const checkCanBorrow = async () => {
    if (!user || user.role === 'guest') return;
    
    try {
      const response = await borrowingService.canBorrow();
      setCanBorrow(response.data.can_borrow);
      setBorrowingStatus(response.data);
    } catch (error) {
      console.warn('Error checking borrow status:', error);
      setCanBorrow(true);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchBookDetails(),
        fetchReviews(),
        fetchSimilarBooks()
      ]);
      setLoading(false);
    };

    loadData();
    
    // Record view activity
    try {
      recommendationService.recordActivity(id, 'view');
    } catch (error) {
      console.warn('Activity recording not available:', error);
    }
  }, [id]);

  useEffect(() => {
    if (user && user.role !== 'guest') {
      checkCanBorrow();
    }
  }, [user]);

  // Handle borrow
  const handleBorrow = () => {
    if (!canBorrow) {
      toast.warning(borrowingStatus?.message || 'You cannot borrow right now');
      return;
    }
    setShowBorrowModal(true);
  };

  // Handle borrow success
  const handleBorrowSuccess = () => {
    setSuccess('Book borrowed successfully!');
    setShowBorrowModal(false);
    fetchBookDetails();
    checkCanBorrow();
    try {
      recommendationService.recordActivity(id, 'borrow');
    } catch (error) {
      console.warn('Activity recording not available:', error);
    }
    setTimeout(() => setSuccess(''), 3000);
  };

  // Handle review submission
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewText.trim()) {
      toast.error('Please write a review');
      return;
    }

    setSubmittingReview(true);
    try {
      await bookService.addReview(id, { rating, comment: reviewText });
      toast.success('Review added successfully!');
      setReviewText('');
      setRating(5);
      fetchReviews();
    } catch (error) {
      console.error('Error adding review:', error);
      toast.error(error.response?.data?.detail || 'Failed to add review');
    }
    setSubmittingReview(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading book details...</p>
      </div>
    );
  }

  // Error state
  if (error || !book) {
    return (
      <div className="text-center mt-5">
        <div style={{ fontSize: '4rem' }}>📚</div>
        <h3>{error || 'Book not found'}</h3>
        <Link to="/books" className="btn btn-primary">
          <i className="bi bi-arrow-left me-2"></i>
          Back to Books
        </Link>
      </div>
    );
  }

  const isAvailable = book.available_quantity > 0;
  const canUserBorrow = user && user.role !== 'guest' && isAvailable && canBorrow;

  return (
    <div className="book-details">
      {/* Alerts */}
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      
      {/* Borrowing Status Warning */}
      {!canBorrow && borrowingStatus?.message && (
        <div className="alert alert-warning">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {borrowingStatus.message}
        </div>
      )}

      {/* Main Content */}
      <div className="row">
        {/* Book Cover */}
        <div className="col-md-4 col-lg-3 mb-4">
          <div className="card shadow-sm">
            {book.cover_image ? (
              <img
                src={book.cover_image}
                alt={book.title}
                className="card-img-top"
                style={{ height: '350px', objectFit: 'cover' }}
              />
            ) : (
              <div
                className="card-img-top bg-light d-flex align-items-center justify-content-center"
                style={{ height: '350px' }}
              >
                <span style={{ fontSize: '6rem' }}>📚</span>
              </div>
            )}
          </div>
        </div>

        {/* Book Info */}
        <div className="col-md-8 col-lg-9">
          <div className="card shadow-sm">
            <div className="card-body">
              <h2 className="card-title">{book.title}</h2>
              <h5 className="text-muted mb-3">by {book.author}</h5>

              {/* Badges */}
              <div className="mb-3">
                <span className="badge bg-secondary me-2">
                  {book.category_name || 'Uncategorized'}
                </span>
                <span className={`badge bg-${isAvailable ? 'success' : 'danger'} me-2`}>
                  {isAvailable ? '✓ Available' : '✗ Unavailable'}
                </span>
                {book.average_rating && (
                  <span className="badge bg-warning text-dark">
                    ⭐ {book.average_rating.toFixed(1)} ({reviews.length} reviews)
                  </span>
                )}
              </div>

              {/* Book Details */}
              <div className="row mb-3">
                <div className="col-md-6">
                  <table className="table table-sm">
                    <tbody>
                      <tr>
                        <td><strong>ISBN:</strong></td>
                        <td>{book.isbn || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td><strong>Publisher:</strong></td>
                        <td>{book.publisher || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td><strong>Year:</strong></td>
                        <td>{book.publication_year || 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="col-md-6">
                  <table className="table table-sm">
                    <tbody>
                      <tr>
                        <td><strong>Pages:</strong></td>
                        <td>{book.pages || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td><strong>Edition:</strong></td>
                        <td>{book.edition || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td><strong>Location:</strong></td>
                        <td>{book.location || 'Not specified'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Availability */}
              <div className="alert alert-info">
                <i className="bi bi-info-circle me-2"></i>
                <strong>Availability:</strong> {book.available_quantity} of {book.quantity} copies available
              </div>

              {/* Description */}
              <div className="mb-4">
                <h6>Description</h6>
                <p className="text-muted">
                  {book.description || 'No description available for this book.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="d-flex gap-2 flex-wrap">
                {user && user.role !== 'guest' && (
                  <>
                    {isAvailable ? (
                      <button
                        className="btn btn-primary btn-lg"
                        onClick={handleBorrow}
                        disabled={!canBorrow}
                      >
                        <i className="bi bi-book me-2"></i>
                        Borrow Book
                      </button>
                    ) : (
                      <button className="btn btn-secondary btn-lg" disabled>
                        <i className="bi bi-x-circle me-2"></i>
                        Not Available
                      </button>
                    )}
                  </>
                )}
                
                {(!user || user.role === 'guest') && (
                  <Link to="/login" className="btn btn-primary btn-lg">
                    <i className="bi bi-box-arrow-in-right me-2"></i>
                    Login to Borrow
                  </Link>
                )}

                <button
                  className="btn btn-outline-secondary btn-lg"
                  onClick={() => navigate(-1)}
                >
                  <i className="bi bi-arrow-left me-2"></i>
                  Back
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Similar Books */}
      {similarBooks.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-3">📚 Similar Books</h4>
          <div className="row">
            {similarBooks.map((item) => {
              const similarBook = item.book || item;
              return (
                <div key={similarBook.id} className="col-md-2 col-sm-4 col-6 mb-3">
                  <div className="card h-100 shadow-sm">
                    <div className="card-body text-center">
                      <div style={{ fontSize: '2rem' }}>📖</div>
                      <h6 className="card-title text-truncate mt-2">
                        {similarBook.title}
                      </h6>
                      <p className="card-text text-muted small">
                        {similarBook.author}
                      </p>
                      <Link
                        to={`/books/${similarBook.id}`}
                        className="btn btn-sm btn-outline-primary"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reviews Section */}
      <div className="mt-5">
        <h4 className="mb-3">💬 Reviews ({reviews.length})</h4>

        {/* Write Review */}
        {user && user.role !== 'guest' && (
          <div className="card mb-4">
            <div className="card-body">
              <h6>Write a Review</h6>
              <form onSubmit={handleReviewSubmit}>
                <div className="row g-2">
                  <div className="col-md-2">
                    <select
                      className="form-select"
                      value={rating}
                      onChange={(e) => setRating(parseInt(e.target.value))}
                    >
                      {[1, 2, 3, 4, 5].map(r => (
                        <option key={r} value={r}>{r} ⭐</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-8">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Share your thoughts about this book..."
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                    />
                  </div>
                  <div className="col-md-2">
                    <button
                      type="submit"
                      className="btn btn-primary w-100"
                      disabled={submittingReview}
                    >
                      {submittingReview ? (
                        <span className="spinner-border spinner-border-sm"></span>
                      ) : (
                        'Submit'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <div className="text-center py-4 bg-light rounded">
            <p className="text-muted mb-0">No reviews yet. Be the first to review!</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="card mb-2">
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <strong>{review.user || review.user_name || 'Anonymous'}</strong>
                  <span className="text-warning">
                    {'⭐'.repeat(review.rating)}
                  </span>
                </div>
                <p className="mb-1">{review.comment}</p>
                <small className="text-muted">
                  {new Date(review.created_at).toLocaleDateString()}
                </small>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Borrow Modal */}
      {showBorrowModal && book && (
        <BorrowBookModal
          book={book}
          onClose={() => setShowBorrowModal(false)}
          onSuccess={handleBorrowSuccess}
        />
      )}
    </div>
  );
};

export default BookDetails;