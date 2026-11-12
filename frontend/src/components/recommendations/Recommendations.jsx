import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import recommendationService from '../../services/recommendationService';

const Recommendations = ({ embedded = false }) => {
  const { user, isAuthenticated } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [popularBooks, setPopularBooks] = useState([]);
  const [trendingBooks, setTrendingBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('personalized');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [error, setError] = useState('');

  // AI Librarian State
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  useEffect(() => {
    fetchAllData();
  }, [availableOnly]);

  const fetchAllData = async () => {
    setLoading(true);
    setError('');

    try {
      await Promise.all([
        fetchRecommendations(),
        fetchPopularBooks(),
        fetchTrendingBooks(),
      ]);
    } catch (err) {
      setError('Failed to load some recommendations');
    }
    setLoading(false);
  };

  const fetchRecommendations = async () => {
    try {
      const params = availableOnly ? { available_only: true } : {};
      const response = await recommendationService.getRecommendations(params);
      let data = response.data;

      if (data?.results) data = data.results;
      if (!Array.isArray(data)) data = [];

      setRecommendations(data);
    } catch (error) {
      console.warn('Error fetching recommendations:', error);
      setRecommendations([]);
    }
  };

  const fetchPopularBooks = async () => {
    try {
      const response = await recommendationService.getPopularBooks(8);
      let data = response.data;

      if (data?.results) data = data.results;
      if (!Array.isArray(data)) data = [];

      setPopularBooks(data);
    } catch (error) {
      console.warn('Error fetching popular books:', error);
      setPopularBooks([]);
    }
  };

  const fetchTrendingBooks = async () => {
    try {
      const response = await recommendationService.getTrendingBooks(8);
      let data = response.data;

      if (data?.results) data = data.results;
      if (!Array.isArray(data)) data = [];

      setTrendingBooks(data);
    } catch (error) {
      console.warn('Error fetching trending books:', error);
      setTrendingBooks([]);
    }
  };

  const handleGenerateRecommendations = async () => {
    setGenerating(true);
    try {
      await recommendationService.generateRecommendations();
      toast.success('Recommendations refreshed with latest activity!');
      await fetchRecommendations();
      setActiveTab('personalized');
    } catch (error) {
      console.error('Error generating recommendations:', error);
      toast.error(error.response?.data?.error || 'Failed to refresh recommendations');
    }
    setGenerating(false);
  };

  const handleBookClick = (bookId) => {
    try {
      if (isAuthenticated) {
        recommendationService.recordActivity(bookId, 'recommendation_click');
      }
    } catch (error) {
      console.warn('Error recording activity:', error);
    }
  };

  const handleAskAiLibrarian = async (e) => {
    if (e) e.preventDefault();
    if (!aiQuery.trim()) {
      toast.info('Please enter what you are looking for!');
      return;
    }

    setAiLoading(true);
    try {
      const response = await recommendationService.askAiLibrarian(aiQuery.trim(), 4);
      setAiResult(response.data);
    } catch (err) {
      console.error('AI Librarian error:', err);
      toast.error('Failed to get AI recommendation. Please ensure Ollama is running.');
    }
    setAiLoading(false);
  };

  const renderBookCard = (rec, defaultBadge = null) => {
    const book = rec.book || rec;
    const score = rec.score;
    const reason = rec.reason || defaultBadge?.reason;
    const badgeText = defaultBadge?.text || (score ? `Match: ${(score * 100).toFixed(0)}%` : 'Recommended');
    const badgeColor = defaultBadge?.color || 'primary';

    const coverUrl = book.cover;

    return (
      <div key={rec.id || book.id} className="col-lg-3 col-md-4 col-sm-6 mb-4">
        <div className="card h-100 shadow-sm card-hover border-0">
          <div className="card-body d-flex flex-column">
            {/* Book Cover or Icon */}
            <div className="text-center mb-3" style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={book.title}
                  style={{ maxHeight: '135px', maxWidth: '100%', objectFit: 'contain' }}
                  className="rounded shadow-sm"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
              ) : null}
              <div style={{ fontSize: '3rem', display: coverUrl ? 'none' : 'block' }}>
                📖
              </div>
            </div>

            {/* Badges */}
            <div className="d-flex justify-content-between align-items-center gap-1 mb-2 flex-wrap">
              <span className={`badge bg-${badgeColor}`}>
                {badgeText}
              </span>
              {(book.category_name || book.category?.name) && (
                <span className="badge bg-light text-dark text-truncate" style={{ maxWidth: '120px' }}>
                  {book.category_name || book.category?.name}
                </span>
              )}
            </div>

            {/* Title & Author */}
            <h6 className="card-title text-truncate fw-bold mb-1" title={book.title}>
              {book.title}
            </h6>
            <p className="card-text text-muted small mb-2 text-truncate">
              by {book.author || 'Unknown'}
            </p>

            {/* Grounded Recommendation Reason */}
            {reason && (
              <div
                className="bg-light p-2 rounded small text-secondary mb-2 fst-italic"
                style={{ fontSize: '0.75rem', minHeight: '38px', lineHeight: '1.2' }}
              >
                <i className="bi bi-lightbulb text-warning me-1"></i>
                {reason}
              </div>
            )}

            {/* Availability & Rating */}
            <div className="d-flex justify-content-between align-items-center mt-auto pt-2 border-top">
              <span className={`small ${book.available_copies > 0 ? 'text-success' : 'text-danger'}`}>
                {book.available_copies > 0 ? `${book.available_copies} available` : 'Checked out'}
              </span>
              {book.average_rating ? (
                <span className="small text-muted">
                  <span className="text-warning">★</span> {Number(book.average_rating).toFixed(1)}
                </span>
              ) : null}
            </div>

            <Link
              to={`/books/${book.id}`}
              className="btn btn-sm btn-outline-primary w-100 mt-2"
              onClick={() => handleBookClick(book.id)}
            >
              View Book
            </Link>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center my-5 py-4">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading recommendations...</span>
        </div>
        <p className="mt-2 text-muted">Finding the best books for you...</p>
      </div>
    );
  }

  return (
    <div className={embedded ? 'mt-4 pt-4 border-top' : 'container py-4'}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h2 className="h4 fw-bold mb-1">
            {embedded ? '📚 Recommended For You' : '🤖 AI Book Recommendations'}
          </h2>
          <p className="text-muted small mb-0">
            Personalized hybrid recommendations powered by TF-IDF similarity, collaborative filtering, and local Ollama AI.
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <div className="form-check form-switch mb-0 me-2">
            <input
              className="form-check-input"
              type="checkbox"
              id="availSwitch"
              checked={availableOnly}
              onChange={(e) => setAvailableOnly(e.target.checked)}
            />
            <label className="form-check-label small text-muted" htmlFor="availSwitch">
              Available Only
            </label>
          </div>

          {isAuthenticated && (
            <button
              className="btn btn-sm btn-primary"
              onClick={handleGenerateRecommendations}
              disabled={generating}
              title="Refresh personalized recommendations based on your latest interactions"
            >
              {generating ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1"></span>
                  Updating...
                </>
              ) : (
                <>
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  Refresh
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Guest Notice */}
      {!isAuthenticated && (
        <div className="alert alert-info py-2 px-3 mb-3 d-flex justify-content-between align-items-center">
          <span className="small">
            <i className="bi bi-info-circle-fill me-1"></i>
            Showing library-wide popular recommendations. <strong>Sign in</strong> for personalized recommendations based on your reading history.
          </span>
          <Link to="/login" className="btn btn-sm btn-outline-primary ms-2">
            Sign In
          </Link>
        </div>
      )}

      {error && (
        <div className="alert alert-warning alert-dismissible fade show">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Navigation Tabs */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'personalized' ? 'active fw-bold' : ''}`}
            onClick={() => setActiveTab('personalized')}
          >
            <i className="bi bi-person-check me-1"></i>
            Personalized ({recommendations.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'ask-ai' ? 'active fw-bold text-primary' : ''}`}
            onClick={() => setActiveTab('ask-ai')}
          >
            <i className="bi bi-robot me-1"></i>
            Ask AI Librarian (Ollama)
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'popular' ? 'active fw-bold' : ''}`}
            onClick={() => setActiveTab('popular')}
          >
            <i className="bi bi-fire me-1 text-danger"></i>
            Popular ({popularBooks.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'trending' ? 'active fw-bold' : ''}`}
            onClick={() => setActiveTab('trending')}
          >
            <i className="bi bi-graph-up-arrow me-1 text-success"></i>
            Trending ({trendingBooks.length})
          </button>
        </li>
      </ul>

      {/* Tab: Personalized */}
      {activeTab === 'personalized' && (
        <div>
          {recommendations.length > 0 ? (
            <div className="row">
              {recommendations.map((rec) => renderBookCard(rec))}
            </div>
          ) : (
            <div className="text-center py-5 bg-light rounded">
              <div style={{ fontSize: '3.5rem' }}>📚</div>
              <h5 className="mt-2">No personalized recommendations yet</h5>
              <p className="text-muted small">
                Borrow, rate, or view books to train your personalized hybrid recommendation profile!
              </p>
              <Link to="/books" className="btn btn-outline-primary btn-sm">
                Explore Library Books
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Tab: Ask AI Librarian (Ollama Llama 3.2) */}
      {activeTab === 'ask-ai' && (
        <div className="mb-4">
          <div className="card shadow-sm border-0 mb-4 bg-light">
            <div className="card-body p-4">
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="badge bg-primary px-3 py-2 rounded-pill">
                  <i className="bi bi-cpu me-1"></i> Local Ollama · Llama 3.2
                </span>
                <span className="text-success small fw-semibold">
                  <i className="bi bi-check-circle-fill me-1"></i> Private & Offline AI
                </span>
              </div>
              <h5 className="fw-bold mb-2">Ask the AI Librarian</h5>
              <p className="text-muted small mb-3">
                Describe what you want to learn, your favorite topics, or a specific reading mood.
                Our local Ollama AI will search the library catalog and explain which books fit best.
              </p>

              <form onSubmit={handleAskAiLibrarian} className="d-flex gap-2">
                <input
                  type="text"
                  className="form-control form-control-lg"
                  placeholder="e.g. I want to learn clean coding and algorithms for Python interviews..."
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  disabled={aiLoading}
                />
                <button
                  type="submit"
                  className="btn btn-primary px-4 fw-semibold d-flex align-items-center gap-2"
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm"></span>
                      <span>Thinking...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-stars"></i>
                      <span>Ask AI</span>
                    </>
                  )}
                </button>
              </form>

              {/* Sample Prompts */}
              <div className="d-flex gap-2 mt-3 flex-wrap align-items-center">
                <span className="small text-muted">Try:</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary py-0 px-2"
                  onClick={() => setAiQuery('Clean software design and programming best practices')}
                >
                  💻 Clean code & design
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary py-0 px-2"
                  onClick={() => setAiQuery('Inspiring books on cosmology, physics, and science')}
                >
                  🚀 Cosmology & Physics
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary py-0 px-2"
                  onClick={() => setAiQuery('Classic dystopian fiction about freedom and surveillance')}
                >
                  📖 Dystopian fiction
                </button>
              </div>
            </div>
          </div>

          {/* AI Response Box */}
          {aiResult && (
            <div className="mb-4">
              <div className="alert alert-primary shadow-sm border-0 p-3 mb-4">
                <div className="d-flex align-items-start gap-2">
                  <div style={{ fontSize: '1.5rem' }}>🤖</div>
                  <div>
                    <h6 className="fw-bold mb-1">AI Librarian Advice:</h6>
                    <p className="mb-0 text-dark" style={{ lineHeight: '1.5' }}>
                      {aiResult.answer}
                    </p>
                    <div className="small text-muted mt-2">
                      <i className="bi bi-lightning-charge-fill text-warning me-1"></i>
                      {aiResult.powered_by}
                    </div>
                  </div>
                </div>
              </div>

              <h6 className="fw-bold mb-3">Matched Library Catalog Books:</h6>
              <div className="row">
                {aiResult.results?.map((rec) =>
                  renderBookCard(rec, { text: 'AI Pick', color: 'primary', reason: rec.reason })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Popular */}
      {activeTab === 'popular' && (
        <div>
          {popularBooks.length > 0 ? (
            <div className="row">
              {popularBooks.map((book) =>
                renderBookCard(book, { text: '🔥 Popular', color: 'success', reason: 'High borrow count and top community ratings' })
              )}
            </div>
          ) : (
            <div className="text-center py-5 bg-light rounded">
              <p className="text-muted">No popular books found.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Trending */}
      {activeTab === 'trending' && (
        <div>
          {trendingBooks.length > 0 ? (
            <div className="row">
              {trendingBooks.map((book) =>
                renderBookCard(book, { text: '📈 Trending', color: 'info', reason: 'Frequently borrowed and viewed this month' })
              )}
            </div>
          ) : (
            <div className="text-center py-5 bg-light rounded">
              <p className="text-muted">No trending books found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Recommendations;
