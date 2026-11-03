import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import userService from '../../services/userService';
import bookService from '../../services/bookService';
import borrowingService from '../../services/borrowingService';

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Initialize stats with default 0 values so components don't crash
  const [stats, setStats] = useState({
    totalUsers: 0,
    students: 0,
    staff: 0,
    totalBooks: 0,
    availableBooks: 0,
    totalBorrowings: 0,
    borrowedBooks: 0,
    overdueBooks: 0,
    returnedBorrowings: 0,
    digitalResources: 0,
    recentActivities: [],
  });

  useEffect(() => {
    const fetchAdminData = async () => {
      setLoading(true);
      try {
        // Fetch data from all 3 APIs in parallel
        const [usersRes, booksRes, borrowStatsRes] = await Promise.allSettled([
          userService.getUsers(),
          bookService.getBooks({ page: 1 }),
          borrowingService.getBorrowingStatistics(),
        ]);

        // 1. Process Users Data
        let totalUsers = 0;
        let students = 0;
        let staff = 0;
        
        if (usersRes.status === 'fulfilled') {
          const data = usersRes.value.data;
          // Handle Django pagination (results array + count) OR plain array
          const userList = data?.results || data || [];
          totalUsers = data?.count || userList.length;
          
          userList.forEach(u => {
            if (u.role === 'student') students++;
            if (u.role === 'librarian' || u.role === 'academic_staff') staff++;
          });
        }

        // 2. Process Books Data
        let totalBooks = 0;
        let availableBooks = 0;
        if (booksRes.status === 'fulfilled') {
          const data = booksRes.value.data;
          const bookList = data?.results || data || [];
          totalBooks = data?.count || bookList.length;
          
          // Check if available_copies > 0
          availableBooks = bookList.filter(b => (b.available_copies || 0) > 0).length;
        }

        // 3. Process Borrowing Statistics
        let totalBorrowings = 0;
        let activeBorrowings = 0;
        let overdueBorrowings = 0;
        let returnedBorrowings = 0;

        if (borrowStatsRes.status === 'fulfilled') {
          const statsData = borrowStatsRes.value.data || {};
          totalBorrowings = statsData.total_borrowings || 0;
          activeBorrowings = statsData.active_borrowings || 0;
          overdueBorrowings = statsData.overdue_borrowings || 0;
          returnedBorrowings = statsData.returned_borrowings || 0;
        }

        // Update state with the real backend numbers
        setStats({
          totalUsers,
          students,
          staff,
          totalBooks,
          availableBooks,
          totalBorrowings,
          borrowedBooks: activeBorrowings,
          overdueBooks: overdueBorrowings,
          returnedBorrowings,
          digitalResources: 0, // Update this if you add a digital count service
          recentActivities: [], // Add real activity logs if you have an endpoint
        });

      } catch (err) {
        console.error("Failed to load admin stats:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'admin') {
      fetchAdminData();
    } else {
      setLoading(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-2">Loading real-time database records...</p>
      </div>
    );
  }

  // Render Admin Dashboard for admins
  if (user?.role === 'admin') {
    return <AdminDashboard stats={stats} />;
  }

  // Fallback for other roles
  return (
    <div className="container mt-5">
      <div className="card shadow-sm border-0">
        <div className="card-body text-center p-5">
          <h2 className="mb-3">👋 Welcome, {user?.first_name || user?.username}!</h2>
          <p className="text-muted">Please navigate to your specific dashboard.</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;