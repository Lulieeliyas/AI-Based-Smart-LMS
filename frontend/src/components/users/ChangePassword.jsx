import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import authService from '../../services/authService';
// await userService.changePassword(formData.old_password, formData.new_password);

const ChangePassword = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate passwords
    if (formData.new_password.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    
    if (formData.new_password !== formData.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await authService.changePassword(formData.old_password, formData.new_password);
      setSuccess(true);
      toast.success('Password changed successfully!');
      setTimeout(() => {
        navigate('/profile');
      }, 2000);
    } catch (error) {
      console.error('Change password error:', error);
      const errorMsg = error.response?.data?.error || 
                       error.response?.data?.detail || 
                       'Failed to change password. Please check your current password.';
      setError(errorMsg);
      toast.error(errorMsg);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="row justify-content-center mt-5">
        <div className="col-md-6">
          <div className="card shadow-lg border-0 rounded-4">
            <div className="card-body p-5 text-center">
              <div style={{ fontSize: '4rem' }}>✅</div>
              <h3 className="mt-3 text-success">Password Changed!</h3>
              <p className="text-muted">Your password has been updated successfully.</p>
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/profile')}
              >
                <i className="bi bi-person me-2"></i>
                Go to Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="row justify-content-center mt-5">
      <div className="col-md-6 col-lg-5">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="card shadow-lg border-0 rounded-4"
        >
          <div className="card-body p-5">
            <motion.div 
              className="text-center mb-4"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="display-6 fw-bold text-primary">🔑 Change Password</h1>
              <p className="text-muted">Update your account password.</p>
            </motion.div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -20, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="alert alert-danger alert-dismissible fade show"
                  role="alert"
                >
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {error}
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => setError('')}
                  ></button>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="old_password" className="form-label fw-semibold">Current Password</label>
                <div className="input-group">
                  <span className="input-group-text bg-light">
                    <i className="bi bi-lock"></i>
                  </span>
                  <input
                    type="password"
                    className="form-control form-control-lg"
                    id="old_password"
                    name="old_password"
                    value={formData.old_password}
                    onChange={handleChange}
                    required
                    placeholder="Enter current password"
                    autoFocus
                  />
                </div>
              </div>

              <div className="mb-3">
                <label htmlFor="new_password" className="form-label fw-semibold">New Password</label>
                <div className="input-group">
                  <span className="input-group-text bg-light">
                    <i className="bi bi-lock"></i>
                  </span>
                  <input
                    type="password"
                    className="form-control form-control-lg"
                    id="new_password"
                    name="new_password"
                    value={formData.new_password}
                    onChange={handleChange}
                    required
                    placeholder="Min 8 characters"
                  />
                </div>
                <small className="text-muted">
                  Password must be at least 8 characters long.
                </small>
              </div>

              <div className="mb-3">
                <label htmlFor="confirm_password" className="form-label fw-semibold">Confirm New Password</label>
                <div className="input-group">
                  <span className="input-group-text bg-light">
                    <i className="bi bi-lock"></i>
                  </span>
                  <input
                    type="password"
                    className="form-control form-control-lg"
                    id="confirm_password"
                    name="confirm_password"
                    value={formData.confirm_password}
                    onChange={handleChange}
                    required
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>

              <motion.div 
                className="d-grid mt-4"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <button 
                  type="submit" 
                  className="btn btn-primary btn-lg"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Changing Password...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle me-2"></i>
                      Change Password
                    </>
                  )}
                </button>
              </motion.div>
            </form>

            <div className="text-center mt-4">
              <p className="text-muted">
                <Link to="/profile" className="text-decoration-none">
                  <i className="bi bi-arrow-left me-1"></i>
                  Back to Profile
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ChangePassword;