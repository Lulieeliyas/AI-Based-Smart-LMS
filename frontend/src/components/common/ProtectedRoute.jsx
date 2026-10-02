import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Same map used by Login.jsx — but redefined here to avoid importing
// from a component file into a route guard (prevents circular imports).
const getDashboardPathForRole = (role) => {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'librarian':
      return '/librarian/dashboard';
    case 'digital_officer':
      return '/digital-officer/dashboard';
    case 'academic_staff':
      return '/staff/dashboard';
    case 'student':
    case 'guest':
    default:
      return '/student/dashboard';
  }
};

const ProtectedRoute = ({
  children,
  allowedRoles,
  adminOnly = false,
  librarianOnly = false,
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Legacy prop support: adminOnly / librarianOnly
  let requiredRoles = allowedRoles;
  if (!requiredRoles && adminOnly) requiredRoles = ['admin'];
  if (!requiredRoles && librarianOnly) requiredRoles = ['admin', 'librarian'];

  if (requiredRoles && !requiredRoles.includes(user.role)) {
    // Wrong role → send them to *their own* dashboard
    return <Navigate to={getDashboardPathForRole(user.role)} replace />;
  }

  return children;
};

export default ProtectedRoute;