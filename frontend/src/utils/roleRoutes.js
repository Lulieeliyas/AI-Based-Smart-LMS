// frontend/src/utils/roleRoutes.js
export const getDashboardPathForRole = (role) => {
  switch (role) {
    case 'admin':            return '/admin/dashboard';
    case 'librarian':        return '/librarian/dashboard';
    case 'digital_officer':  return '/digital-officer/dashboard';
    case 'academic_staff':   return '/staff/dashboard';
    case 'student':
    case 'guest':
    default:                 return '/student/dashboard';
  }
};