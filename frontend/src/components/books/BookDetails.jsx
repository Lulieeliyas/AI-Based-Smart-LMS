import React, { useState, useEffect, useCallback } from 'react';
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
  const [checkingBorrowStatus, setCheckingBorrowStatus] = useState(false);
  const [borrowingStatus, setBorrowingStatus] = useState(null);

  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState(5);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Load book details
  const fetchBookDetails = useCallback(async () => {
    try {
      const response = await bookService.getBookDetails(id);
      setBook(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching book details:', err);

      if (err.response?.status === 404) {
        setError('Book not found.');
      } else {
        setError('Failed to load book details.');
      }

      setBook(null);
    }
  }, [id]);

  // Load book reviews
  const fetchReviews = useCallback(async () => {
    try {
      const response = await bookService.getReviews(id);
      const data = response.data?.results || response.data || [];

      setReviews(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Reviews could not be loaded:', err);
      setReviews([]);
    }
  }, [id]);

  // Load similar books
  const fetchSimilarBooks = useCallback(async () => {
    try {
      const response = await recommendationService.getSimilarBooks(id, 6);
      const data = response.data?.results || response.data || [];

      setSimilarBooks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Similar books could not be loaded:', err);
      setSimilarBooks([]);
    }
  }, [id]);

  // Check whether the logged-in user can submit a request
  const checkCanBorrow = useCallback(async () => {
    if (!user || user.role === 'guest') {
      setCanBorrow(false);
      setBorrowingStatus(null);
      return;
    }

    setCheckingBorrowStatus(true);

    try {
      const response = await borrowingService.canBorrow();
      const data = response.data || {};

      setCanBorrow(Boolean(data.can_borrow));
      setBorrowingStatus(data);
    } catch (err) {
      console.error('Could not check borrowing eligibility:', err);
      setCanBorrow(false);
      setBorrowingStatus({
        message: 'Unable to check your borrowing eligibility. Please try again.',
      });
    } finally {
      setCheckingBorrowStatus(false);
    }
  }, [user]);

  // Load page data
  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoading(true);

      await Promise.all([
        fetchBookDetails(),
        fetchReviews(),
        fetchSimilarBooks(),
      ]);

      if (active) {
        setLoading(false);
      }
    };

    loadData();

    // Record book view activity
    recommendationService
      .recordActivity(id, 'view')
      .catch((err) => {
        console.warn('Activity recording unavailable:', err);
      });

    return () => {
      active = false;
    };
  }, [id, fetchBookDetails, fetchReviews, fetchSimilarBooks]);

  useEffect(() => {
    checkCanBorrow();
  }, [checkCanBorrow]);

  // Open borrowing modal
  const handleBorrow = () => {
    if (!user || user.role === 'guest') {
      navigate('/login');
      return;
    }

    if (!canBorrow) {
      toast.warning(
        borrowingStatus?.message || 'You are not currently eligible to borrow.'
      );
      return;
    }

    setShowBorrowModal(true);
  };

  // Called after a borrowing request is successfully submitted
  const handleBorrowSuccess = async () => {
    setShowBorrowModal(false);

    setSuccess(
      'Your borrowing request has been submitted. Waiting for librarian approval.'
    );

    toast.success('Borrow request submitted successfully!');

    await Promise.all([
      fetchBookDetails(),
      checkCanBorrow(),
    ]);

    recommendationService
      .recordActivity(id, 'borrow')
      .catch((err) => {
        console.warn('Activity recording unavailable:', err);
      });

    window.setTimeout(() => {
      setSuccess('');
    }, 5000);
  };

  // Submit a book review
  const handleReviewSubmit = async (e) => {
    e.preventDefault();

    if (!reviewText.trim()) {
      toast.error('Please write a review.');
      return;
    }

    setSubmittingReview(true);

    try {
      await bookService.addReview(id, {
        score: rating,
        review: reviewText.trim(),
      });

      toast.success('Review added successfully!');
      setReviewText('');
      setRating(5);

      await fetchReviews();
    } catch (err) {
      console.error('Error adding review:', err);

      toast.error(
        err.response?.data?.detail ||
        err.response?.data?.error ||
        'Failed to add review.'
      );
    } finally {
      setSubmittingReview(false);
    }
  };

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

  if (error || !book) {
    return (
      <div className="text-center mt-5">
        <div style={{ fontSize: '4rem' }}>📚</div>
        <h3>{error || 'Book not found.'}</h3>

        <Link to="/books" className="btn btn-primary">
          <i className="bi bi-arrow-left me-2"></i>
          Back to Books
        </Link>
      </div>
    );
  }

  // Support both current backend field names and older frontend names
  const availableCopies = Number(
    book.available_copies ?? book.available_quantity ?? 0
  );

  const totalCopies = Number(
    book.total_copies ?? book.quantity ?? 0
  );

  const isAvailable = availableCopies > 0;
  const isLoggedIn = Boolean(user && user.role !== 'guest');

  const canUserBorrow =
    isLoggedIn && isAvailable && canBorrow && !checkingBorrowStatus;

  const averageRating = Number(
    book.average_rating ?? book.average_score ?? 0
  );

  return (
    <div className="book-details container py-4">

      {/* Alerts */}
      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <i className="bi bi-check-circle-fill me-2"></i>
          {success}
        </div>
      )}

      {!canBorrow &&
        isLoggedIn &&
        borrowingStatus?.message && (
          <div className="alert alert-warning">
            <i className="bi bi-exclamation-triangle me-2"></i>
            {borrowingStatus.message}
          </div>
        )}

      {/* Main book information */}
      <div className="row">

        {/* Book cover */}
        <div className="col-md-4 col-lg-3 mb-4">
          <div className="card shadow-sm">
            {book.cover_image ? (
              <img
                src={book.cover_image}
                alt={book.title}
                className="card-img-top"
                style={{
                  height: '350px',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                className="bg-light d-flex align-items-center justify-content-center"
                style={{ height: '350px' }}
              >
                <span style={{ fontSize: '6rem' }}>📚</span>
              </div>
            )}
          </div>
        </div>

        {/* Book information */}
        <div className="col-md-8 col-lg-9">
          <div className="card shadow-sm">
            <div className="card-body">

              <h2 className="card-title">
                {book.title}
              </h2>

              <h5 className="text-muted mb-3">
                by {book.author || 'Unknown author'}
              </h5>

              {/* Badges */}
              <div className="mb-3">

                <span className="badge bg-secondary me-2">
                  {book.category_name || 'Uncategorized'}
                </span>

                <span
                  className={`badge bg-${
                    isAvailable ? 'success' : 'danger'
                  } me-2`}
                >
                  {isAvailable ? '✓ Available' : '✗ Unavailable'}
                </span>

                {averageRating > 0 && (
                  <span className="badge bg-warning text-dark">
                    ⭐ {averageRating.toFixed(1)} ({reviews.length} reviews)
                  </span>
                )}
              </div>

              {/* Book details table */}
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
              <div
                className={`alert ${
                  isAvailable ? 'alert-success' : 'alert-danger'
                }`}
              >
                <i className="bi bi-info-circle me-2"></i>

                <strong>Availability:</strong>{' '}

                {availableCopies} of {totalCopies} copies available
              </div>

              {/* Description */}
              <div className="mb-4">
                <h6>Description</h6>

                <p className="text-muted">
                  {book.description ||
                    'No description available for this book.'}
                </p>
              </div>

              {/* Action buttons */}
              <div className="d-flex gap-2 flex-wrap">

                {isLoggedIn && (
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    onClick={handleBorrow}
                    disabled={!canUserBorrow}
                  >
                    {checkingBorrowStatus ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Checking...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-book me-2"></i>
                        Borrow Book
                      </>
                    )}
                  </button>
                )}

                {!isLoggedIn && (
                  <Link
                    to="/login"
                    className="btn btn-primary btn-lg"
                  >
                    <i className="bi bi-box-arrow-in-right me-2"></i>
                    Login to Borrow
                  </Link>
                )}

                {!isAvailable && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-lg"
                    disabled
                  >
                    <i className="bi bi-x-circle me-2"></i>
                    Not Available
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-outline-secondary btn-lg"
                  onClick={() => navigate(-1)}
                >
                  <i className="bi bi-arrow-left me-2"></i>
                  Back
                </button>

              </div>

              {isLoggedIn && !canBorrow && isAvailable && (
                <small className="text-muted d-block mt-2">
                  Your account is currently not eligible to submit a borrowing request.
                </small>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Similar books */}
      {similarBooks.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-3">📚 Similar Books</h4>

          <div className="row">
            {similarBooks.map((item) => {
              const similarBook = item.book || item;

              return (
                <div
                  key={similarBook.id}
                  className="col-md-2 col-sm-4 col-6 mb-3"
                >
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

      {/* Reviews */}
      <div className="mt-5">
        <h4 className="mb-3">
          💬 Reviews ({reviews.length})
        </h4>

        {/* Review form */}
        {isLoggedIn && (
          <div className="card mb-4">
            <div className="card-body">
              <h6>Write a Review</h6>

              <form onSubmit={handleReviewSubmit}>
                <div className="row g-2">

                  <div className="col-md-2">
                    <select
                      className="form-select"
                      value={rating}
                      onChange={(e) =>
                        setRating(Number(e.target.value))
                      }
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <option key={value} value={value}>
                          {value} ⭐
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-8">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Share your thoughts about this book..."
                      value={reviewText}
                      onChange={(e) =>
                        setReviewText(e.target.value)
                      }
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

        {/* Review list */}
        {reviews.length === 0 ? (
          <div className="text-center py-4 bg-light rounded">
            <p className="text-muted mb-0">
              No reviews yet. Be the first to review!
            </p>
          </div>
        ) : (
          reviews.map((review) => {
            const reviewRating = Number(
              review.rating ?? review.score ?? 0
            );

            return (
              <div key={review.id} className="card mb-2">
                <div className="card-body">

                  <div className="d-flex justify-content-between">
                    <strong>
                      {review.user_name ||
                        review.username ||
                        review.user ||
                        'Anonymous'}
                    </strong>

                    <span className="text-warning">
                      {'⭐'.repeat(
                        Math.min(Math.max(reviewRating, 0), 5)
                      )}
                    </span>
                  </div>

                  <p className="mb-1">
                    {review.comment || review.review || ''}
                  </p>

                  <small className="text-muted">
                    {review.created_at
                      ? new Date(review.created_at).toLocaleDateString()
                      : ''}
                  </small>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Borrow request modal */}
      {showBorrowModal && (
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