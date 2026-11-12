import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PublicDashboard from '../public/PublicDashboard';

const RoleDashboard = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <p>Loading your dashboard...</p>;
  }

  // 🔓 Guest / not logged in → PUBLIC dashboard
  if (!isAuthenticated || !user) {
    return <PublicDashboard />;
  }

  const role = String(user?.role || '').toLowerCase().trim();

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
      return <Navigate to="/student/dashboard" replace />;

    case 'academic_staff':
      return <Navigate to="/staff/dashboard" replace />;

    case 'guest':
      return <PublicDashboard />;

    default:
      // Unknown role → show public dashboard, never a blank screen
      return <PublicDashboard />;
  }
};

export default RoleDashboard;