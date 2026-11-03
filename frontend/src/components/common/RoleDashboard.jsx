import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PublicDashboard from '../public/PublicDashboard';

const RoleDashboard = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-2">Loading...</p>
      </div>
    );
  }

  // If not logged in, show the public homepage
  if (!isAuthenticated || !user) {
    return <PublicDashboard />;
  }

  const role = String(user?.role || '').toLowerCase();

  switch (role) {
    case 'admin':
    case 'administrator':
      return <Navigate to="/admin/dashboard" replace />;
    case 'librarian':
      return <Navigate to="/librarian/dashboard" replace />;
    case 'digital_officer':
    case 'digital_library_officer':
      return <Navigate to="/digital-officer/dashboard" replace />;
    case 'academic_staff':
      return <Navigate to="/staff/dashboard" replace />;
    case 'student':
    case 'guest':
      return <Navigate to="/student/dashboard" replace />;
    default:
      return <Navigate to="/student/dashboard" replace />;
  }
};

export default RoleDashboard;