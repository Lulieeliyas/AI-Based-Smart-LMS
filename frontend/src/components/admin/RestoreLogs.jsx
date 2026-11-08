import React, { useEffect, useState } from 'react';
import { Table,Form, Spinner, Alert, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import apiClient from '../../services/apiClient';

const RestoreLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await apiClient.get('/admin/restores/');
        setLogs(response.data.results || response.data || []);
      } catch (err) {
        setError(
          err.response?.data?.detail ||
          'Unable to load restore history.'
        );
        toast.error('Failed to load restore logs');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  return (
    <div className="container mt-4">
      <h2>
        <i className="bi bi-arrow-counterclockwise me-2"></i>
        Restore History
      </h2>

      <p className="text-muted">
        View records of previous database restore operations.
      </p>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <Spinner animation="border" />
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>ID</th>
              <th>Backup</th>
              <th>Started At</th>
              <th>Finished At</th>
              <th>Status</th>
              <th>Initiated By</th>
              <th>Notes</th>
            </tr>
          </thead>

          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center">
                  No restore history found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.id}</td>
                  <td>{log.backup || '-'}</td>
                  <td>
                    {log.started_at
                      ? new Date(log.started_at).toLocaleString()
                      : '-'}
                  </td>
                  <td>
                    {log.finished_at
                      ? new Date(log.finished_at).toLocaleString()
                      : '-'}
                  </td>
                  <td>
                    <Badge bg={
                      log.status === 'completed'
                        ? 'success'
                        : log.status === 'failed'
                        ? 'danger'
                        : 'warning'
                    }>
                      {log.status}
                    </Badge>
                  </td>
                  <td>{log.initiated_by || '-'}</td>
                  <td>{log.notes || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default RestoreLogs;
