
import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import backupService from '../../services/backupService';
import { Button, Table, Spinner, Alert } from 'react-bootstrap';

const BackupManagement = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState('');

  // Load backup records from the backend
  const fetchBackups = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const resp = await backupService.list();
      const data = resp.data;

      // Handle both paginated and non-paginated responses
      const backupList = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : [];

      setBackups(backupList);

    } catch (err) {
      console.error('Failed to load backups:', err);

      setBackups([]);
      setError(
        err.response?.data?.detail ||
        'Unable to load backup records. Please try again.'
      );

      toast.error('Failed to load backups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  // Create a new database backup
  const handleCreate = async () => {
    setCreating(true);

    try {
      const response = await backupService.create();

      toast.success(
        response.data?.message || 'Backup created successfully'
      );

      await fetchBackups();

    } catch (err) {
      console.error('Backup creation error:', err);

      toast.error(
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Failed to create database backup'
      );
    } finally {
      setCreating(false);
    }
  };

  // Download an existing backup
  const handleDownload = async (id) => {
    setDownloadingId(id);

    try {
      const response = await backupService.download(id);

      const blob = new Blob(
        [response.data],
        { type: 'application/sql' }
      );

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = downloadUrl;
      link.download = `library_backup_${id}.sql`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(downloadUrl);

      toast.success('Backup downloaded successfully');

    } catch (err) {
      console.error('Backup download error:', err);

      toast.error(
        err.response?.data?.detail ||
        'Failed to download backup'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  // Format dates safely
  const formatDate = (date) => {
    if (!date) return '-';

    const parsedDate = new Date(date);

    return Number.isNaN(parsedDate.getTime())
      ? '-'
      : parsedDate.toLocaleString();
  };

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap mb-3">
        <div>
          <h2>Database Backups</h2>
          <p className="text-muted mb-0">
            Create, view, and download database backups.
          </p>
        </div>

        <div className="d-flex gap-2 mt-2 mt-md-0">
          <Button
            variant="outline-primary"
            onClick={fetchBackups}
            disabled={loading || creating}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={creating || loading}
          >
            {creating ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  className="me-2"
                />
                Creating Backup...
              </>
            ) : (
              'Create New Backup'
            )}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger">
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-4">
          <Spinner animation="border" />
          <p className="mt-2">Loading backup records...</p>
        </div>
      ) : (
        <div className="table-responsive">
          <Table striped bordered hover responsive>
            <thead className="table-dark">
              <tr>
                <th>ID</th>
                <th>Filename</th>
                <th>Created At</th>
                <th>Size (bytes)</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {Array.isArray(backups) && backups.length > 0 ? (
                backups.map((backup) => (
                  <tr key={backup.id}>
                    <td>{backup.id}</td>

                    <td>
                      {backup.filename || '-'}
                    </td>

                    <td>
                      {formatDate(backup.created_at)}
                    </td>

                    <td>
                      {backup.size_bytes ?? '-'}
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          backup.status === 'completed'
                            ? 'bg-success'
                            : backup.status === 'failed'
                              ? 'bg-danger'
                              : 'bg-warning text-dark'
                        }`}
                      >
                        {backup.status || 'Unknown'}
                      </span>
                    </td>

                    <td>
                      {backup.created_by || '-'}
                    </td>

                    <td>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDownload(backup.id)}
                        disabled={
                          backup.status !== 'completed' ||
                          downloadingId === backup.id
                        }
                      >
                        {downloadingId === backup.id ? (
                          <>
                            <Spinner
                              as="span"
                              animation="border"
                              size="sm"
                              className="me-1"
                            />
                            Downloading...
                          </>
                        ) : (
                          'Download'
                        )}
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-4">
                    No backup records found.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default BackupManagement;
