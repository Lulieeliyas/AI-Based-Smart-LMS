
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import userService from '../../services/userService';
import { useAuth } from '../../context/AuthContext';

const EMPTY_AUTHORIZED_FORM = {
  student_id: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  department: '',
  role: 'student',
};

const AUTHORIZED_ROLES = [
  { value: 'student', label: 'Student' },
  { value: 'academic_staff', label: 'Academic Staff' },
  { value: 'digital_officer', label: 'Digital Officer' },
  { value: 'librarian', label: 'Librarian' },
];

const UserManagement = () => {
  const { user } = useAuth();

  // Registered accounts
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Page messages
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // CSV upload
  const [csvFile, setCsvFile] = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResults, setCsvResults] = useState(null);

  // Authorized users imported from CSV or added manually
  const [authorizedUsers, setAuthorizedUsers] = useState([]);
  const [authorizedLoading, setAuthorizedLoading] = useState(false);
  const [showAddAuthorizedForm, setShowAddAuthorizedForm] =
    useState(false);
  const [authorizedSearch, setAuthorizedSearch] = useState('');
  const [authorizedForm, setAuthorizedForm] = useState({
    ...EMPTY_AUTHORIZED_FORM,
  });
  const [authorizedSaving, setAuthorizedSaving] = useState(false);

  const isAdmin = user?.role === 'admin';
  const hasAccess = isAdmin || user?.role === 'librarian';

  // --------------------------------------------------
  // Load registered user accounts
  // --------------------------------------------------
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await userService.getUsers();
      const data = response.data;

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : [];

      setUsers(list);
    } catch (err) {
      console.error('Error fetching users:', err);

      let message = 'Failed to load registered users.';

      if (err.response?.status === 401) {
        message = 'Please log in to view users.';
      } else if (err.response?.status === 403) {
        message =
          'You do not have permission to view registered users.';
      } else if (err.response?.data?.detail) {
        message = err.response.data.detail;
      } else if (err.response?.data?.error) {
        message = err.response.data.error;
      } else if (!err.response) {
        message =
          'Cannot connect to the backend. Check that Django is running.';
      }

      setError(message);
      toast.error(message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // --------------------------------------------------
  // Load CSV-authorized users
  // --------------------------------------------------
  const fetchAuthorizedUsers = useCallback(async () => {
    if (!isAdmin) {
      setAuthorizedUsers([]);
      return;
    }

    setAuthorizedLoading(true);

    try {
      const response = await userService.getAuthorizedUsers();
      const data = response.data;

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : [];

      setAuthorizedUsers(list);
    } catch (err) {
      console.error('Failed to load authorized users:', err);

      const message =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        'Failed to load authorized users.';

      toast.error(message);
      setAuthorizedUsers([]);
    } finally {
      setAuthorizedLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (hasAccess) {
      fetchUsers();
    } else {
      setLoading(false);
    }

    if (isAdmin) {
      fetchAuthorizedUsers();
    }
  }, [user, hasAccess, isAdmin, fetchUsers, fetchAuthorizedUsers]);

  // --------------------------------------------------
  // Update registered user's role
  // --------------------------------------------------
  const handleRoleChange = async (userId, newRole) => {
    try {
      await userService.updateUserRole(userId, newRole);

      setSuccess('User role updated successfully.');
      toast.success('User role updated successfully.');

      await fetchUsers();
    } catch (err) {
      console.error('Error updating user role:', err);

      const message =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        'Failed to update user role.';

      setError(message);
      toast.error(message);
    }
  };

  // --------------------------------------------------
  // Activate or deactivate registered account
  // --------------------------------------------------
  const handleToggleActive = async (userId) => {
    const userToToggle = users.find(
      (item) => item.id === userId
    );

    if (!userToToggle) {
      toast.error('User account not found.');
      return;
    }

    const newStatus = !userToToggle.is_active;

    try {
      await userService.partialUpdateUser(userId, {
        is_active: newStatus,
      });

      const message = `User ${
        newStatus ? 'activated' : 'deactivated'
      } successfully.`;

      setSuccess(message);
      toast.success(message);

      await fetchUsers();
    } catch (err) {
      console.error('Error updating user status:', err);

      const message =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        'Failed to update user status.';

      setError(message);
      toast.error(message);
    }
  };

  // --------------------------------------------------
  // Delete registered account
  // --------------------------------------------------
  const handleDeleteUser = async (userId, username) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete user "${username}"? ` +
      'This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      await userService.deleteUser(userId);

      setSuccess('User account deleted successfully.');
      toast.success('User account deleted successfully.');

      await fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);

      const message =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        'Failed to delete user account.';

      setError(message);
      toast.error(message);
    }
  };

  // --------------------------------------------------
  // Upload CSV file
  // --------------------------------------------------
  const handleCSVUpload = async (event) => {
    event.preventDefault();

    if (!csvFile) {
      toast.error('Please select a CSV file first.');
      return;
    }

    if (!csvFile.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a CSV file (.csv).');
      return;
    }

    setCsvUploading(true);
    setError('');
    setSuccess('');
    setCsvResults(null);

    try {
      const response =
        await userService.uploadAuthorizedUsersCSV(csvFile);

      const result = response.data || {};

      const imported = Number(result.imported ?? 0);
      const rejected = Number(result.rejected ?? 0);

      const message =
        `CSV import finished: ${imported} imported, ` +
        `${rejected} rejected.`;

      setSuccess(message);
      setCsvResults(result);
      toast.success(message);

      if (Array.isArray(result.errors) && result.errors.length > 0) {
        console.warn('CSV row errors:', result.errors);

        toast.warning(
          'Some CSV rows were rejected. Check the import results.'
        );
      }

      setCsvFile(null);

      // Immediately refresh the authorized-users table.
      await fetchAuthorizedUsers();

      // Refresh the file input.
      const input = document.getElementById(
        'authorized-users-csv'
      );

      if (input) input.value = '';
    } catch (err) {
      console.error('CSV upload failed:', err);

      const data = err.response?.data;

      const message =
        data?.error ||
        data?.detail ||
        'CSV upload failed. Check the CSV format and your admin permissions.';

      setError(message);
      toast.error(message);
    } finally {
      setCsvUploading(false);
    }
  };

  // --------------------------------------------------
  // Add one authorized user manually
  // --------------------------------------------------
  const handleAuthorizedFormChange = (event) => {
    const { name, value } = event.target;

    setAuthorizedForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleAddAuthorizedUser = async (event) => {
    event.preventDefault();

    if (!authorizedForm.student_id.trim()) {
      toast.error('Student ID is required.');
      return;
    }

    if (!authorizedForm.first_name.trim()) {
      toast.error('First name is required.');
      return;
    }

    if (!authorizedForm.last_name.trim()) {
      toast.error('Last name is required.');
      return;
    }

    if (!authorizedForm.email.trim()) {
      toast.error('Email is required.');
      return;
    }

    setAuthorizedSaving(true);

    try {
      const payload = {
        ...authorizedForm,
        student_id: authorizedForm.student_id.trim(),
        first_name: authorizedForm.first_name.trim(),
        last_name: authorizedForm.last_name.trim(),
        email: authorizedForm.email.trim().toLowerCase(),
        phone: authorizedForm.phone.trim(),
        department: authorizedForm.department.trim(),
      };

      const response =
        await userService.createAuthorizedUser(payload);

      const message =
        response.data?.message ||
        'Authorized user added successfully.';

      setSuccess(message);
      toast.success(message);

      setAuthorizedForm({ ...EMPTY_AUTHORIZED_FORM });
      setShowAddAuthorizedForm(false);

      await fetchAuthorizedUsers();
    } catch (err) {
      console.error('Failed to add authorized user:', err);

      const data = err.response?.data;

      const message =
        data?.error ||
        data?.detail ||
        data?.student_id?.[0] ||
        data?.email?.[0] ||
        'Failed to add authorized user.';

      toast.error(
        typeof message === 'string'
          ? message
          : 'Please check the user information.'
      );
    } finally {
      setAuthorizedSaving(false);
    }
  };

  // --------------------------------------------------
  // Search authorized users
  // --------------------------------------------------
  const filteredAuthorizedUsers = authorizedUsers.filter((item) => {
    const searchableText = [
      item.student_id,
      item.first_name,
      item.last_name,
      item.email,
      item.phone,
      item.department,
      item.role,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchableText.includes(
      authorizedSearch.trim().toLowerCase()
    );
  });

  // --------------------------------------------------
  // Login and permission checks
  // --------------------------------------------------
  if (!user) {
    return (
      <div className="text-center py-5">
        <div style={{ fontSize: '4rem' }}>🔒</div>
        <h3>Please Login</h3>
        <p className="text-muted">
          You need to log in to access this page.
        </p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="text-center py-5">
        <div style={{ fontSize: '4rem' }}>🔒</div>
        <h3>Access Denied</h3>
        <p className="text-muted">
          You need Admin or Librarian permissions to view this page.
        </p>
        <p className="text-muted">
          Your current role:{' '}
          <strong>{user.role || 'Unknown'}</strong>
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center mt-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2">Loading users...</p>
      </div>
    );
  }

  // --------------------------------------------------
  // Page
  // --------------------------------------------------
  return (
    <div className="container-fluid">
      {/* Page heading */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <h2 className="mb-0">👥 User Management</h2>

        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="text-muted">
            Registered accounts: {users.length}
          </span>

          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={fetchUsers}
            disabled={loading}
          >
            <i className="bi bi-arrow-clockwise me-1"></i>
            Refresh Accounts
          </button>
        </div>
      </div>

      {/* Page messages */}
      {error && (
        <div className="alert alert-danger alert-dismissible fade show">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}

          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={() => setError('')}
          ></button>
        </div>
      )}

      {success && (
        <div className="alert alert-success alert-dismissible fade show">
          <i className="bi bi-check-circle-fill me-2"></i>
          {success}

          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={() => setSuccess('')}
          ></button>
        </div>
      )}

      {/* Authorized-user management is admin-only */}
      {isAdmin && (
        <>
          {/* CSV upload and Add User buttons */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0">
                📥 Import and Manage Authorized Users
              </h5>
            </div>

            <div className="card-body">
              <p className="text-muted">
                Import users approved by the university or add an
                authorized user manually. These records are used to
                verify users during registration.
              </p>

              <div className="d-flex flex-wrap align-items-end gap-3">
                {/* Add User button is to the left of CSV upload */}
                <div>
                  <label className="form-label d-block">
                    Add a user manually
                  </label>

                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() =>
                      setShowAddAuthorizedForm((previous) => !previous)
                    }
                  >
                    <i className="bi bi-person-plus me-1"></i>
                    {showAddAuthorizedForm
                      ? 'Close Add User'
                      : 'Add User'}
                  </button>
                </div>

                {/* CSV upload */}
                <form
                  onSubmit={handleCSVUpload}
                  className="flex-grow-1"
                >
                  <label
                    htmlFor="authorized-users-csv"
                    className="form-label"
                  >
                    Upload authorized users CSV
                  </label>

                  <div className="d-flex flex-wrap gap-2">
                    <input
                      id="authorized-users-csv"
                      type="file"
                      accept=".csv,text/csv"
                      className="form-control"
                      style={{ maxWidth: '420px' }}
                      onChange={(event) =>
                        setCsvFile(event.target.files?.[0] || null)
                      }
                      disabled={csvUploading}
                    />

                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={!csvFile || csvUploading}
                    >
                      {csvUploading ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                          ></span>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-upload me-1"></i>
                          Upload CSV
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              <small className="text-muted d-block mt-3">
                Required CSV columns: student_id, first_name,
                last_name, email. Optional columns: phone, department,
                role.
              </small>
            </div>
          </div>

          {/* CSV import results */}
          {csvResults && Array.isArray(csvResults.errors) &&
            csvResults.errors.length > 0 && (
              <div className="card border-warning mb-4">
                <div className="card-header bg-warning-subtle">
                  <strong>CSV Import Results</strong>
                </div>

                <div className="card-body">
                  <p>
                    Imported:{' '}
                    <strong>{csvResults.imported ?? 0}</strong>
                    {' | '}
                    Rejected:{' '}
                    <strong>{csvResults.rejected ?? 0}</strong>
                  </p>

                  <div className="table-responsive">
                    <table className="table table-sm table-bordered">
                      <thead>
                        <tr>
                          <th>Row</th>
                          <th>Error</th>
                        </tr>
                      </thead>

                      <tbody>
                        {csvResults.errors.map((item, index) => (
                          <tr key={index}>
                            <td>
                              {item.row ?? item.line ?? index + 1}
                            </td>
                            <td>
                              {item.error ||
                                item.message ||
                                JSON.stringify(item)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          {/* Add authorized-user form */}
          {showAddAuthorizedForm && (
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="mb-0">Add Authorized User</h5>
              </div>

              <div className="card-body">
                <form onSubmit={handleAddAuthorizedUser}>
                  <div className="row g-3">
                    <div className="col-md-4">
                      <label
                        htmlFor="authorized-student-id"
                        className="form-label"
                      >
                        Student / Staff ID *
                      </label>

                      <input
                        id="authorized-student-id"
                        name="student_id"
                        type="text"
                        className="form-control"
                        value={authorizedForm.student_id}
                        onChange={handleAuthorizedFormChange}
                        required
                      />
                    </div>

                    <div className="col-md-4">
                      <label
                        htmlFor="authorized-first-name"
                        className="form-label"
                      >
                        First Name *
                      </label>

                      <input
                        id="authorized-first-name"
                        name="first_name"
                        type="text"
                        className="form-control"
                        value={authorizedForm.first_name}
                        onChange={handleAuthorizedFormChange}
                        required
                      />
                    </div>

                    <div className="col-md-4">
                      <label
                        htmlFor="authorized-last-name"
                        className="form-label"
                      >
                        Last Name *
                      </label>

                      <input
                        id="authorized-last-name"
                        name="last_name"
                        type="text"
                        className="form-control"
                        value={authorizedForm.last_name}
                        onChange={handleAuthorizedFormChange}
                        required
                      />
                    </div>

                    <div className="col-md-4">
                      <label
                        htmlFor="authorized-email"
                        className="form-label"
                      >
                        Email *
                      </label>

                      <input
                        id="authorized-email"
                        name="email"
                        type="email"
                        className="form-control"
                        value={authorizedForm.email}
                        onChange={handleAuthorizedFormChange}
                        required
                      />
                    </div>

                    <div className="col-md-4">
                      <label
                        htmlFor="authorized-phone"
                        className="form-label"
                      >
                        Phone
                      </label>

                      <input
                        id="authorized-phone"
                        name="phone"
                        type="tel"
                        className="form-control"
                        value={authorizedForm.phone}
                        onChange={handleAuthorizedFormChange}
                      />
                    </div>

                    <div className="col-md-4">
                      <label
                        htmlFor="authorized-department"
                        className="form-label"
                      >
                        Department
                      </label>

                      <input
                        id="authorized-department"
                        name="department"
                        type="text"
                        className="form-control"
                        value={authorizedForm.department}
                        onChange={handleAuthorizedFormChange}
                      />
                    </div>

                    <div className="col-md-4">
                      <label
                        htmlFor="authorized-role"
                        className="form-label"
                      >
                        Role
                      </label>

                      <select
                        id="authorized-role"
                        name="role"
                        className="form-select"
                        value={authorizedForm.role}
                        onChange={handleAuthorizedFormChange}
                      >
                        {AUTHORIZED_ROLES.map((role) => (
                          <option
                            key={role.value}
                            value={role.value}
                          >
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="d-flex gap-2 mt-4">
                    <button
                      type="submit"
                      className="btn btn-success"
                      disabled={authorizedSaving}
                    >
                      {authorizedSaving
                        ? 'Saving...'
                        : 'Save Authorized User'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={authorizedSaving}
                      onClick={() => {
                        setShowAddAuthorizedForm(false);
                        setAuthorizedForm({
                          ...EMPTY_AUTHORIZED_FORM,
                        });
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Authorized users table */}
          <div className="card mb-4">
            <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h5 className="mb-0">
                <i className="bi bi-person-check me-2"></i>
                Authorized Users
              </h5>

              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="badge bg-primary">
                  Total: {authorizedUsers.length}
                </span>

                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={fetchAuthorizedUsers}
                  disabled={authorizedLoading}
                >
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  Refresh Authorized Users
                </button>
              </div>
            </div>

            <div className="card-body">
              <p className="text-muted">
                These records come from the CSV file or the manual
                Add User form. They are separate from registered
                login accounts.
              </p>

              <div className="mb-3">
                <label
                  htmlFor="authorized-user-search"
                  className="form-label"
                >
                  Search authorized users
                </label>

                <input
                  id="authorized-user-search"
                  type="search"
                  className="form-control"
                  placeholder="Search by ID, name, email, phone, department, or role..."
                  value={authorizedSearch}
                  onChange={(event) =>
                    setAuthorizedSearch(event.target.value)
                  }
                />
              </div>

              {authorizedLoading ? (
                <div className="text-center py-4">
                  <div
                    className="spinner-border text-primary"
                    role="status"
                  >
                    <span className="visually-hidden">
                      Loading...
                    </span>
                  </div>
                  <p className="mt-2">
                    Loading authorized users...
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-hover align-middle">
                    <thead className="table-dark">
                      <tr>
                        <th>Student / Staff ID</th>
                        <th>First Name</th>
                        <th>Last Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Department</th>
                        <th>Role</th>
                        <th>Authorized</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredAuthorizedUsers.map((item) => (
                        <tr key={item.id ?? item.student_id}>
                          <td>{item.student_id || 'N/A'}</td>
                          <td>{item.first_name || 'N/A'}</td>
                          <td>{item.last_name || 'N/A'}</td>
                          <td>{item.email || 'N/A'}</td>
                          <td>{item.phone || 'N/A'}</td>
                          <td>{item.department || 'N/A'}</td>
                          <td>
                            {AUTHORIZED_ROLES.find(
                              (role) => role.value === item.role
                            )?.label || item.role || 'N/A'}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                item.is_authorized
                                  ? 'bg-success'
                                  : 'bg-danger'
                              }`}
                            >
                              {item.is_authorized ? 'Yes' : 'No'}
                            </span>
                          </td>
                        </tr>
                      ))}

                      {filteredAuthorizedUsers.length === 0 && (
                        <tr>
                          <td colSpan="8" className="text-center py-4">
                            {authorizedUsers.length === 0
                              ? 'No authorized users found. Upload a CSV file or click Add User.'
                              : 'No users match your search.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Registered login accounts table */}
      <div className="card mb-4">
        <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
          <h5 className="mb-0">
            <i className="bi bi-people me-2"></i>
            Registered User Accounts
          </h5>

          <span className="text-muted">
            Total: {users.length}
          </span>
        </div>

        <div className="card-body">
          <p className="text-muted">
            These are accounts that exist in the system. An
            authorized record does not automatically create a login
            account; the person must complete the registration and
            verification process.
          </p>

          {users.length === 0 ? (
            <div className="text-center py-5 bg-light rounded">
              <div style={{ fontSize: '4rem' }}>👥</div>
              <h4>No registered accounts found</h4>
              <p className="text-muted">
                User accounts will appear here after registration.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover align-middle">
                <thead className="table-dark">
                  <tr>
                    <th>ID</th>
                    <th>Username / Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((userItem) => (
                    <tr key={userItem.id}>
                      <td>
                        {String(userItem.id || '').slice(0, 8) ||
                          'N/A'}
                      </td>

                      <td>
                        <strong>
                          {userItem.username || 'N/A'}
                        </strong>

                        {(userItem.first_name ||
                          userItem.last_name) && (
                          <div>
                            <small className="text-muted">
                              {userItem.first_name}{' '}
                              {userItem.last_name}
                            </small>
                          </div>
                        )}
                      </td>

                      <td>{userItem.email || 'N/A'}</td>

                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={userItem.role || 'student'}
                          onChange={(event) =>
                            handleRoleChange(
                              userItem.id,
                              event.target.value
                            )
                          }
                          style={{ minWidth: '140px' }}
                          disabled={
                            userItem.id === user.id ||
                            user?.role !== 'admin'
                          }
                          aria-label={`Role for ${userItem.username}`}
                        >
                          <option value="student">Student</option>
                          <option value="academic_staff">
                            Academic Staff
                          </option>
                          <option value="librarian">Librarian</option>
                          <option value="admin">Admin</option>
                          <option value="digital_officer">
                            Digital Officer
                          </option>
                        </select>
                      </td>

                      <td>{userItem.department || 'N/A'}</td>

                      <td>
                        <span
                          className={`badge ${
                            userItem.is_active !== false
                              ? 'bg-success'
                              : 'bg-danger'
                          }`}
                        >
                          {userItem.is_active !== false
                            ? 'Active'
                            : 'Inactive'}
                        </span>
                      </td>

                      <td>
                        <div className="btn-group btn-group-sm">
                          <button
                            type="button"
                            className={`btn ${
                              userItem.is_active !== false
                                ? 'btn-warning'
                                : 'btn-success'
                            }`}
                            onClick={() =>
                              handleToggleActive(userItem.id)
                            }
                            title={
                              userItem.is_active !== false
                                ? 'Deactivate'
                                : 'Activate'
                            }
                            disabled={
                              userItem.id === user.id ||
                              user?.role !== 'admin'
                            }
                          >
                            {userItem.is_active !== false
                              ? 'Deactivate'
                              : 'Activate'}
                          </button>

                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() =>
                              handleDeleteUser(
                                userItem.id,
                                userItem.username
                              )
                            }
                            title="Delete User"
                            disabled={
                              userItem.id === user.id ||
                              user?.role !== 'admin'
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
