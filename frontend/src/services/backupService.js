
import apiClient from './apiClient';

const BASE_URL = '/admin/backups/';

const backupService = {
  // Get all backup records
  list: () => {
    return apiClient.get(BASE_URL);
  },

  // Create a new database backup
  create: () => {
    return apiClient.post(BASE_URL, {});
  },

  // Download a backup using authenticated Axios
  download: (id) => {
    return apiClient.get(`${BASE_URL}${id}/download/`, {
      responseType: 'blob',
    });
  },

  // Delete a backup
  delete: (id) => {
    return apiClient.delete(`${BASE_URL}${id}/`);
  },
};

export default backupService;
