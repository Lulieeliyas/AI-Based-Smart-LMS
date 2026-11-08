
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
        throw new Error('The server returned invalid statistics.');
      }

      setStats(data);
    } catch (err) {
      console.error('Dashboard statistics error:', err);

      const message =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        err.message ||
        'Failed to load dashboard statistics.';

      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div>
      {/* Welcome Card */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card bg-dark text-white">
            <div className="card-body">
              <h2 className="card-title">
                🔧 Welcome, Admin!
              </h2>

              <p className="card-text mb-0">
                Oversee the entire library management system,
                manage users, and monitor all activities.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Statistics */}
      {loading && !stats ? (
        <div className="text-center py-5">
          <div
            className="spinner-border text-primary"
            role="status"
          />
          <p className="mt-2">Loading dashboard statistics...</p>
        </div>
      ) : error && !stats ? (
        <div className="alert alert-danger" role="alert">
          <strong>Unable to load dashboard statistics.</strong>
          <p className="mb-2">{error}</p>

          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={fetchStats}
          >
            Try Again
          </button>
        </div>
      ) : (
        <>
          {error && (
            <div className="alert alert-warning" role="alert">
              {error}
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

      {/* Existing three-dashed feature panels */}
      <AdminFeatures />
    </div>
  );
};

export default AdminDashboard;
