import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Components
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import ProtectedRoute from './components/common/ProtectedRoute';
import RoleDashboard from './components/common/RoleDashboard'; // ✅ Added

// Auth Pages
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/Forgotpassword';
import ResetPasswordConfirm from './components/auth/ResetPasswordConfirm';
import VerifyEmail from './components/auth/VerifyEmail';
import ResetPasswordOTP from './components/auth/ResetPasswordOTP';
import AccountCreatedSuccess from './components/auth/AccountCreatedSuccess';

// Dashboard
import Dashboard from './components/dashboard/Dashboard';
import AdminDashboard from './components/dashboard/AdminDashboard';
import StudentDashboard from './components/dashboard/StudentDashboard';
import LibrarianDashboard from './components/dashboard/LibrarianDashboard';
import DigitalOfficerDashboard from './pages/digital-officer/DigitalOfficerDashboard';

// Books
import BookList from './components/books/BookList';
import BookDetails from './components/books/BookDetails';
import BookManagement from './components/books/BookManagement';

// Borrowing
import BorrowHistory from './components/borrowing/BorrowHistory';
import AllBorrowings from './components/borrowing/AllBorrowings';

// Recommendations
import Recommendations from './components/recommendations/Recommendations';

// Digital Resources
import DigitalResources from './components/digital/DigitalResources';

// Reports
import Reports from './components/reports/Reports';

// Public
import PublicDashboard from './components/public/PublicDashboard';
import PublicBooks from './components/public/PublicBooks';
import PublicBookDetail from './components/public/PublicBookDetail';

// Users
import UserProfile from './components/users/UserProfile';
import UserManagement from './components/users/UserManagement';
import ChangePassword from './components/users/ChangePassword';

// Notifications
import Notifications from './components/notifications/Notifications';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css';

function App() {
  return (
    <>
      <div className="d-flex flex-column min-vh-100">
        <Navbar />
        <div className="container flex-grow-1 mt-4">
          <Routes>
            {/* ✅ If user is logged in, / sends them to their dashboard. Otherwise, public dashboard */}
            <Route path="/" element={<RoleDashboard />} />
            <Route path="/public" element={<PublicDashboard />} />
            <Route path="/public/books" element={<PublicBooks />} />
            <Route path="/public/books/:id" element={<PublicBookDetail />} />

            {/* Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPasswordConfirm />} />
            <Route path="/reset-password-otp" element={<ResetPasswordOTP />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/account-created" element={<AccountCreatedSuccess />} />

            {/* Role-specific dashboards */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/librarian/dashboard"
              element={
                <ProtectedRoute allowedRoles={['librarian', 'admin']}>
                  <LibrarianDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/digital-officer/dashboard"
              element={
                <ProtectedRoute allowedRoles={['digital_officer', 'admin']}>
                  <DigitalOfficerDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/staff/dashboard" element={
  <ProtectedRoute allowedRoles={['academic_staff', 'admin']}>
    <Dashboard />
  </ProtectedRoute>
} />
            <Route
              path="/student/dashboard"
              element={
                <ProtectedRoute allowedRoles={['student', 'guest', 'admin']}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />

            {/* Books */}
            <Route
              path="/books/manage"
              element={
                <ProtectedRoute allowedRoles={['librarian', 'admin']}>
                  <BookManagement />
                </ProtectedRoute>
              }
            />
            <Route path="/books" element={<ProtectedRoute><BookList /></ProtectedRoute>} />
            <Route path="/books/:id" element={<ProtectedRoute><BookDetails /></ProtectedRoute>} />

            {/* Shared Protected Routes */}
            <Route path="/dashboard" element={<ProtectedRoute><RoleDashboard /></ProtectedRoute>} />
            <Route path="/borrowings" element={<ProtectedRoute><BorrowHistory /></ProtectedRoute>} />
            <Route
              path="/borrowings/all"
              element={
                <ProtectedRoute allowedRoles={['librarian', 'admin']}>
                  <AllBorrowings />
                </ProtectedRoute>
              }
            />
            <Route path="/recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
            <Route path="/digital" element={<ProtectedRoute><DigitalResources /></ProtectedRoute>} />
            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={['librarian', 'admin']}>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
            <Route
              path="/users"
              element={
                <ProtectedRoute allowedRoles={['admin', 'librarian']}>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

            {/* 404 → public landing page */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <Footer />
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
}

export default App;