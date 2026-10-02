import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';
import authService from '../../services/authService';

const ResetPasswordOTP = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const emailFromUrl = searchParams.get('email') || '';
  const emailFromState = location.state?.email || '';
  const initialEmail = emailFromUrl || emailFromState;

  const [formData, setFormData] = useState({
    email: initialEmail,
    otp: '',
    new_password: '',
    confirm_password: ''
  });
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(1);
  const [otpVerified, setOtpVerified] = useState(false);

  // Password validation
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    noSpaces: true,
  });

  useEffect(() => {
    const pwd = formData.new_password;
    setPasswordChecks({
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
      noSpaces: !/\s/.test(pwd),
    });
  }, [formData.new_password]);

  const isPasswordValid = () => {
    return (
      passwordChecks.length &&
      passwordChecks.uppercase &&
      passwordChecks.lowercase &&
      passwordChecks.number &&
      passwordChecks.special &&
      passwordChecks.noSpaces
    );
  };

  const getPasswordStrength = () => {
    const checks = Object.values(passwordChecks).filter(Boolean).length;
    if (formData.new_password.length === 0) return { level: 0, label: '', color: '' };
    if (checks <= 2) return { level: 1, label: 'Weak', color: 'danger' };
    if (checks <= 4) return { level: 2, label: 'Medium', color: 'warning' };
    if (checks === 5) return { level: 3, label: 'Strong', color: 'info' };
    return { level: 4, label: 'Very Strong', color: 'success' };
  };

  const strength = getPasswordStrength();

  useEffect(() => {
    if (emailFromUrl && emailFromUrl !== formData.email) {
      setFormData(prev => ({ ...prev, email: emailFromUrl }));
    }
  }, [emailFromUrl]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleOTPChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setFormData({ ...formData, otp: value });
    if (error) setError('');
  };

  // ✅ STEP 1: Verify OTP with backend before moving to step 2
  const handleVerifyOTP = async (e) => {
    e.preventDefault();

    if (!formData.email) {
      setError('Email is required');
      return;
    }
    if (formData.otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      // ✅ Call backend to verify OTP
      await authService.verifyOTP(formData.email, formData.otp);
      setOtpVerified(true);
      setStep(2);
      toast.success('OTP verified! Now create your new password.');
    } catch (error) {
      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.detail ||
        'Invalid or expired OTP. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
      // Stay on step 1
      setOtpVerified(false);
      setStep(1);
    }
    setVerifying(false);
  };

  // ✅ STEP 2: Reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!isPasswordValid()) {
      setError('Password does not meet all requirements');
      return;
    }
    if (formData.new_password !== formData.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await authService.confirmPasswordReset(
        formData.email,
        formData.otp,
        formData.new_password
      );
      setSuccess(true);
      toast.success('Password reset successfully!');
      setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to reset password';
      setError(errorMsg);
      toast.error(errorMsg);
      // If OTP is now invalid/expired, go back to step 1
      if (errorMsg.toLowerCase().includes('otp') || errorMsg.toLowerCase().includes('expired')) {
        setOtpVerified(false);
        setStep(1);
        setFormData(prev => ({ ...prev, otp: '' }));
      }
    }
    setLoading(false);
  };

  const handleSubmit = (e) => {
    if (step === 1) {
      return handleVerifyOTP(e);
    }
    return handleResetPassword(e);
  };

  const handleBackToOTP = () => {
    setStep(1);
    setOtpVerified(false);
    setError('');
    setFormData(prev => ({ ...prev, otp: '', new_password: '', confirm_password: '' }));
  };

  const handleResendOTP = async () => {
    if (!formData.email) {
      setError('Email is required');
      return;
    }
    setVerifying(true);
    try {
      await authService.requestPasswordReset(formData.email);
      toast.success('New OTP sent to your email.');
      setFormData(prev => ({ ...prev, otp: '' }));
      setError('');
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to resend OTP';
      setError(errorMsg);
      toast.error(errorMsg);
    }
    setVerifying(false);
  };

  if (success) {
    return (
      <div className="row justify-content-center mt-5">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow-lg border-0 rounded-4 text-center p-5">
            <div style={{ fontSize: '4rem' }}>✅</div>
            <h3 className="text-success mt-3">Password Reset!</h3>
            <p className="text-muted">Redirecting to login...</p>
          </div>
        </div>
      </div>
    );
  }

  const RequirementItem = ({ met, text }) => (
    <div className="d-flex align-items-center mb-1">
      <i
        className={`bi bi-${met ? 'check-circle-fill text-success' : 'circle text-muted'} me-2`}
        style={{ fontSize: '0.9rem' }}
      ></i>
      <small className={met ? 'text-success' : 'text-muted'}>{text}</small>
    </div>
  );

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
              <h1 className="display-6 fw-bold text-primary">
                {step === 1 ? '🔐 Enter OTP' : '🔑 New Password'}
              </h1>
              <p className="text-muted">
                {step === 1
                  ? 'Enter the 6-digit code sent to your email'
                  : 'Create your new password'}
              </p>
            </div>

            {/* Progress indicator */}
            <div className="d-flex justify-content-center mb-4">
              <div className="d-flex align-items-center">
                <div
                  className={`rounded-circle d-flex align-items-center justify-content-center ${
                    step >= 1 ? 'bg-primary text-white' : 'bg-light text-muted'
                  }`}
                  style={{ width: '32px', height: '32px', fontWeight: 'bold' }}
                >
                  {otpVerified ? <i className="bi bi-check"></i> : '1'}
                </div>
                <div
                  className={`mx-2 ${step >= 2 ? 'bg-primary' : 'bg-light'}`}
                  style={{ height: '2px', width: '40px' }}
                />
                <div
                  className={`rounded-circle d-flex align-items-center justify-content-center ${
                    step >= 2 ? 'bg-primary text-white' : 'bg-light text-muted'
                  }`}
                  style={{ width: '32px', height: '32px', fontWeight: 'bold' }}
                >
                  2
                </div>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="alert alert-danger"
                >
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit}>
              {step === 1 ? (
                <>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      readOnly={!!initialEmail}
                      placeholder="Enter your email"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">OTP Code</label>
                    <input
                      type="text"
                      className="form-control form-control-lg text-center"
                      name="otp"
                      value={formData.otp}
                      onChange={handleOTPChange}
                      maxLength="6"
                      placeholder="000000"
                      style={{ letterSpacing: '10px', fontSize: '24px' }}
                      autoFocus
                    />
                    <small className="text-muted">
                      Check your email inbox for the 6-digit code
                    </small>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-lg w-100"
                    disabled={verifying}
                  >
                    {verifying ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Verifying OTP...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-shield-check me-2"></i>
                        Verify OTP
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn btn-link w-100 mt-2"
                    onClick={handleResendOTP}
                    disabled={verifying}
                  >
                    Didn't receive the code? Resend OTP
                  </button>
                </>
              ) : (
                <>
                  <div className="alert alert-success d-flex align-items-center">
                    <i className="bi bi-check-circle-fill me-2"></i>
                    <div>
                      <strong>OTP Verified!</strong>
                      <br />
                      <small>
                        Verified for <strong>{formData.email}</strong>
                      </small>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">New Password</label>
                    <input
                      type="password"
                      className={`form-control form-control-lg ${
                        formData.new_password && !isPasswordValid() ? 'is-invalid' : ''
                      } ${formData.new_password && isPasswordValid() ? 'is-valid' : ''}`}
                      name="new_password"
                      value={formData.new_password}
                      onChange={handleChange}
                      placeholder="Enter strong password"
                      autoFocus
                    />

                    {formData.new_password && (
                      <div className="mt-2">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <small className="text-muted">Password Strength:</small>
                          <small className={`text-${strength.color} fw-bold`}>
                            {strength.label}
                          </small>
                        </div>
                        <div className="progress" style={{ height: '6px' }}>
                          <motion.div
                            className={`progress-bar bg-${strength.color}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${(strength.level / 4) * 100}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </div>
                    )}

                    {formData.new_password && (
                      <div className="mt-3 p-3 bg-light rounded">
                        <small className="fw-semibold d-block mb-2">
                          Password must contain:
                        </small>
                        <RequirementItem met={passwordChecks.length} text="At least 8 characters" />
                        <RequirementItem met={passwordChecks.uppercase} text="At least one UPPERCASE letter (A-Z)" />
                        <RequirementItem met={passwordChecks.lowercase} text="At least one lowercase letter (a-z)" />
                        <RequirementItem met={passwordChecks.number} text="At least one number (0-9)" />
                        <RequirementItem met={passwordChecks.special} text="At least one special character (!@#$%^&*)" />
                        <RequirementItem met={passwordChecks.noSpaces} text="No spaces allowed" />
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Confirm Password</label>
                    <input
                      type="password"
                      className={`form-control form-control-lg ${
                        formData.confirm_password &&
                        formData.new_password !== formData.confirm_password
                          ? 'is-invalid'
                          : ''
                      } ${
                        formData.confirm_password &&
                        formData.new_password === formData.confirm_password
                          ? 'is-valid'
                          : ''
                      }`}
                      name="confirm_password"
                      value={formData.confirm_password}
                      onChange={handleChange}
                      placeholder="Re-enter password"
                    />
                    {formData.confirm_password &&
                      formData.new_password !== formData.confirm_password && (
                        <small className="text-danger">
                          <i className="bi bi-x-circle me-1"></i>
                          Passwords do not match
                        </small>
                      )}
                    {formData.confirm_password &&
                      formData.new_password === formData.confirm_password && (
                        <small className="text-success">
                          <i className="bi bi-check-circle me-1"></i>
                          Passwords match
                        </small>
                      )}
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-lg w-100"
                    disabled={loading || !isPasswordValid() || !otpVerified}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Resetting...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2"></i>
                        Reset Password
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="btn btn-link w-100 mt-2"
                    onClick={handleBackToOTP}
                  >
                    ← Back to OTP
                  </button>
                </>
              )}
            </form>

            <div className="text-center mt-4">
              <Link to="/login" className="text-muted">
                Back to Login
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ResetPasswordOTP;