import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import authService from '../../services/authService';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authService.requestPasswordReset(email);
      setSuccess(true);
      toast.success('OTP sent! Check your email inbox.');
      // Redirect to reset password page after 2 seconds
      setTimeout(() => {
        navigate('/reset-password-otp', { state: { email } });
      }, 2000);
    } catch (error) {
      const errorMsg = error.response?.data?.error ||
                       error.response?.data?.detail ||
                       'Failed to send OTP. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
    }
    setLoading(false);
  };

  return (
    <div className="row justify-content-center mt-5">
      <div className="col-md-6 col-lg-5">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="card shadow-lg border-0 rounded-4"
        >
          <div className="card-body p-5">
            <div className="text-center mb-4">
              <h1 className="display-6 fw-bold text-primary">🔑 Forgot Password</h1>
              <p className="text-muted">Enter your email to receive a reset OTP.</p>
            </div>

            {error && (
              <div className="alert alert-danger">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {error}
              </div>
            )}

            {!success ? (
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Email Address</label>
                  <input
                    type="email"
                    className="form-control form-control-lg"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Enter your registered email"
                    autoFocus
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-lg w-100" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Sending OTP...
                    </>
                  ) : (
                    'Send OTP to Email'
                  )}
                </button>
              </form>
            ) : (
              <div className="text-center">
                <div style={{ fontSize: '3rem' }}>📧</div>
                <h4 className="text-success mt-3">OTP Sent!</h4>
                <p className="text-muted">
                  We've sent a 6-digit OTP to <strong>{email}</strong>.
                  Please check your inbox and spam folder.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => navigate('/reset-password-otp', { state: { email } })}
                >
                  Enter OTP
                </button>
              </div>
            )}

            <div className="text-center mt-4">
              <p className="text-muted">
                Remember your password?
                <Link to="/login" className="fw-semibold text-primary ms-1">
                  Login here
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPassword;