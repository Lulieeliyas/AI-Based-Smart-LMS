
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { getSystemStats } from '../../services/adminStatsService';
import DashboardStats from './DashboardStats';
import AdminFeatures from '../admin/AdminFeatures';
import './Dashboard.css';

const Dashboard = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchStats = useCallback(async () => {
        if (!isAdmin) return;

        setLoading(true);
        setError('');

        try {
            const data = await getSystemStats();

            if (!data || typeof data !== 'object') {
                throw new Error('The server returned invalid dashboard statistics.');
            }

            setStats(data);
        } catch (err) {
            console.error('Dashboard statistics error:', err);

            setError(
                err.response?.data?.detail ||
                err.response?.data?.error ||
                err.message ||
                'Unable to load dashboard statistics.'
            );
        } finally {
            setLoading(false);
        }
    }, [isAdmin]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const welcomeName =
        user?.first_name ||
        user?.username ||
        'User';

    return (
        <main className={isAdmin ? 'admin-dashboard' : ''}>
            {/* Welcome panel */}
            <section className="admin-welcome">
                <div className="admin-welcome-content">
                    <span className="admin-welcome-eyebrow">
                        AI Library Management System
                    </span>

                    <h2>
                        Welcome back, {welcomeName}
                    </h2>

                    <p>
                        {isAdmin
                            ? 'Manage your library, monitor system activity, and keep track of your library resources from one place.'
                            : user?.role === 'academic_staff'
                                ? 'Explore library resources and manage your borrowing activities.'
                                : 'Explore library resources and discover books for your learning.'}
                    </p>
                </div>

                <i
                    className="bi bi-journal-bookmark-fill admin-welcome-decoration"
                    aria-hidden="true"
                />
            </section>

            {/* Administrator dashboard statistics */}
            {isAdmin && (
                <>
                    {loading && !stats ? (
                        <div className="admin-dashboard-state">
                            <div
                                className="spinner-border text-primary"
                                role="status"
                            >
                                <span className="visually-hidden">
                                    Loading...
                                </span>
                            </div>
                            <p>Loading live library statistics...</p>
                        </div>
                    ) : error && !stats ? (
                        <div className="admin-dashboard-error" role="alert">
                            <strong>
                                <i className="bi bi-exclamation-triangle me-2" />
                                Unable to load dashboard statistics
                            </strong>

                            <p>{error}</p>

                            <button
                                type="button"
                                className="admin-refresh-button"
                                onClick={fetchStats}
                                disabled={loading}
                            >
                                <i className="bi bi-arrow-clockwise" />
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

                            <div className="d-flex justify-content-end mt-3">
                                <button
                                    type="button"
                                    className="admin-refresh-button"
                                    onClick={fetchStats}
                                    disabled={loading}
                                >
                                    <i className={`bi ${
                                        loading
                                            ? 'bi-arrow-repeat'
                                            : 'bi-arrow-clockwise'
                                    }`} />
                                    {loading
                                        ? 'Refreshing...'
                                        : 'Refresh Statistics'}
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}

            {/* Quick actions */}
            <section className="mt-4">
                <div className="admin-section-heading">
                    <div>
                        <h4>Quick Actions</h4>
                        <p>Quick access to frequently used library services</p>
                    </div>
                </div>

                <div className="row g-3">
                    <div className="col-md-4 col-sm-6">
                        <Link
                            to="/books"
                            className="btn btn-outline-primary w-100 py-3"
                        >
                            <i className="bi bi-search me-2" />
                            Search Books
                        </Link>
                    </div>

                    <div className="col-md-4 col-sm-6">
                        <Link
                            to="/borrowings"
                            className="btn btn-outline-primary w-100 py-3"
                        >
                            <i className="bi bi-journal-arrow-up me-2" />
                            My Borrowings
                        </Link>
                    </div>

                    <div className="col-md-4 col-sm-6">
                        <Link
                            to="/digital"
                            className="btn btn-outline-primary w-100 py-3"
                        >
                            <i className="bi bi-file-earmark-pdf me-2" />
                            Digital Resources
                        </Link>
                    </div>
                </div>
            </section>

            {/* Administrator feature dropdowns */}
            {isAdmin && <AdminFeatures />}
        </main>
    );
};

export default Dashboard;
