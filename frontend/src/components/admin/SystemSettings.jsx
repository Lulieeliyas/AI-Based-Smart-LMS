import React, { useEffect, useState } from 'react';
import {
  Table,
  Form,
  Button,
  Spinner,
  Alert
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import apiClient from '../../services/apiClient';

const SystemSettings = () => {
  const [settings, setSettings] = useState([]);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');

  const fetchSettings = async () => {
    try {
      const response = await apiClient.get('/admin/settings/');
      const data = response.data.results || response.data || [];

      setSettings(data);

      const initialValues = {};
      data.forEach((setting) => {
        initialValues[setting.id] = setting.value;
      });

      setValues(initialValues);
      setError('');
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Unable to load system settings.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (id, value) => {
    setValues((previous) => ({
      ...previous,
      [id]: value,
    }));
  };

  const handleSave = async (setting) => {
    setSaving(setting.id);

    try {
      await apiClient.patch(
        `/admin/settings/${setting.id}/`,
        { value: values[setting.id] }
      );

      toast.success(`${setting.key} updated successfully`);
      await fetchSettings();
    } catch (err) {
      const message =
        err.response?.data?.value?.[0] ||
        err.response?.data?.detail ||
        'Failed to update setting.';

      toast.error(message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="container mt-4">
      <h2>
        <i className="bi bi-gear me-2"></i>
        System Settings
      </h2>

      <p className="text-muted">
        View and update configurable library system settings.
      </p>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <Spinner animation="border" />
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Setting</th>
              <th>Description</th>
              <th>Value</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {settings.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center">
                  No system settings found.
                </td>
              </tr>
            ) : (
              settings.map((setting) => (
                <tr key={setting.id}>
                  <td>{setting.key}</td>
                  <td>{setting.description || '-'}</td>
                  <td>
                    <Form.Control
                      value={values[setting.id] ?? ''}
                      onChange={(e) =>
                        handleChange(setting.id, e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={saving === setting.id}
                      onClick={() => handleSave(setting)}
                    >
                      {saving === setting.id ? (
                        <Spinner size="sm" animation="border" />
                      ) : (
                        'Save'
                      )}
                    </Button>
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

export default SystemSettings;
