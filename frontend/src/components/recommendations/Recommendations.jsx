import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import recommendationService from '../../services/recommendationService';

const Recommendations = ({ embedded = false }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [popularBooks, setPopularBooks] = useState([]);
  const [trendingBooks, setTrendingBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('personalized');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    setError('');

    try {
      await Promise.all([
        fetchRecommendations(),
        fetchPopularBooks(),
        fetchTrendingBooks()
      ]);
    } catch (err) {
      setError('Failed to load some recommendations');
    }
    setLoading(false);
  };

  const fetchRecommendations = async () => {
    try {
      const response = await recommendationService.getRecommendations();
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
      const response = await recommendationService.getPopularBooks(6);
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
      const response = await recommendationService.getTrendingBooks(6);
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
      toast.success('Recommendations generated successfully!');
      await fetchRecommendations();
      setActiveTab('personalized');
    } catch (error) {
      console.error('Error generating recommendations:', error);
      toast.error(error.response?.data?.error || 'Failed to generate recommendations');
    }
    setGenerating(false);
  };

  const handleBookClick = (bookId) => {
    try {
      recommendationService.recordActivity(bookId, 'recommendation_click');
    } catch (error) {
      console.warn('Error recording activity:', error);
    }
  };

  const renderBookCard = (book, badge = null) => (
    <div key={book.id} className="col-lg-3 col-md-4 col-sm-6 mb-4">
      <div className="card h-100 shadow-sm card-hover">
        <div className="card-body">
          <div className="text-center mb-2" style={{ fontSize: '2.5rem' }}>
            📖
          </div>
          <h6 className="card-title text-truncate" title={book.title}>
            {book.title}
          </h6>
          <p className="card-text text-muted small mb-2">
            {book.author}
          </p>
          
          {badge && (
            <span className={`badge bg-${badge.color} mb-2`}>
              {badge.text}
            </span>
          )}

          {book.average_rating && (
            <div className="mb-2">
              <span className="text-warning">⭐</span>
              <span className="ms-1">{book.average_rating.toFixed(1)}</span>
            </div>
          )}

          <Link
            to={`/books/${book.id}`}
            className="btn btn-sm btn-outline-primary w-100"
            onClick={() => handleBookClick(book.id)}
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading recommendations...</p>
      </div>
    );
  }

  return (
  <div className={embedded ? 'mt-5 pt-4 border-top' : ''}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap">
        <div>
          <h2>{embedded ? '📚 Recommended Books' : '🤖 AI Recommendations'}</h2>
          <p className="text-muted mb-0">
            {embedded
            ? 'Personalized, popular, and trending books'
            : 'Personalized book suggestions powered by AI'}
            </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleGenerateRecommendations}
          disabled={generating}
        >
          {generating ? (
            <>
              <span className="spinner-border spinner-border-sm me-2"></span>
              Generating...
            </>
          ) : (
            <>
              <i className="bi bi-arrow-clockwise me-1"></i>
              Generate New
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="alert alert-warning alert-dismissible fade show">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Tabs */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'personalized' ? 'active' : ''}`}
            onClick={() => setActiveTab('personalized')}
          >
            <i className="bi bi-person me-1"></i>
            Personalized ({recommendations.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'popular' ? 'active' : ''}`}
            onClick={() => setActiveTab('popular')}
          >
            <i className="bi bi-fire me-1"></i>
            Popular ({popularBooks.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'trending' ? 'active' : ''}`}
            onClick={() => setActiveTab('trending')}
          >
            <i className="bi bi-graph-up me-1"></i>
            Trending ({trendingBooks.length})
          </button>
        </li>
      </ul>

      {/* Tab Content */}
      {activeTab === 'personalized' && (
        <div>
          {recommendations.length > 0 ? (
            <div className="row">
              {recommendations.map((rec) => {
                const book = rec.book || rec;
                return renderBookCard(book, {
                  text: rec.score 
                    ? `Match: ${(rec.score * 100).toFixed(0)}%` 
                    : 'Recommended',
                  color: 'info'
                });
              })}
            </div>
          ) : (
            <div className="text-center py-5 bg-light rounded">
              <div style={{ fontSize: '4rem' }}>🤖</div>
              <h4>No recommendations yet</h4>
              <p className="text-muted">
                Borrow some books and generate recommendations to get started!
              </p>
              <button
                className="btn btn-primary"
                onClick={handleGenerateRecommendations}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Generating...
                  </>
                ) : (
                  'Generate Recommendations'
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'popular' && (
        <div>
          {popularBooks.length > 0 ? (
            <div className="row">
              {popularBooks.map((book) => 
                renderBookCard(book, { text: '🔥 Popular', color: 'success' })
              )}
            </div>
          ) : (
            <div className="text-center py-5 bg-light rounded">
              <div style={{ fontSize: '4rem' }}>🔥</div>
              <h4>No popular books yet</h4>
              <p className="text-muted">Check back later for popular books</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'trending' && (
        <div>
          {trendingBooks.length > 0 ? (
            <div className="row">
              {trendingBooks.map((book) => 
                renderBookCard(book, { text: '📈 Trending', color: 'warning' })
              )}
            </div>
          ) : (
            <div className="text-center py-5 bg-light rounded">
              <div style={{ fontSize: '4rem' }}>📈</div>
              <h4>No trending books yet</h4>
              <p className="text-muted">Check back later for trending books</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Recommendations;