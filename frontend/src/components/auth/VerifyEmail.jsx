import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import authService from '../../services/authService';

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const emailFromUrl = searchParams.get('email') || '';
  const emailFromState = location.state?.email || '';
  const sessionEmail = sessionStorage.getItem('pending_verification_email') || '';
  const initialEmail = emailFromUrl || emailFromState || sessionEmail;

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (success || countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown, success]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) return setError('Email is required');
    if (otp.length !== 6) return setError('Please enter a valid 6-digit OTP');

    setLoading(true);
    try {
      await authService.verifyEmailOTP(email, otp);
      sessionStorage.removeItem('pending_verification_email');
      setSuccess(true);
      toast.success('Account verified! Redirecting...');

      // ✅ After successful verification → go to /account-created
      setTimeout(() => {
        navigate('/account-created', {
          state: { email, justVerified: true },
          replace: true,
        });
      }, 1500);
    } catch (err) {
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Verification failed. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
    }
    setLoading(false);
  };

  const handleResend = async () => {
    if (!email) return setError('Email is required');
    setResending(true);
    setError('');
    try {
      await authService.resendVerification(email);
      toast.success('New OTP sent to your email and phone.');
      setCountdown(60);
      setOtp('');
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to resend OTP.';
      setError(errorMsg);
      toast.error(errorMsg);
    }
    setResending(false);
  };

  if (success) {
    return (
      <div className="row justify-content-center mt-5">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow-lg border-0 rounded-4 text-center p-5">
            <div style={{ fontSize: '4rem' }}>✅</div>
            <h3 className="text-success mt-3">Account Verified!</h3>
            <p className="text-muted">Redirecting...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="row justify-content-center mt-5">
      <div className="col-md-6 col-lg-5">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                    className="card shadow-lg border-0 rounded-4">
          <div className="card-body p-5">
            <div className="text-center mb-4">
              <h1 className="display-6 fw-bold text-primary">📧 Verify Account</h1>
              <p className="text-muted">Enter the 6-digit OTP sent to your <strong>email</strong> and <strong>phone</strong></p>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }} className="alert alert-danger">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label fw-semibold">Email</label>
                <input type="email" className="form-control" value={email}
                       onChange={(e) => setEmail(e.target.value)}
                       required readOnly={!!initialEmail} />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">OTP Code</label>
                <input type="text" className="form-control form-control-lg text-center"
                       value={otp}
                       onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                       maxLength="6" placeholder="000000"
                       style={{ letterSpacing: '10px', fontSize: '24px' }} autoFocus />
                <small className="text-muted">
                  Check your email inbox and phone SMS for the same 6-digit code.
                </small>
              </div>

              <button type="submit" className="btn btn-primary btn-lg w-100" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Verifying...
                  </>
                ) : 'Verify Account'}
              </button>
            </form>

            <div className="text-center mt-3">
              <button type="button" className="btn btn-link"
                      onClick={handleResend} disabled={resending || countdown > 0}>
                {resending ? 'Sending...' : countdown > 0
                  ? `Resend OTP in ${countdown}s`
                  : "Didn't get the code? Resend OTP"}
              </button>
            </div>

            <div className="text-center mt-3">
              <Link to="/login" className="text-muted">Back to Login</Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default VerifyEmail;