import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';

// ✅ Single source of truth: which dashboard each role lands on
const getDashboardPathForRole = (role) => {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'librarian':
      return '/librarian/dashboard';
    case 'digital_officer':
      return '/digital-officer/dashboard';
    case 'academic_staff':
      return '/staff/dashboard';
    case 'student':
       return '/student/dashboard';
    case 'guest':
       return '/public/PublicDashboards';
    default:
     
  }
};

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (error) setError('');
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(formData.username, formData.password);

    if (result.success) {
      // ✅ Redirect to the dashboard that belongs to this role
      const role = result.user?.role;
      const target = getDashboardPathForRole(role);
      toast.success(
        `Welcome back, ${result.user?.first_name || result.user?.username || ''}!`
      );
      navigate(target, { replace: true });
    } else {
      setError(result.error || 'Login failed. Please check your credentials.');

      // ✅ If email is not verified, redirect to verify page
      if (result.requiresVerification) {
        toast.info('Please verify your account to continue.');
        setTimeout(() => {
          navigate('/verify-email', { state: { email: result.email } });
        }, 1500);
      }
    }
    setLoading(false);
  };

  const showEyeIcon = formData.password.length > 0;

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
              <h1 className="display-6 fw-bold text-primary">📚 AI-Based LMS</h1>
              <p className="text-muted">Welcome back! Please login to continue.</p>
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
                <label htmlFor="username" className="form-label fw-semibold">
                  Username
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-light">
                    <i className="bi bi-person"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control form-control-lg"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    placeholder="Enter your username"
                    autoFocus
                  />
                </div>
              </div>

              <div className="mb-3">
                <label htmlFor="password" className="form-label fw-semibold">
                  Password
                </label>
                <div className="input-group">
                  <span className="input-group-text bg-light">
                    <i className="bi bi-lock"></i>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control form-control-lg"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="Enter your password"
                  />
                  <AnimatePresence>
                    {showEyeIcon && (
                      <motion.button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={togglePasswordVisibility}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        <i className={`bi bi-${showPassword ? 'eye-slash' : 'eye'}`}></i>
                      </motion.button>
                    )}
                  </AnimatePresence>
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
                      Logging in...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-box-arrow-in-right me-2"></i>
                      Login
                    </>
                  )}
                </button>
              </motion.div>
            </form>

            <div className="text-center mt-4">
              <p className="text-muted">
                Don't have an account?
                <Link to="/register" className="fw-semibold text-primary ms-1">
                  Register here
                </Link>
              </p>
            </div>

            <div className="text-center mt-2">
              <small>
                <Link to="/forgot-password" className="text-muted text-decoration-none">
                  Forgot password?
                </Link>
              </small>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;