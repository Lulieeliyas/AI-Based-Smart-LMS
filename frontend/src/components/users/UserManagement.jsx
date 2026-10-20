import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import userService from '../../services/userService';
import { useAuth } from '../../context/AuthContext';

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);

  useEffect(() => {
    // ✅ Check if user has admin or librarian role
    if (user?.role === 'admin' || user?.role === 'librarian') {
      fetchUsers();
    } else {
      setError('You do not have permission to view users. Admin or Librarian access required.');
      setLoading(false);
    }
  }, [user]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await userService.getUsers();
      console.log('API Response:', response);
      
      // ✅ Handle different response formats
      let data = response.data;
      
      // If response has results (paginated), use results
      if (data && typeof data === 'object' && data.results) {
        data = data.results;
      }
      
      // Ensure data is an array
      if (!Array.isArray(data)) {
        console.warn('Data is not an array:', data);
        data = [];
      }
      
      setUsers(data);
      console.log('Users set:', data.length, 'users');
      
    } catch (error) {
      console.error('Error fetching users:', error);
      
      // ✅ Better error handling
      let errorMsg = 'Failed to load users';
      if (error.response?.status === 403) {
        errorMsg = 'You do not have permission to view users. Admin access required.';
      } else if (error.response?.status === 401) {
        errorMsg = 'Please login to view users.';
      } else if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.response?.data?.error) {
        errorMsg = error.response.data.error;
      }
      
      setError(errorMsg);
      toast.error(errorMsg);
      setUsers([]);
    }
    setLoading(false);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await userService.updateUserRole(userId, newRole);
      setSuccess('User role updated successfully!');
      toast.success('User role updated successfully!');
      fetchUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to update user role';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleToggleActive = async (userId) => {
    try {
      const userToToggle = users.find(u => u.id === userId);
      if (userToToggle) {
        const newStatus = !userToToggle.is_active;
        await userService.partialUpdateUser(userId, { is_active: newStatus });
        setSuccess(`User ${newStatus ? 'activated' : 'deactivated'} successfully!`);
        toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully!`);
        fetchUsers();
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to update user status';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) return;
    
    try {
      await userService.deleteUser(userId);
      setSuccess('User deleted successfully!');
      toast.success('User deleted successfully!');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      const errorMsg = error.response?.data?.detail || error.response?.data?.error || 'Failed to delete user';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  // ✅ Check if user has permission
    const handleCSVUpload = async (event) => {
      if (!csvFile || !csvFile.name.toLowerCase().endsWith('.csv')) {
  alert('Please select a CSV file (.csv) only.');
  return;
}

if (
  csvFile.type &&
  csvFile.type !== 'text/csv' &&
  csvFile.type !== 'application/vnd.ms-excel' &&
  csvFile.type !== 'application/csv' &&
  csvFile.type !== 'application/octet-stream'
) {
  alert('Invalid file type. Please select a CSV file only.');
  return;
}
    event.preventDefault();

    if (!csvFile) {
      toast.error('Please select a CSV file first.');
      return;
    }

    setCsvUploading(true);
    setError('');
    setSuccess('');

    try {
      const response = await userService.uploadAuthorizedUsersCSV(csvFile);
      const result = response.data;

      const message =
        `CSV import finished: ${result.imported} imported, ` +
        `${result.rejected} rejected.`;

      setSuccess(message);
      toast.success(message);

      if (result.errors?.length) {
        console.warn('CSV row errors:', result.errors);
        toast.warning('Some rows were rejected. Check the import results below.');
      }

      setCsvFile(null);
      event.target.reset();
    } catch (error) {
      const data = error.response?.data;
      const message =
        data?.error ||
        data?.detail ||
        'CSV upload failed. Please check your file and admin permissions.';

      setError(message);
      toast.error(message);
    } finally {
      setCsvUploading(false);
    }
  };
  if (!user) {
    return (
      <div className="text-center py-5">
        <div style={{ fontSize: '4rem' }}>🔒</div>
        <h3>Please Login</h3>
        <p className="text-muted">You need to login to access this page.</p>
      </div>
    );
  }

  if (user?.role !== 'admin' && user?.role !== 'librarian') {
    return (
      <div className="text-center py-5">
        <div style={{ fontSize: '4rem' }}>🔒</div>
        <h3>Access Denied</h3>
        <p className="text-muted">You need Admin or Librarian permissions to view this page.</p>
        <p className="text-muted">Your current role: <strong>{user?.role || 'Unknown'}</strong></p>
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

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>👥 User Management</h2>
        {user?.role === 'admin' && (
  <form onSubmit={handleCSVUpload} className="mt-3 mb-3">
    <label htmlFor="authorized-users-csv" className="form-label">
      Import approved users from CSV
    </label>

    <div className="d-flex flex-wrap gap-2 align-items-center">
      <input
        id="authorized-users-csv"
        type="file"
        accept=".csv,text/csv"
        className="form-control"
        style={{ maxWidth: '380px' }}
        onChange={(event) => setCsvFile(event.target.files?.[0] || null)}
        disabled={csvUploading}
      />

      <button
        type="submit"
        className="btn btn-primary"
        disabled={!csvFile || csvUploading}
      >
        {csvUploading ? 'Uploading...' : 'Add CSV File'}
      </button>
    </div>

    <small className="text-muted d-block mt-2">
      CSV columns required: student_id, first_name, last_name, email.
      Optional columns: phone, department, role.
    </small>
  </form>
)}
        <div>
          <span className="text-muted me-3">Total: {users.length} users</span>
          <button 
            className="btn btn-outline-primary btn-sm"
            onClick={fetchUsers}
            disabled={loading}
          >
            <i className="bi bi-arrow-clockwise me-1"></i>
            Refresh
          </button>
        </div>
      </div>
      
      {error && (
        <div className="alert alert-danger alert-dismissible fade show">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}
      
      {success && (
        <div className="alert alert-success alert-dismissible fade show">
          <i className="bi bi-check-circle-fill me-2"></i>
          {success}
          <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
        </div>
      )}

      {users.length === 0 ? (
        <div className="text-center py-5 bg-light rounded">
          <div style={{ fontSize: '4rem' }}>👥</div>
          <h4>No users found</h4>
          <p className="text-muted">Users will appear here once registered</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-striped table-hover">
            <thead className="table-dark">
              <tr>
                <th>ID</th>
                <th>Username</th>
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
                  <td>{userItem.id?.slice(0, 8) || 'N/A'}</td>
                  <td>
                    <strong>{userItem.username}</strong>
                    {userItem.first_name && (
                      <>
                        <br />
                        <small className="text-muted">{userItem.first_name} {userItem.last_name}</small>
                      </>
                    )}
                  </td>
                  <td>{userItem.email}</td>
                  <td>
                    <select
                      className="form-select form-select-sm"
                      value={userItem.role || 'student'}
                      onChange={(e) => handleRoleChange(userItem.id, e.target.value)}
                      style={{ minWidth: '120px' }}
                      disabled={userItem.id === user?.id}
                    >
                      <option value="student">Student</option>
                      <option value="academic_staff">Academic Staff</option>
                      <option value="librarian">Librarian</option>
                      <option value="admin">Admin</option>
                      <option value="digital_officer">Digital Officer</option>
                    </select>
                  </td>
                  <td>{userItem.department || 'N/A'}</td>
                  <td>
                    <span className={`badge bg-${userItem.is_active !== false ? 'success' : 'danger'}`}>
                      {userItem.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="btn-group btn-group-sm">
                      <button 
                        className={`btn btn-${userItem.is_active !== false ? 'warning' : 'success'}`}
                        onClick={() => handleToggleActive(userItem.id)}
                        title={userItem.is_active !== false ? 'Deactivate' : 'Activate'}
                        disabled={userItem.id === user?.id}
                      >
                        {userItem.is_active !== false ? 'Deactivate' : 'Activate'}
                      </button>
                      <button 
                        className="btn btn-danger"
                        onClick={() => handleDeleteUser(userItem.id, userItem.username)}
                        title="Delete User"
                        disabled={userItem.id === user?.id}
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
  );
};

export default UserManagement;