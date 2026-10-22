import React, { useState, useEffect, useCallback } from 'react';
import Recommendations from '../recommendations/Recommendations';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import bookService from '../../services/bookService';
import recommendationService from '../../services/recommendationService';

const BookList = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [availabilityFilter, setAvailabilityFilter] = useState('all');

  // ✅ Fetch the LIST of books (NOT details)
  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        ...(search && { search }),
        ...(category && { category }),
      };

      const response = await bookService.getBooks(params);
      const data = response.data;

      let list = [];
      let pag = {};

      if (data && data.results) {
        list = data.results;
        pag = {
          count: data.count || 0,
          next: data.next,
          previous: data.previous,
        };
      } else if (Array.isArray(data)) {
        list = data;
        pag = { count: data.length };
      }

      // Normalize each book
      const normalized = list.map((book) => ({
        ...book,
        category_name:
          book.category_name || book.category?.name || 'Uncategorized',
        is_available: (book.available_quantity || 0) > 0,
      }));

      setBooks(normalized);
      setPagination(pag);
    } catch (error) {
      console.error('Error fetching books:', error);
      toast.error('Failed to load books');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, category]);

  const fetchCategories = async () => {
    try {
      const response = await bookService.getCategories();
      const data = response.data?.results || response.data || [];
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn('Categories unavailable:', error);
      setCategories([]);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchBooks();
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setAvailabilityFilter('all');
    setCurrentPage(1);
  };

  // ✅ Just record click — do NOT fetch details here
  const handleBookClick = (bookId) => {
    if (!bookId) return;
    try {
      recommendationService.recordActivity(bookId, 'click');
    } catch (error) {
      console.warn('Activity recording not available:', error);
    }
  };

  if (loading && books.length === 0) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading books...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>📚 Browse Books</h2>
          <p className="text-muted mb-0">Search and borrow from our collection</p>
        </div>
        <span className="badge bg-primary fs-6">
          {pagination.count || books.length} books
        </span>
      </div>

      {/* Search + Filters */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <form onSubmit={handleSearch}>
            <div className="row g-3">
              <div className="col-md-5">
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="bi bi-search"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by title, author, ISBN..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="col-md-3">
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-2">
                <select
                  className="form-select"
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="available">Available Only</option>
                </select>
              </div>

              <div className="col-md-2">
                <button type="submit" className="btn btn-primary w-100">
                  Search
                </button>
              </div>
            </div>
          </form>

          {(search || category || availabilityFilter !== 'all') && (
            <div className="mt-3">
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={clearFilters}
              >
                <i className="bi bi-x-circle me-1"></i>
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Books Grid */}
      {books.length === 0 ? (
        <div className="text-center py-5 bg-light rounded">
          <div style={{ fontSize: '4rem' }}>📚</div>
          <h4>No books found</h4>
          <p className="text-muted">Try adjusting your search criteria</p>
          <button className="btn btn-primary" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="row">
          {books
            .filter((b) =>
              availabilityFilter === 'available' ? b.is_available : true
            )
            .map((book) => (
              <div
                key={book.id}
                className="col-lg-3 col-md-4 col-sm-6 mb-4"
              >
                <div className="card h-100 shadow-sm card-hover">
                  <div
                    className="text-center pt-3"
                    style={{ fontSize: '3rem' }}
                  >
                    {book.cover_image ? (
                      <img
                        src={book.cover_image}
                        alt={book.title}
                        style={{
                          width: '100px',
                          height: '140px',
                          objectFit: 'cover',
                        }}
                        className="rounded"
                      />
                    ) : (
                      '📖'
                    )}
                  </div>

                  <div className="card-body">
                    <h6
                      className="card-title text-truncate"
                      title={book.title}
                    >
                      {book.title}
                    </h6>
                    <p className="card-text text-muted small mb-2">
                      by {book.author}
                    </p>

                    <div className="mb-2">
                      <span className="badge bg-secondary me-1">
                        {book.category_name}
                      </span>
                      <span
                        className={`badge bg-${
                          book.is_available ? 'success' : 'danger'
                        }`}
                      >
                        {book.is_available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>

                    {book.average_rating && (
                      <div className="mb-2">
                        <span className="text-warning">⭐</span>
                        <span className="ms-1">
                          {book.average_rating.toFixed(1)}
                        </span>
                        <small className="text-muted">
                          ({book.reviews_count || 0})
                        </small>
                      </div>
                    )}

                    <small className="text-muted d-block">
                      {book.available_quantity} of {book.quantity} copies
                    </small>
                  </div>

                  <div className="card-footer bg-transparent">
                    <Link
                      to={`/books/${book.id}`}
                      className="btn btn-primary btn-sm w-100"
                      onClick={() => handleBookClick(book.id)}
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.count > 0 && (
        <nav className="mt-4">
          <ul className="pagination justify-content-center">
            <li
              className={`page-item ${
                !pagination.previous ? 'disabled' : ''
              }`}
            >
              <button
                className="page-link"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={!pagination.previous}
              >
                <i className="bi bi-chevron-left"></i> Previous
              </button>
            </li>
            <li className="page-item disabled">
              <span className="page-link">Page {currentPage}</span>
            </li>
            <li
              className={`page-item ${!pagination.next ? 'disabled' : ''}`}
            >
              <button
                className="page-link"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={!pagination.next}
              >
                Next <i className="bi bi-chevron-right"></i>
              </button>
            </li>
          </ul>
        </nav>
      )}
      {/* AI Recommendations available to all users */}
      <Recommendations embedded />
    </div>
  );
};

export default BookList;