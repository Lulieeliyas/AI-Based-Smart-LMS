import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Pie, Line, Doughnut } from 'react-chartjs-2';
import reportService from '../../services/reportService';
import { toast } from 'react-toastify';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await reportService.getDashboardAnalytics();
      setData(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError('Failed to load analytics data');
      toast.error('Failed to load analytics data');
      
      // Set demo data for testing
      setData({
        borrowing_stats: {
          total_borrowings: 45,
          active_borrowings: 12,
          returned_borrowings: 30,
          overdue_borrowings: 3,
        },
        popular_books: [
          { title: 'Python Programming', borrow_count: 12 },
          { title: 'JavaScript: The Good Parts', borrow_count: 8 },
          { title: 'Data Structures', borrow_count: 6 },
        ],
        monthly_borrowings: [
          { month: 'Jan', count: 3 },
          { month: 'Feb', count: 5 },
          { month: 'Mar', count: 2 },
          { month: 'Apr', count: 7 },
          { month: 'May', count: 4 },
          { month: 'Jun', count: 6 },
          { month: 'Jul', count: 8 },
          { month: 'Aug', count: 10 },
        ],
        category_distribution: [
          { category: 'Fiction', count: 30, percentage: 30 },
          { category: 'Non-Fiction', count: 25, percentage: 25 },
          { category: 'Technology', count: 20, percentage: 20 },
          { category: 'Science', count: 15, percentage: 15 },
          { category: 'History', count: 10, percentage: 10 },
        ],
        user_activity: {
          total_users: 50,
          active_users: 25,
        }
      });
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger">
        <h4>Error loading analytics</h4>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={fetchAnalyticsData}>Retry</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-5">
        <h4>No data available</h4>
        <p className="text-muted">Generate some borrowings to see analytics</p>
      </div>
    );
  }

  // Prepare chart data
  const monthlyData = data.monthly_borrowings || [];
  const barData = {
    labels: monthlyData.map(item => item.month),
    datasets: [
      {
        label: 'Monthly Borrowings',
        data: monthlyData.map(item => item.count),
        backgroundColor: 'rgba(13, 110, 253, 0.6)',
        borderColor: 'rgba(13, 110, 253, 1)',
        borderWidth: 2,
        borderRadius: 5,
      },
    ],
  };

  const categoryData = data.category_distribution || [];
  const pieData = {
    labels: categoryData.map(item => item.category),
    datasets: [
      {
        data: categoryData.map(item => item.count),
        backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6f42c1', '#0dcaf0', '#fd7e14'],
        borderWidth: 2,
      },
    ],
  };

  const popularBooksData = data.popular_books || [];
  const popularBooksChartData = {
    labels: popularBooksData.map(item => item.title),
    datasets: [
      {
        label: 'Borrows',
        data: popularBooksData.map(item => item.borrow_count),
        backgroundColor: 'rgba(255, 193, 7, 0.6)',
        borderColor: 'rgba(255, 193, 7, 1)',
        borderWidth: 2,
        borderRadius: 5,
      },
    ],
  };

  const stats = data.borrowing_stats || {};
  const userStats = data.user_activity || {};

  return (
    <div>
      <h2 className="mb-4">📊 Analytics Dashboard</h2>

      {/* Stats Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card bg-primary text-white shadow-sm">
            <div className="card-body text-center">
              <h6>Total Borrowings</h6>
              <h2 className="mb-0">{stats.total_borrowings || 0}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-success text-white shadow-sm">
            <div className="card-body text-center">
              <h6>Active Borrowings</h6>
              <h2 className="mb-0">{stats.active_borrowings || 0}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-warning text-dark shadow-sm">
            <div className="card-body text-center">
              <h6>Returned</h6>
              <h2 className="mb-0">{stats.returned_borrowings || 0}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card bg-danger text-white shadow-sm">
            <div className="card-body text-center">
              <h6>Overdue</h6>
              <h2 className="mb-0">{stats.overdue_borrowings || 0}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="row">
        {/* Monthly Borrowings - Bar Chart */}
        <div className="col-md-8 mb-4">
          <div className="card shadow-sm">
            <div className="card-body">
              <h5 className="card-title">📈 Monthly Borrowings</h5>
              <Bar 
                data={barData} 
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (context) => `${context.raw} borrowings`
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: { stepSize: 1 }
                    }
                  }
                }} 
              />
            </div>
          </div>
        </div>

        {/* Category Distribution - Doughnut Chart */}
        <div className="col-md-4 mb-4">
          <div className="card shadow-sm">
            <div className="card-body">
              <h5 className="card-title">📊 Category Distribution</h5>
              <Doughnut 
                data={pieData} 
                options={{
                  responsive: true,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: {
                        font: { size: 10 }
                      }
                    }
                  }
                }} 
              />
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        {/* Popular Books - Horizontal Bar Chart */}
        <div className="col-md-6 mb-4">
          <div className="card shadow-sm">
            <div className="card-body">
              <h5 className="card-title">🔥 Popular Books</h5>
              <Bar 
                data={popularBooksChartData} 
                options={{
                  responsive: true,
                  indexAxis: 'y',
                  plugins: {
                    legend: { display: false }
                  },
                  scales: {
                    x: {
                      beginAtZero: true,
                      ticks: { stepSize: 1 }
                    }
                  }
                }} 
              />
            </div>
          </div>
        </div>

        {/* User Activity */}
        <div className="col-md-6 mb-4">
          <div className="card shadow-sm">
            <div className="card-body">
              <h5 className="card-title">👥 User Activity</h5>
              <div className="row g-3">
                <div className="col-6">
                  <div className="bg-light p-3 rounded text-center">
                    <h6>Total Users</h6>
                    <h2 className="text-primary">{userStats.total_users || 0}</h2>
                  </div>
                </div>
                <div className="col-6">
                  <div className="bg-light p-3 rounded text-center">
                    <h6>Active Users</h6>
                    <h2 className="text-success">{userStats.active_users || 0}</h2>
                  </div>
                </div>
              </div>
              {userStats.users_by_role && userStats.users_by_role.length > 0 && (
                <div className="mt-3">
                  <h6>Users by Role</h6>
                  {userStats.users_by_role.map((role, index) => (
                    <div key={index} className="d-flex justify-content-between align-items-center border-bottom py-1">
                      <span className="text-capitalize">{role.role}</span>
                      <span className="badge bg-secondary">{role.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Refresh Button */}
      <div className="text-center mt-3">
        <button 
          className="btn btn-outline-primary" 
          onClick={fetchAnalyticsData}
        >
          <i className="bi bi-arrow-repeat me-2"></i>
          Refresh Data
        </button>
      </div>
    </div>
  );
};

export default Analytics;