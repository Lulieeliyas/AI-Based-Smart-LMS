// frontend/src/utils/roleRoutes.js

/**
 * Returns the base dashboard route for a given user role.
 * This is used throughout the app (e.g., after login, when the
 * sidebar builds links, etc.) to send the user to the correct
 * landing page.
 *
 * The admin path (`/admin/dashboard`) points to the new
 * StatsDashboard we added in the previous step.
 */
export const getDashboardPathForRole = (role) => {
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