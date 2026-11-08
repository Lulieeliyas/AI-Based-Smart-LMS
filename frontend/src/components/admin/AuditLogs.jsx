import React, { useEffect, useState } from 'react';
import {
  Table,
  Spinner,
  Alert,
  Badge
} from 'react-bootstrap';
import apiClient from '../../services/apiClient';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await apiClient.get('/admin/audit/');
        setLogs(response.data.results || response.data || []);
      } catch (err) {
        setError(
          err.response?.data?.detail ||
          'Unable to load audit logs.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  return (
    <div className="container mt-4">
      <h2>
        <i className="bi bi-clipboard-data me-2"></i>
        Audit Logs
      </h2>

      <p className="text-muted">
        Monitor recorded administrative activities and their results.
      </p>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <Spinner animation="border" />
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>ID</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Object</th>
              <th>Date</th>
              <th>Result</th>
              <th>Details</th>
            </tr>
          </thead>

          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center">
                  No audit records found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.id}</td>
                  <td>{log.actor || 'System'}</td>
                  <td>{log.action}</td>
                  <td>{log.object_repr}</td>
                  <td>
                    {log.timestamp
                      ? new Date(log.timestamp).toLocaleString()
                      : '-'}
                  </td>
                  <td>
                    <Badge bg={log.success ? 'success' : 'danger'}>
                      {log.success ? 'Success' : 'Failed'}
                    </Badge>
                  </td>
                  <td>
                    <details>
                      <summary>View details</summary>
                      <pre className="mt-2 mb-0">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      )}
    </div>
  );
};

export default AuditLogs;