
import apiClient from './apiClient';

/**
 * Fetch live statistics from the Django admin dashboard endpoint.
 * apiClient already includes /api in its base URL.
 */
export const getSystemStats = async () => {
  const response = await apiClient.get('/admin/stats/');
  return response.data;
};
