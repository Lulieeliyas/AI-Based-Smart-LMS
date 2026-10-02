import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import publicService from '../../services/publicService';

const PublicBooks = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const response = await publicService.getBooks({
        search: search || undefined,
      });
      const data = response.data?.results || response.data || [];
      setBooks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching books:', error);
      setBooks([]);
    }
    setLoading(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchBooks();
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status" />
        <p className="mt-2">Loading books...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>📚 Public Book Catalog</h2>
        <Link to="/public" className="btn btn-outline-secondary">
          ← Back to Public Home
        </Link>
      </div>

      <div className="alert alert-info">
        <i className="bi bi-info-circle me-2"></i>
        You are browsing as a <strong>Guest</strong>. To borrow books, please{' '}
        <Link to="/register" className="fw-bold">register</Link> or{' '}
        <Link to="/login" className="fw-bold">login</Link>.
      </div>

      <form onSubmit={handleSearch} className="mb-4">
        <div className="input-group">
          <input
            type="text"
            className="form-control"
            placeholder="Search books by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            <i className="bi bi-search"></i> Search
          </button>
        </div>
      </form>

      {books.length === 0 ? (
        <div className="text-center py-5 bg-light rounded">
          <div style={{ fontSize: '4rem' }}>📚</div>
          <h4>No books found</h4>
          <p className="text-muted">Try a different search term.</p>
        </div>
      ) : (
        <div className="row">
          {books.map((book) => (
            <div key={book.id} className="col-md-3 col-sm-6 mb-4">
              <div className="card h-100 shadow-sm">
                <div className="card-body">
                  <div className="text-center mb-2" style={{ fontSize: '3rem' }}>📖</div>
                  <h5 className="card-title text-truncate">{book.title}</h5>
                  <p className="card-text text-muted small">{book.author}</p>
                  <p className="card-text">
                    <span className="badge bg-secondary me-1">
                      {book.category_name || 'Uncategorized'}
                    </span>
                    <span className={`badge bg-${book.available_quantity > 0 ? 'success' : 'danger'}`}>
                      {book.available_quantity > 0 ? 'Available' : 'Unavailable'}
                    </span>
                  </p>
                  <Link
                    to={`/public/books/${book.id}`}
                    className="btn btn-outline-primary btn-sm w-100"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PublicBooks;