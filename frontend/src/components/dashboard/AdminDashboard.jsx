import React, { useState, useEffect, useCallback } from 'react';
import DashboardStats from './DashboardStats';
import { getSystemStats } from '../../services/adminStatsService';
import AdminFeatures from '../admin/AdminFeatures';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getSystemStats();
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid statistics received.');
      }
      setStats(data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.response?.data?.message ||
          err.message ||
          'Failed to load dashboard statistics.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="admin-dashboard">
      {/* Welcome banner */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card bg-dark text-white shadow-sm border-0 rounded-4">
            <div className="card-body p-4">
              <h2 className="card-title mb-2">🔧 Welcome, Admin!</h2>
              <p className="card-text mb-0">
                Oversee the entire library management system — users, books,
                borrowings, backups, and system settings.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading (first load only) */}
      {loading && !stats && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading dashboard statistics...</p>
        </div>
      )}

      {/* Hard error (no stats at all) */}
      {!loading && error && !stats && (
        <div className="alert alert-danger">
          <strong>Unable to load dashboard statistics.</strong>
          <p className="mb-2 mt-1">{error}</p>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={fetchStats}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Stats (with soft error warning if refresh failed) */}
      {stats && (
        <>
          {error && (
            <div className="alert alert-warning d-flex justify-content-between align-items-center">
              <span>{error}</span>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={fetchStats}
                disabled={loading}
              >
                Retry
              </button>
            </div>
          )}

          <DashboardStats stats={stats} />

          <div className="text-end mt-2 mb-3">
            <button
              type="button"
              className="btn btn-outline-primary btn-sm"
              onClick={fetchStats}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : '↻ Refresh Statistics'}
            </button>
          </div>
        </>
      )}

      {/* Admin feature panels */}
      <AdminFeatures />
    </div>
  );
};

export default AdminDashboard;