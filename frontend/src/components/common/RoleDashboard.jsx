import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const RoleDashboard = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <p>Loading your dashboard...</p>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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

    case 'student':
    case 'guest':
      return <Navigate to="/student/dashboard" replace />;

    case 'academic_staff':
      return <Navigate to="/staff/dashboard" replace />;

    default:
      return <Navigate to="/" replace />;
  }
};

export default RoleDashboard;