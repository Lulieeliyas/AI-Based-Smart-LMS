import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import publicService from '../../services/publicService';

const PublicBookDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBook();
  }, [id]);

  const fetchBook = async () => {
    setLoading(true);
    try {
      const response = await publicService.getBookDetail(id);
      setBook(response.data);
    } catch (error) {
      console.error('Error fetching book:', error);
      setBook(null);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="text-center mt-5">
        <h3>Book not found</h3>
        <Link to="/public/books" className="btn btn-primary">Back to Books</Link>
      </div>
    );
  }

  return (
    <div>
      <button className="btn btn-outline-secondary mb-3" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div className="alert alert-info">
        <i className="bi bi-info-circle me-2"></i>
        You are browsing as a <strong>Guest</strong>. To borrow this book, please{' '}
        <Link to="/register" className="fw-bold">register</Link> or{' '}
        <Link to="/login" className="fw-bold">login</Link>.
      </div>

      <div className="row">
        <div className="col-md-3">
          {book.cover_image ? (
            <img src={book.cover_image} alt={book.title} className="img-fluid rounded shadow" />
          ) : (
            <div className="bg-light rounded d-flex align-items-center justify-content-center"
                 style={{ height: '300px' }}>
              <span className="display-1">📚</span>
            </div>
          )}
        </div>

        <div className="col-md-9">
          <h2>{book.title}</h2>
          <h5 className="text-muted">by {book.author}</h5>

          <div className="mt-3">
            <span className="badge bg-secondary me-2">{book.category_name}</span>
            <span className={`badge bg-${book.available_quantity > 0 ? 'success' : 'danger'}`}>
              {book.available_quantity > 0 ? 'Available' : 'Unavailable'}
            </span>
          </div>

          <div className="mt-3">
            <p><strong>ISBN:</strong> {book.isbn || 'N/A'}</p>
            <p><strong>Publisher:</strong> {book.publisher || 'N/A'}</p>
            <p><strong>Year:</strong> {book.publication_year || 'N/A'}</p>
            <p><strong>Pages:</strong> {book.pages || 'N/A'}</p>
            <p><strong>Available Copies:</strong> {book.available_quantity} of {book.quantity}</p>
          </div>

          <div className="mt-3">
            <h6>Description</h6>
            <p>{book.description || 'No description available'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicBookDetail;