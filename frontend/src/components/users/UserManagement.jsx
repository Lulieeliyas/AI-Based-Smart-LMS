
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

    // Registered-user editing
  const [editingRegisteredUser, setEditingRegisteredUser] = useState(null);
  const [registeredUserForm, setRegisteredUserForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department: '',
  });
  const [savingRegisteredUser, setSavingRegisteredUser] = useState(false);

  // Registered-user search and pagination
  const [userSearch, setUserSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState('10');

  // Page messages
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // CSV upload
  const [csvFile, setCsvFile] = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResults, setCsvResults] = useState(null);

  // Authorized users
  const [authorizedUsers, setAuthorizedUsers] = useState([]);
  const [authorizedLoading, setAuthorizedLoading] = useState(false);
  const [showAddAuthorizedForm, setShowAddAuthorizedForm] =
    useState(false);
  const [authorizedSearch, setAuthorizedSearch] = useState('');
  const [authorizedForm, setAuthorizedForm] = useState({
    ...EMPTY_AUTHORIZED_FORM,
  });
  const [authorizedSaving, setAuthorizedSaving] = useState(false);

  const [editingAuthorizedUser, setEditingAuthorizedUser] = useState(null);
  const [editAuthorizedForm, setEditAuthorizedForm] = useState({
    ...EMPTY_AUTHORIZED_FORM,
  });
  const [editAuthorizedSaving, setEditAuthorizedSaving] = useState(false);

  const isAdmin = user?.role === 'admin';
  const hasAccess = isAdmin || user?.role === 'librarian';

  // --------------------------------------------------
  // Load registered users
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
        message = 'You do not have permission to view registered users.';
      } else if (err.response?.data?.detail) {
        message = err.response.data.detail;
      } else if (err.response?.data?.error) {
        message = err.response.data.error;
      } else if (!err.response) {
        message = 'Cannot connect to the backend. Check that Django is running.';
      }

      setError(message);
      toast.error(message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // --------------------------------------------------
  // Load authorized users
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
  // Update user role
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


const handleEditRegisteredUser = (userItem) => {
  setEditingRegisteredUser(userItem);
  setRegisteredUserForm({
    first_name: userItem.first_name || '',
    last_name: userItem.last_name || '',
    email: userItem.email || '',
    phone: userItem.phone || '',
    department: userItem.department || '',
  });
};

const handleRegisteredUserFormChange = (event) => {
  const { name, value } = event.target;

  setRegisteredUserForm((previous) => ({
    ...previous,
    [name]: value,
  }));
};

const handleSaveRegisteredUser = async (event) => {
  event.preventDefault();

  if (!editingRegisteredUser) return;

  setSavingRegisteredUser(true);

  try {
    await userService.partialUpdateUser(
      editingRegisteredUser.id,
      registeredUserForm
    );

    toast.success('User details updated successfully.');
    setEditingRegisteredUser(null);
    await fetchUsers();
  } catch (error) {
    console.error('Error updating user:', error);

    const message =
      error.response?.data?.detail ||
      error.response?.data?.error ||
      Object.values(error.response?.data || {})
        .flat()
        .find((value) => typeof value === 'string') ||
      'Failed to update user. Please try again.';

    toast.error(message);
  } finally {
    setSavingRegisteredUser(false);
  }
};

  // --------------------------------------------------
  // Activate or deactivate account
  // --------------------------------------------------
  const handleToggleActive = async (userId) => {
    const userToToggle = users.find((item) => item.id === userId);

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


  // Deactivate account while preserving user history.
  const handleDeleteUser = async (userId, username) => {
    const confirmed = window.confirm(
      `Are you sure you want to deactivate user "${username}"? ` +
        'They will no longer be able to sign in. Their records will be preserved.'
    );

    if (!confirmed) return;

    try {
      await userService.deactivateUser(userId);

      const message = `User "${username}" deactivated successfully.`;
      setSuccess(message);
      toast.success(message);

      await fetchUsers();
    } catch (err) {
      console.error('Error deactivating user:', err);

      const message =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        'Failed to deactivate user account.';

      setError(message);
      toast.error(message);
    }
  };

  // --------------------------------------------------
  // Upload authorized users CSV
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

      await fetchAuthorizedUsers();

      const input = document.getElementById('authorized-users-csv');
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
  // Add authorized user manually
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
  // Edit authorized roster record
  // --------------------------------------------------
  const handleEditAuthorizedUser = (item) => {
    setEditingAuthorizedUser(item);
    setEditAuthorizedForm({
      student_id: item.student_id || '',
      first_name: item.first_name || '',
      last_name: item.last_name || '',
      email: item.email || '',
      phone: item.phone || '',
      department: item.department || '',
      role: item.role || 'student',
      is_authorized: item.is_authorized ?? true,
    });
  };

  const handleEditAuthorizedFormChange = (event) => {
    const { name, value } = event.target;

    setEditAuthorizedForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSaveAuthorizedUser = async (event) => {
    event.preventDefault();

    if (!editingAuthorizedUser?.id) {
      toast.error('Cannot edit this record because its ID is missing.');
      return;
    }

    const payload = {
      ...editAuthorizedForm,
      student_id: editAuthorizedForm.student_id.trim(),
      first_name: editAuthorizedForm.first_name.trim(),
      last_name: editAuthorizedForm.last_name.trim(),
      email: editAuthorizedForm.email.trim().toLowerCase(),
      phone: editAuthorizedForm.phone.trim(),
      department: editAuthorizedForm.department.trim(),
    };

    setEditAuthorizedSaving(true);

    try {
      const response = await userService.updateAuthorizedUser(
        editingAuthorizedUser.id,
        payload
      );

      toast.success(
        response.data?.message || 'Authorized user updated successfully.'
      );

      setEditingAuthorizedUser(null);
      await fetchAuthorizedUsers();
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Failed to update authorized user.';

      toast.error(message);
    } finally {
      setEditAuthorizedSaving(false);
    }
  };

  const handleCancelEditAuthorizedUser = () => {
    setEditingAuthorizedUser(null);
    setEditAuthorizedForm({ ...EMPTY_AUTHORIZED_FORM });
  };

  // --------------------------------------------------
  // Delete authorized roster record
  // --------------------------------------------------
  const handleDeleteAuthorizedUser = async (item) => {
    if (!item?.id) {
      toast.error('Cannot delete this record because its ID is missing.');
      return;
    }

    const confirmed = window.confirm(
      `Delete authorized roster record for ${item.first_name || ''} ${
        item.last_name || ''
      } (${item.student_id || 'no ID'})? This does not delete a registered login account.`
    );

    if (!confirmed) return;

    try {
      await userService.deleteAuthorizedUser(item.id);

      toast.success('Authorized roster record deleted.');

      if (editingAuthorizedUser?.id === item.id) {
        handleCancelEditAuthorizedUser();
      }

      await fetchAuthorizedUsers();
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Failed to delete authorized user.';

      toast.error(message);
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
  // Search and paginate registered users
  // --------------------------------------------------
  const filteredUsers = users.filter((item) => {
    const searchableText = [
      item.id,
      item.username,
      item.first_name,
      item.last_name,
      item.email,
      item.role,
      item.department,
      item.is_active !== false ? 'active' : 'inactive',
    ]
      .filter((value) => value !== null && value !== undefined)
      .join(' ')
      .toLowerCase();

    return searchableText.includes(userSearch.trim().toLowerCase());
  });

  const showAllUsers = usersPerPage === 'all';

const pageSize = showAllUsers
  ? Math.max(filteredUsers.length, 1)
  : Number(usersPerPage);

const totalPages = showAllUsers
  ? 1
  : Math.ceil(filteredUsers.length / pageSize);

const paginatedUsers = showAllUsers
  ? filteredUsers
  : filteredUsers.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );

const firstUserNumber =
  filteredUsers.length === 0
    ? 0
    : showAllUsers
      ? 1
      : (currentPage - 1) * pageSize + 1;

const lastUserNumber = showAllUsers
  ? filteredUsers.length
  : Math.min(currentPage * pageSize, filteredUsers.length);

  // Keep the page valid when search results or user count changes.
  useEffect(() => {
    setCurrentPage((page) =>
      Math.max(1, Math.min(page, totalPages || 1))
    );
  }, [totalPages]);

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
          Your current role: <strong>{user.role || 'Unknown'}</strong>
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

      {/* Admin-only authorized-user management */}
      {isAdmin && (
        <>
          {/* CSV upload and Add User */}
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
          {csvResults &&
            Array.isArray(csvResults.errors) &&
            csvResults.errors.length > 0 && (
              <div className="card border-warning mb-4">
                <div className="card-header bg-warning-subtle">
                  <strong>CSV Import Results</strong>
                </div>

                <div className="card-body">
                  <p>
                    Imported: <strong>{csvResults.imported ?? 0}</strong>
                    {' | '}
                    Rejected: <strong>{csvResults.rejected ?? 0}</strong>
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
                            <td>{item.row ?? item.line ?? index + 1}</td>
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
                          <option key={role.value} value={role.value}>
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
                        setAuthorizedForm({ ...EMPTY_AUTHORIZED_FORM });
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


              {editingAuthorizedUser && (
                <div className="card border-primary mb-4">
                  <div className="card-header">
                    <strong>Edit Authorized User</strong>
                  </div>
                  <div className="card-body">
                    <form onSubmit={handleSaveAuthorizedUser}>
                      <div className="row g-3">
                        {[
                          ['student_id', 'Student / Staff ID'],
                          ['first_name', 'First Name'],
                          ['last_name', 'Last Name'],
                          ['email', 'Email'],
                          ['phone', 'Phone'],
                          ['department', 'Department'],
                        ].map(([name, label]) => (
                          <div className="col-md-4" key={name}>
                            <label
                              className="form-label"
                              htmlFor={`edit-authorized-${name}`}
                            >
                              {label}
                            </label>
                            <input
                              id={`edit-authorized-${name}`}
                              name={name}
                              type={name === 'email' ? 'email' : 'text'}
                              className="form-control"
                              value={editAuthorizedForm[name]}
                              onChange={handleEditAuthorizedFormChange}
                              required={[
                                'student_id',
                                'first_name',
                                'last_name',
                                'email',
                              ].includes(name)}
                            />
                          </div>
                        ))}

                        <div className="col-md-4">
                          <label
                            className="form-label"
                            htmlFor="edit-authorized-role"
                          >
                            Role
                          </label>
                          <select
                            id="edit-authorized-role"
                            name="role"
                            className="form-select"
                            value={editAuthorizedForm.role}
                            onChange={handleEditAuthorizedFormChange}
                            required
                          >
                            {AUTHORIZED_ROLES.map((role) => (
                              <option key={role.value} value={role.value}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-md-4">
                          <label
                            className="form-label"
                            htmlFor="edit-authorized-status"
                          >
                            Authorization Status
                          </label>
                          <select
                            id="edit-authorized-status"
                            name="is_authorized"
                            className="form-select"
                            value={String(
                              editAuthorizedForm.is_authorized ?? true
                            )}
                            onChange={(event) =>
                              setEditAuthorizedForm((previous) => ({
                                ...previous,
                                is_authorized:
                                  event.target.value === 'true',
                              }))
                            }
                          >
                            <option value="true">Authorized</option>
                            <option value="false">Not authorized</option>
                          </select>
                        </div>
                      </div>

                      <div className="d-flex gap-2 mt-3">
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={editAuthorizedSaving}
                        >
                          {editAuthorizedSaving
                            ? 'Saving...'
                            : 'Save Changes'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleCancelEditAuthorizedUser}
                          disabled={editAuthorizedSaving}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}


              <div className="input-group mb-3" style={{ maxWidth: '100%' }}>
                <span className="input-group-text">
                  <i className="bi bi-search" aria-hidden="true"></i>
                  </span>
                  <input
                  type="search"
                  className="form-control"
                  placeholder="Search by ID, name, email, phone, department, or role..."
                  aria-label="Search authorized users"
                  value={authorizedSearch}
                  onChange={(event) => setAuthorizedSearch(event.target.value)}
                  />
                  </div>

              {authorizedLoading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2">Loading authorized users...</p>
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
                        <th> Actions</th>
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


                          <td>
                            <div className="d-flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => handleEditAuthorizedUser(item)}
                              >
                                <i
                                  className="bi bi-pencil-square me-1"
                                  aria-hidden="true"
                                ></i>
                                Edit
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDeleteAuthorizedUser(item)}
                              >
                                <i
                                  className="bi bi-trash me-1"
                                  aria-hidden="true"
                                ></i>
                                Delete
                              </button>
                            </div>
                          </td>

                        </tr>
                      ))}

                      {filteredAuthorizedUsers.length === 0 && (
                        <tr>
                          <td colSpan="9" className="text-center py-4">
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

      {/* Registered login accounts */}
      <div className="card mb-4">
        <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
          <h5 className="mb-0">
            <i className="bi bi-people me-2"></i>
            Registered User Accounts
          </h5>

          <span className="text-muted">Total: {users.length}</span>
        </div>

        <div className="card-body">
          <p className="text-muted">
            These are accounts that exist in the system. An
            authorized record does not automatically create a login
            account; the person must complete the registration and
            verification process.
          </p>


{editingRegisteredUser && (
  <div className="card shadow-sm mb-4">
    <div className="card-header d-flex justify-content-between align-items-center">
      <h5 className="mb-0">
        Edit User: {editingRegisteredUser.username}
      </h5>

      <button
        type="button"
        className="btn-close"
        aria-label="Close"
        onClick={() => setEditingRegisteredUser(null)}
        disabled={savingRegisteredUser}
      />
    </div>

    <div className="card-body">
      <form onSubmit={handleSaveRegisteredUser}>
        <div className="row g-3">
          {[
            { name: 'first_name', label: 'First Name' },
            { name: 'last_name', label: 'Last Name' },
            { name: 'email', label: 'Email', type: 'email' },
            { name: 'phone', label: 'Phone Number' },
            { name: 'department', label: 'Department' },
          ].map((field) => (
            <div className="col-md-6" key={field.name}>
              <label
                htmlFor={`registered-${field.name}`}
                className="form-label"
              >
                {field.label}
              </label>

              <input
                id={`registered-${field.name}`}
                type={field.type || 'text'}
                name={field.name}
                className="form-control"
                value={registeredUserForm[field.name]}
                onChange={handleRegisteredUserFormChange}
                required={field.name === 'email'}
                disabled={savingRegisteredUser}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 d-flex gap-2">
          <button
            type="submit"
            className="btn btn-success"
            disabled={savingRegisteredUser}
          >
            {savingRegisteredUser ? 'Saving...' : 'Save Changes'}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setEditingRegisteredUser(null)}
            disabled={savingRegisteredUser}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  </div>
)}


          {/* Search and pagination side by side */}
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
            <div
              className="flex-grow-1"
              style={{ minWidth: '240px', maxWidth: '1000px' }}
            >
              <div className="input-group">
                <span className="input-group-text">
                  <i className="bi bi-search" aria-hidden="true"></i>
                  </span>
                  <input
                  type="search"
                  className="form-control"
                  placeholder="Search by username, name, email, role, department, or status..."
                  aria-label="Search registered users"
                  value={userSearch}
                  onChange={(event) => {
                    setUserSearch(event.target.value);
                    setCurrentPage(1);
                  }}
                  />
                  </div>
            </div>

            <div className="d-flex flex-wrap align-items-center gap-2">
              <label
                htmlFor="registered-users-page-size"
                className="text-muted small mb-0"
              >
                Show:
              </label>

              <select
                id="registered-users-page-size"
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                value={usersPerPage}
                onChange={(event) => {
                  setUsersPerPage(event.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Number of registered users per page"
              >
                <option value="10">10</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="all">All</option>
              </select>

              {!showAllUsers && totalPages > 1 && (
                <nav aria-label="Registered users pagination">
                  <ul className="pagination pagination-sm mb-0">
                    <li
                      className={`page-item ${
                        currentPage === 1 ? 'disabled' : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="page-link"
                        onClick={() =>
                          setCurrentPage((page) => Math.max(1, page - 1))
                        }
                        disabled={currentPage === 1}
                      >
                        Previous
                      </button>
                    </li>

                    {Array.from(
                      { length: totalPages },
                      (_, index) => index + 1
                    ).map((page) => (
                      <li
                        key={page}
                        className={`page-item ${
                          currentPage === page ? 'active' : ''
                        }`}
                      >
                        <button
                          type="button"
                          className="page-link"
                          onClick={() => setCurrentPage(page)}
                          aria-current={
                            currentPage === page ? 'page' : undefined
                          }
                        >
                          {page}
                        </button>
                      </li>
                    ))}

                    <li
                      className={`page-item ${
                        currentPage === totalPages || totalPages === 0
                          ? 'disabled'
                          : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="page-link"
                        onClick={() =>
                          setCurrentPage((page) =>
                            Math.min(totalPages, page + 1)
                          )
                        }
                        disabled={
                          currentPage === totalPages || totalPages === 0
                        }
                      >
                        Next
                      </button>
                    </li>
                  </ul>
                </nav>
              )}
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="text-center py-5 bg-light rounded">
              <div style={{ fontSize: '4rem' }}>👥</div>
              <h4>
                {users.length === 0
                  ? 'No registered accounts found'
                  : 'No matching users found'}
              </h4>
              <p className="text-muted">
                {users.length === 0
                  ? 'User accounts will appear here after registration.'
                  : 'Try another search term.'}
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
                  {paginatedUsers.map((userItem) => (
                    <tr key={userItem.id}>
                      <td>
                        {String(userItem.id || '').slice(0, 8) || 'N/A'}
                      </td>

                      <td>
                        <strong>{userItem.username || 'N/A'}</strong>

                        {(userItem.first_name || userItem.last_name) && (
                          <div>
                            <small className="text-muted">
                              {userItem.first_name} {userItem.last_name}
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

                      <td >
                        <div className="d-flex flex-row flex-wrap align-items-center gap-2">

                          {/* Activate / Deactivate */}
                          <button
                          type="button"
                          className={`btn btn-sm ${
                            userItem.is_active !== false
                            ? 'btn-warning'
                            : 'btn-success'
                          }`}
                          onClick={() => handleToggleActive(userItem.id)}
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

                            {/* Edit */}
                            <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => handleEditRegisteredUser(userItem)}
                            disabled={user?.role !== 'admin'}
                            title="Edit user details"
                            >
                              <i className="bi bi-pencil-square me-1"></i>
                              Edit
                              </button>

                              {/* Delete */}
                              <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              onClick={() =>
                                handleDeleteUser(userItem.id, userItem.username)
                              }
                              title="Delete user"
                              disabled={
                                userItem.id === user.id ||
                                user?.role !== 'admin'
                              }
                              >
                                <i className="bi bi-trash me-1"></i>
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
