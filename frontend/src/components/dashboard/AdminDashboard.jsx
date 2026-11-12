
# 1. Fix the package-lock automatically
git checkout --ours frontend/package-lock.json
git add frontend/package-lock.json

# 2. Overwrite the conflicted frontend files with the correct code
cat << 'EOF' > frontend/src/components/dashboard/AdminDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
      if (!data || typeof data !== 'object') throw new Error('Invalid statistics.');
      setStats(data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to load stats.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div>
      <div className="row mb-4">
        <div className="col-12">
          <div className="card bg-dark text-white">
            <div className="card-body">
              <h2 className="card-title">🔧 Welcome, Admin!</h2>
              <p className="card-text mb-0">Oversee the entire library management system.</p>
            </div>
          </div>
        </div>
      </div>
      {loading && !stats ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
          <p className="mt-2">Loading dashboard statistics...</p>
        </div>
      ) : error && !stats ? (
        <div className="alert alert-danger">
          <strong>Unable to load dashboard statistics.</strong>
          <p className="mb-2">{error}</p>
          <button className="btn btn-outline-danger btn-sm" onClick={fetchStats}>Try Again</button>
        </div>
      ) : (
        <>
          {error && <div className="alert alert-warning">{error}</div>}
          <DashboardStats stats={stats} />
          <div className="text-end mt-2 mb-3">
            <button className="btn btn-outline-primary btn-sm" onClick={fetchStats} disabled={loading}>
              {loading ? 'Refreshing...' : '↻ Refresh Statistics'}
            </button>
          </div>
        </>
      )}
      <AdminFeatures />
    </div>
  );
};
export default AdminDashboard;
