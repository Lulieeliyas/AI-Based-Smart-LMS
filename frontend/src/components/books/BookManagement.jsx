// src/components/books/BookManagement.jsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import bookService from '../../services/bookService';

const EMPTY_FORM = {
  title: '',
  author: '',
  isbn: '',
  category: '',
  publisher: '',
  publication_year: '',
  edition: '',
  pages: '',
  description: '',
  status: 'available',
  quantity: 1,
  available_quantity: 1,
  location: '',
  cover_image: null,
};

const BookManagement = () => {
  // ===== Books state =====
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingBook, setEditingBook] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // ===== Category modal state =====
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [creatingCategory, setCreatingCategory] = useState(false);

  // ===== Initial load =====
  useEffect(() => {
    fetchBooks();
    fetchCategories();
  }, []);

  // ===== Fetch books =====
  const fetchBooks = async () => {
    setLoading(true);
    try {
      const response = await bookService.getBooks();
      const data = response.data?.results || response.data || [];
      setBooks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching books:', err);
      setError('Failed to load books');
    } finally {
      setLoading(false);
    }
  };

  // ===== Fetch categories =====
  const fetchCategories = async () => {
    try {
      const response = await bookService.getCategories();
      let list = [];
      if (Array.isArray(response.data)) {
        list = response.data;
      } else if (response.data?.results) {
        list = response.data.results;
      }
      setCategories(list);
      console.log(`✅ Loaded ${list.length} categories`);
    } catch (err) {
      console.warn('Categories unavailable:', err);
      setCategories([]);
    }
  };

  // ===== Inline category creation =====
  const handleCreateCategory = async (e) => {
    e.preventDefault();

    if (!newCategory.name.trim()) {
      toast.error('Category name is required');
      return;
    }

    setCreatingCategory(true);
    try {
      const response = await bookService.createCategory({
        name: newCategory.name.trim(),
        description: newCategory.description.trim(),
      });

      const created = response.data;
      toast.success(`Category "${created.name}" created`);

      await fetchCategories();
      setFormData((prev) => ({ ...prev, category: created.id }));

      setShowCategoryModal(false);
      setNewCategory({ name: '', description: '' });
    } catch (err) {
      console.error('❌ Create category error:', err);
      const data = err.response?.data;
      let msg = 'Failed to create category';

      if (data) {
        if (typeof data === 'string') msg = data;
        else if (data.name) msg = `Name: ${data.name.join(', ')}`;
        else if (data.detail) msg = data.detail;
        else if (data.error) msg = data.error;
        else {
          msg = Object.entries(data)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join(' | ');
        }
      }
      toast.error(msg);
    } finally {
      setCreatingCategory(false);
    }
  };

  // ===== Form handlers =====
  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'file' ? files[0] : value,
    }));
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingBook(null);
    setError('');
    setSuccess('');
  };

  // ===== Submit (add or edit) =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const payload = new FormData();

      Object.entries(formData).forEach(([key, value]) => {
        // Skip empties (except quantity/available_quantity which default below)
        if (value === null || value === undefined || value === '') return;

        // ✅ cover_image — only append if it's a real File
        if (key === 'cover_image') {
          if (value instanceof File) {
            payload.append('cover_image', value);
          }
          return;
        }

        // Numbers
        if (key === 'quantity' || key === 'available_quantity') {
          payload.append(key, String(Number(value) || 0));
          return;
        }

        payload.append(key, value);
      });

      // Ensure required numeric fields
      if (!payload.has('quantity')) payload.append('quantity', '1');
      if (!payload.has('available_quantity'))
        payload.append('available_quantity', '1');

      // Debug
      console.log('📤 Submitting book:');
      for (const [k, v] of payload.entries()) {
        console.log(`  ${k}:`, v instanceof File ? `File(${v.name})` : v);
      }

      if (editingBook) {
        await bookService.updateBook(editingBook.id, payload);
        setSuccess('Book updated successfully!');
        toast.success('Book updated');
      } else {
        await bookService.createBook(payload);
        setSuccess('Book added successfully!');
        toast.success('Book added');
      }

      setShowForm(false);
      resetForm();
      fetchBooks();
    } catch (err) {
      console.error('Save error:', err);
      console.error('Response:', JSON.stringify(err.response?.data, null, 2));

      let msg = 'Operation failed';
      const data = err.response?.data;

      if (data) {
        if (typeof data === 'string') {
          msg = data;
        } else if (data.detail) {
          msg = data.detail;
        } else if (data.error) {
          msg = data.error;
        } else {
          msg = Object.entries(data)
            .map(([field, errors]) => {
              const t = Array.isArray(errors) ? errors.join(', ') : errors;
              return `${field}: ${t}`;
            })
            .join(' | ');
        }
      }

      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (book) => {
    setEditingBook(book);
    setFormData({
      title: book.title || '',
      author: book.author || '',
      isbn: book.isbn || '',
      category: book.category || '',
      publisher: book.publisher || '',
      publication_year: book.publication_year || '',
      edition: book.edition || '',
      pages: book.pages || '',
      description: book.description || '',
      status: book.status || 'available',
      quantity: book.quantity || 1,
      available_quantity: book.available_quantity || 1,
      location: book.location || '',
      cover_image: null,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}" permanently?`)) return;
    try {
      await bookService.deleteBook(id);
      toast.success('Book deleted');
      fetchBooks();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(err.response?.data?.error || 'Failed to delete book');
    }
  };

  // ===== Filters =====
  const filteredBooks = books.filter((b) => {
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.title?.toLowerCase().includes(q) ||
      b.author?.toLowerCase().includes(q) ||
      b.isbn?.toLowerCase().includes(q)
    );
  });

  // ===== Loading =====
  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-2">Loading books...</p>
      </div>
    );
  }

  return (
    <div>
      {/* ===== HEADER ===== */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 className="mb-1">📚 Book Management</h2>
          <p className="text-muted mb-0">
            {books.length} books • {categories.length} categories
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (showForm) {
              resetForm();
              setShowForm(false);
            } else {
              resetForm();
              setShowForm(true);
            }
          }}
        >
          {showForm ? (
            <>
              <i className="bi bi-x-circle me-1"></i> Cancel
            </>
          ) : (
            <>
              <i className="bi bi-plus-circle me-1"></i> Add New Book
            </>
          )}
        </button>
      </div>

      {/* ===== ALERTS ===== */}
      {error && (
        <div className="alert alert-danger alert-dismissible">
          <strong>Error:</strong> {error}
          <button
            type="button"
            className="btn-close"
            onClick={() => setError('')}
          ></button>
        </div>
      )}
      {success && (
        <div className="alert alert-success alert-dismissible">
          {success}
          <button
            type="button"
            className="btn-close"
            onClick={() => setSuccess('')}
          ></button>
        </div>
      )}

      {/* ===== BOOK FORM ===== */}
      {showForm && (
        <div className="card mb-4 shadow-sm border-primary">
          <div className="card-body">
            <h5 className="mb-3">
              {editingBook ? '✏️ Edit Book' : '➕ Add New Book'}
            </h5>

            <form onSubmit={handleSubmit}>
              {/* Title + Author */}
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Title <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    placeholder="Book title"
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">
                    Author <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    name="author"
                    value={formData.author}
                    onChange={handleChange}
                    required
                    placeholder="Author name"
                  />
                </div>
              </div>

              {/* ISBN + Category + Status */}
              <div className="row">
                {/* ✅ ISBN — now REQUIRED */}
                <div className="col-md-4 mb-3">
                  <label className="form-label">
                    ISBN <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    name="isbn"
                    value={formData.isbn}
                    onChange={handleChange}
                    required
                    placeholder="e.g., 978-1234567890"
                  />
                  <small className="text-muted">
                    Must be unique. Required.
                  </small>
                </div>

                {/* Category + "+" button */}
                <div className="col-md-4 mb-3">
                  <label className="form-label">
                    Category <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <select
                      className="form-select"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      required
                    >
                      <option value="">-- Select Category --</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-outline-success"
                      onClick={() => setShowCategoryModal(true)}
                      title="Add new category"
                    >
                      <i className="bi bi-plus-lg"></i>
                    </button>
                  </div>
                  <small className="text-muted">
                    Click <i className="bi bi-plus-lg text-success"></i> to add
                    a new category
                  </small>
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                  >
                    <option value="available">Available</option>
                    <option value="borrowed">Borrowed</option>
                    <option value="reserved">Reserved</option>
                    <option value="unavailable">Unavailable</option>
                    <option value="damaged">Damaged</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
              </div>

              {/* Publisher + Year + Edition + Pages + Quantity */}
              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label">Publisher</label>
                  <input
                    type="text"
                    className="form-control"
                    name="publisher"
                    value={formData.publisher}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-2 mb-3">
                  <label className="form-label">Year</label>
                  <input
                    type="number"
                    className="form-control"
                    name="publication_year"
                    value={formData.publication_year}
                    onChange={handleChange}
                    placeholder="2024"
                  />
                </div>
                <div className="col-md-2 mb-3">
                  <label className="form-label">Edition</label>
                  <input
                    type="text"
                    className="form-control"
                    name="edition"
                    value={formData.edition}
                    onChange={handleChange}
                    placeholder="1st"
                  />
                </div>
                <div className="col-md-2 mb-3">
                  <label className="form-label">Pages</label>
                  <input
                    type="number"
                    className="form-control"
                    name="pages"
                    value={formData.pages}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-2 mb-3">
                  <label className="form-label">
                    Quantity <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    min="1"
                    required
                  />
                </div>
              </div>

              {/* Available Qty + Location + Cover */}
              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label">
                    Available Quantity <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    name="available_quantity"
                    value={formData.available_quantity}
                    onChange={handleChange}
                    min="0"
                    max={formData.quantity}
                    required
                  />
                  <small className="text-muted">Max: {formData.quantity}</small>
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Location</label>
                  <input
                    type="text"
                    className="form-control"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="e.g., Section A, Shelf 3"
                  />
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">
                    Cover Image <small className="text-muted">(optional)</small>
                  </label>
                  <input
                    type="file"
                    className="form-control"
                    name="cover_image"
                    accept="image/*"
                    onChange={handleChange}
                  />
                  <small className="text-muted">JPG or PNG, up to 5MB</small>
                </div>
              </div>

              {/* Description */}
              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Book summary..."
                ></textarea>
              </div>

              {/* Buttons */}
              <div className="d-flex gap-2">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Saving...
                    </>
                  ) : editingBook ? (
                    <>
                      <i className="bi bi-check-circle me-1"></i> Update Book
                    </>
                  ) : (
                    <>
                      <i className="bi bi-plus-circle me-1"></i> Add Book
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== ADD CATEGORY MODAL ===== */}
      {showCategoryModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCategoryModal(false);
          }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">➕ Add New Category</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowCategoryModal(false)}
                ></button>
              </div>
              <form onSubmit={handleCreateCategory}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">
                      Category Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={newCategory.name}
                      onChange={(e) =>
                        setNewCategory({
                          ...newCategory,
                          name: e.target.value,
                        })
                      }
                      placeholder="e.g., Science Fiction"
                      autoFocus
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">
                      Description (optional)
                    </label>
                    <textarea
                      className="form-control"
                      value={newCategory.description}
                      onChange={(e) =>
                        setNewCategory({
                          ...newCategory,
                          description: e.target.value,
                        })
                      }
                      rows="2"
                      placeholder="Short description"
                    ></textarea>
                  </div>
                  <div className="alert alert-info mb-0 small">
                    <i className="bi bi-info-circle me-1"></i>
                    The new category will be added to the dropdown and
                    auto-selected for this book.
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCategoryModal(false)}
                    disabled={creatingCategory}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={creatingCategory || !newCategory.name.trim()}
                  >
                    {creatingCategory ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Creating...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-1"></i> Create
                        Category
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===== SEARCH + FILTER ===== */}
      <div className="row g-2 mb-3">
        <div className="col-md-8">
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Search by title, author, or ISBN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="col-md-4">
          <select
            className="form-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="borrowed">Borrowed</option>
            <option value="reserved">Reserved</option>
            <option value="unavailable">Unavailable</option>
            <option value="damaged">Damaged</option>
            <option value="lost">Lost</option>
          </select>
        </div>
      </div>

      {/* ===== BOOKS TABLE ===== */}
      <div className="table-responsive">
        <table className="table table-striped table-hover align-middle">
          <thead className="table-dark">
            <tr>
              <th>Cover</th>
              <th>Title</th>
              <th>Author</th>
              <th>Category</th>
              <th>Status</th>
              <th>Available</th>
              <th style={{ width: '180px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBooks.map((book) => (
              <tr key={book.id}>
                <td>
                  {book.cover_image ? (
                    <img
                      src={book.cover_image}
                      alt={book.title}
                      style={{
                        width: '40px',
                        height: '55px',
                        objectFit: 'cover',
                      }}
                      className="rounded"
                    />
                  ) : (
                    <span style={{ fontSize: '1.5rem' }}>📖</span>
                  )}
                </td>
                <td>
                  <strong>{book.title}</strong>
                  {book.isbn && (
                    <>
                      <br />
                      <small className="text-muted">ISBN: {book.isbn}</small>
                    </>
                  )}
                </td>
                <td>{book.author}</td>
                <td>
                  <span className="badge bg-secondary">
                    {book.category_name || 'N/A'}
                  </span>
                </td>
                <td>
                  <span
                    className={`badge bg-${
                      book.status === 'available'
                        ? 'success'
                        : book.status === 'borrowed'
                        ? 'primary'
                        : book.status === 'lost' || book.status === 'damaged'
                        ? 'danger'
                        : 'warning'
                    }`}
                  >
                    {book.status}
                  </span>
                </td>
                <td>
                  <span
                    className={`fw-bold ${
                      book.available_quantity > 0
                        ? 'text-success'
                        : 'text-danger'
                    }`}
                  >
                    {book.available_quantity}
                  </span>
                  <span className="text-muted">/{book.quantity}</span>
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-outline-primary me-1"
                    onClick={() => handleEdit(book)}
                    title="Edit"
                  >
                    <i className="bi bi-pencil"></i> Edit
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleDelete(book.id, book.title)}
                    title="Delete"
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredBooks.length === 0 && (
        <div className="text-center py-5 bg-light rounded">
          <div style={{ fontSize: '4rem' }}>📚</div>
          <h4>No books found</h4>
          <p className="text-muted">
            {search || filterStatus !== 'all'
              ? 'Try adjusting search or filter'
              : 'Add your first book!'}
          </p>
        </div>
      )}
    </div>
  );
};

export default BookManagement;