import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import publicService from '../../services/publicService';

const PublicDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentBooks, setRecentBooks] = useState([]);
  const [popularBooks, setPopularBooks] = useState([]);
  const [documentation, setDocumentation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicData();
  }, []);

  const fetchPublicData = async () => {
    setLoading(true);
    try {
      const [statsRes, recentRes, popularRes, docRes] = await Promise.all([
        publicService.getStats().catch(() => ({ data: null })),
        publicService.getRecentBooks(8).catch(() => ({ data: [] })),
        publicService.getPopularBooks(8).catch(() => ({ data: [] })),
        publicService.getDocumentation().catch(() => ({ data: null })),
      ]);

      setStats(statsRes.data);
      setRecentBooks(recentRes.data?.results || recentRes.data || []);
      setPopularBooks(popularRes.data?.results || popularRes.data || []);
      setDocumentation(docRes.data);
    } catch (error) {
      console.error('Error fetching public data:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading public dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      {/* ✅ Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card bg-primary text-white shadow-lg border-0 rounded-4 mb-4 overflow-hidden"
      >
        <div className="card-body p-5 text-center">
          <h1 className="display-4 fw-bold mb-3">📚 AI-Based Smart Library</h1>
          <p className="lead mb-4">
            Welcome to Mekdela Amba University Library Management System
          </p>
          <div className="d-flex justify-content-center gap-3 flex-wrap">
            <Link to="/login" className="btn btn-light btn-lg">
              <i className="bi bi-box-arrow-in-right me-2"></i>Let's Start
            </Link>
            {/* <Link to="/register" className="btn btn-warning btn-lg">
              <i className="bi bi-person-plus me-2"></i>Register
            </Link> */}
          </div>
          <p className="mt-3 small opacity-75">
            🔓 You are browsing as a <strong>Guest</strong> — no account needed
          </p>
        </div>
      </motion.div>

      {/* ✅ Statistics Cards */}
      {stats && (
        <>
          <h3 className="mb-3">📊 Library Statistics</h3>
          <div className="row g-3 mb-5">
            <div className="col-md-3 col-sm-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="card text-center shadow-sm border-0 h-100"
              >
                <div className="card-body py-4">
                  <div style={{ fontSize: '3rem' }}>📚</div>
                  <h2 className="text-primary mb-0">{stats.total_books}</h2>
                  <small className="text-muted">Total Books</small>
                </div>
              </motion.div>
            </div>
            <div className="col-md-3 col-sm-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="card text-center shadow-sm border-0 h-100"
              >
                <div className="card-body py-4">
                  <div style={{ fontSize: '3rem' }}>✅</div>
                  <h2 className="text-success mb-0">{stats.available_books}</h2>
                  <small className="text-muted">Available Now</small>
                </div>
              </motion.div>
            </div>
            <div className="col-md-3 col-sm-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="card text-center shadow-sm border-0 h-100"
              >
                <div className="card-body py-4">
                  <div style={{ fontSize: '3rem' }}>👥</div>
                  <h2 className="text-info mb-0">{stats.total_verified_users}</h2>
                  <small className="text-muted">Registered Users</small>
                </div>
              </motion.div>
            </div>
            <div className="col-md-3 col-sm-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="card text-center shadow-sm border-0 h-100"
              >
                <div className="card-body py-4">
                  <div style={{ fontSize: '3rem' }}>📖</div>
                  <h2 className="text-warning mb-0">{stats.active_borrowings}</h2>
                  <small className="text-muted">Active Borrowings</small>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Categories */}
          {stats.categories && stats.categories.length > 0 && (
            <div className="mb-5">
              <h3 className="mb-3">📂 Book Categories</h3>
              <div className="d-flex flex-wrap gap-2">
                {stats.categories.map((cat, i) => (
                  <span key={i} className="badge bg-secondary fs-6 py-2 px-3">
                    {cat.name} ({cat.count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ✅ Recent Books */}
      <div className="mb-5">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h3 className="mb-0">🆕 Recently Added Books</h3>
          <Link to="/public/books" className="btn btn-sm btn-outline-primary">
            View All Books →
          </Link>
        </div>
        {recentBooks.length > 0 ? (
          <div className="row">
            {recentBooks.map((book) => (
              <div key={book.id} className="col-md-3 col-sm-6 mb-3">
                <div className="card h-100 shadow-sm">
                  <div className="card-body text-center">
                    <div style={{ fontSize: '2.5rem' }}>📖</div>
                    <h6 className="card-title text-truncate mt-2">{book.title}</h6>
                    <p className="card-text text-muted small">{book.author}</p>
                    <span className={`badge bg-${book.available_quantity > 0 ? 'success' : 'danger'}`}>
                      {book.available_quantity > 0 ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="alert alert-info">No books available yet.</div>
        )}
      </div>

      {/* ✅ Popular Books */}
      <div className="mb-5">
        <h3 className="mb-3">🔥 Most Popular Books</h3>
        {popularBooks.length > 0 ? (
          <div className="row">
            {popularBooks.map((book) => (
              <div key={book.id} className="col-md-3 col-sm-6 mb-3">
                <div className="card h-100 shadow-sm">
                  <div className="card-body text-center">
                    <div style={{ fontSize: '2.5rem' }}>📚</div>
                    <h6 className="card-title text-truncate mt-2">{book.title}</h6>
                    <p className="card-text text-muted small">{book.author}</p>
                    <span className="badge bg-warning text-dark">
                      {book.borrow_count || 0} borrows
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="alert alert-info">No popular books yet.</div>
        )}
      </div>

      {/* ✅ Documentation */}
      {documentation && (
        <>
          <h3 className="mb-3">📘 About the System</h3>
          <div className="card shadow-sm border-0 mb-4">
            <div className="card-body p-4">
              <h5 className="text-primary">{documentation.about?.title}</h5>
              <p>{documentation.about?.description}</p>
              <div className="row">
                <div className="col-md-6">
                  <p className="mb-1">
                    <strong>University:</strong> {documentation.about?.university}
                  </p>
                  <p className="mb-1">
                    <strong>Department:</strong> {documentation.about?.department}
                  </p>
                  <p className="mb-1">
                    <strong>Advisor:</strong> {documentation.about?.advisor}
                  </p>
                </div>
                <div className="col-md-6">
                  <p className="mb-1"><strong>Team:</strong></p>
                  <ul className="mb-0">
                    {documentation.about?.team?.map((m, i) => (
                      <li key={i}>{m.name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <h3 className="mb-3">✨ Features</h3>
          <div className="row mb-5">
            {documentation.features?.map((f, i) => (
              <div key={i} className="col-md-4 col-sm-6 mb-3">
                <div className="card h-100 shadow-sm border-0">
                  <div className="card-body">
                    <div style={{ fontSize: '2rem' }}>{f.icon}</div>
                    <h6 className="mt-2">{f.title}</h6>
                    <p className="text-muted small mb-0">{f.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h3 className="mb-3">👥 User Roles</h3>
          <div className="row mb-5">
            {documentation.user_roles?.map((r, i) => (
              <div key={i} className="col-md-4 col-sm-6 mb-3">
                <div className="card h-100 shadow-sm border-0">
                  <div className="card-body">
                    <h6 className="text-primary">{r.role}</h6>
                    <p className="text-muted small mb-0">{r.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h3 className="mb-3">🚀 How to Register</h3>
          <ol className="mb-5">
            {documentation.how_to_register?.map((step, i) => (
              <li key={i} className="mb-2">{step}</li>
            ))}
          </ol>

          <h3 className="mb-3">📞 Contact</h3>
          <div className="card shadow-sm border-0 mb-5">
            <div className="card-body">
              <p className="mb-1"><i className="bi bi-envelope me-2"></i>{documentation.contact?.email}</p>
              <p className="mb-1"><i className="bi bi-telephone me-2"></i>{documentation.contact?.phone}</p>
              <p className="mb-0"><i className="bi bi-geo-alt me-2"></i>{documentation.contact?.address}</p>
            </div>
          </div>
        </>
      )}

      {/* ✅ Call to Action */}
      <div className="card bg-success text-white shadow-lg border-0 rounded-4 mb-5">
        <div className="card-body p-5 text-center">
          <h3 className="mb-3">Ready to borrow books?</h3>
          <p className="mb-4">Create an account to start borrowing and get AI-powered recommendations.</p>
          <Link to="/register" className="btn btn-light btn-lg">
            <i className="bi bi-person-plus me-2"></i>Create Free Account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PublicDashboard;