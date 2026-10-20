
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import authService from '../../services/authService';

const Register = () => {
  const [formData, setFormData] = useState({
    student_id: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    password2: '',
  });

  const [approvedUser, setApprovedUser] = useState(null);
  const [checkingId, setCheckingId] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [emailValidation, setEmailValidation] = useState({
    valid: null,
    message: '',
  });

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
    setGeneralError('');

    if (name === 'student_id') {
      setApprovedUser(null);
    }

    if (name === 'email') {
      setEmailValidation({ valid: null, message: '' });
    }
  };

  const checkApprovedId = async (e) => {
    e.preventDefault();
    setGeneralError('');
    setErrors({});

    const studentId = formData.student_id.trim();

    if (!studentId) {
      setErrors({ student_id: 'Student or staff ID is required.' });
      return;
    }

    setCheckingId(true);

    try {
      const response = await authService.lookupAuthorizedUser(studentId);
      const data = response.data;

      setApprovedUser(data);
      toast.success('Approved ID found. Please complete your registration.');
    } catch (error) {
      setApprovedUser(null);

      const data = error.response?.data;
      const message =
        data?.error ||
        data?.student_id?.[0] ||
        'Unable to verify this ID. Please try again.';

      setErrors({ student_id: message });
      toast.error(message);
    } finally {
      setCheckingId(false);
    }
  };

  const validateEmail = (email) => {
    const value = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Please enter a valid email address.';
    }

    if (value.includes('..')) {
      return 'Email cannot contain consecutive dots.';
    }

    return '';
  };

  const validatePhone = (phone) => {
    const value = phone.trim().replace(/[\s-]/g, '');

    if (!/^(\+251|251|0)?[79]\d{8}$/.test(value)) {
      return 'Enter a valid Ethiopian phone number, e.g. 0912345678.';
    }

    return '';
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!approvedUser) {
      nextErrors.student_id = 'Check and confirm your approved ID first.';
    }

    if (!formData.username.trim()) {
      nextErrors.username = 'Username is required.';
    } else if (formData.username.trim().length < 3) {
      nextErrors.username = 'Username must be at least 3 characters.';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username.trim())) {
      nextErrors.username =
        'Use only letters, numbers, and underscores in your username.';
    }

    const emailError = validateEmail(formData.email);
    if (emailError) nextErrors.email = emailError;

    const phoneError = validatePhone(formData.phone);
    if (phoneError) nextErrors.phone = phoneError;

    if (!formData.password) {
      nextErrors.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.';
    }

    if (formData.password !== formData.password2) {
      nextErrors.password2 = 'Passwords do not match.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    if (!validateForm()) {
      toast.error('Please fix the errors before submitting.');
      return;
    }

    setLoading(true);

    const email = formData.email.trim().toLowerCase();

    const registerData = {
      student_id: approvedUser.student_id,
      username: formData.username.trim(),
      email,
      phone: formData.phone.trim(),
      password: formData.password,
      password2: formData.password2,
    };

    try {
      const result = await register(registerData);

      if (result.success) {
        toast.success('Registration submitted. Please verify your OTP.');

        sessionStorage.setItem('pending_verification_email', email);

        navigate('/verify-email', {
          state: { email },
          replace: true,
        });
      } else {
        const error = result.error;

        if (error && typeof error === 'object') {
          const normalized = {};

          Object.entries(error).forEach(([key, value]) => {
            normalized[key] = Array.isArray(value) ? value[0] : value;
          });

          setErrors(normalized);

          const firstMessage = Object.values(normalized)[0];
          if (firstMessage) toast.error(String(firstMessage));
        } else {
          const message =
            typeof error === 'string'
              ? error
              : 'Registration failed. Please try again.';

          setGeneralError(message);
          toast.error(message);
        }
      }
    } catch (error) {
      console.error('Registration error:', error);

      const message =
        error.response?.data?.error ||
        'An unexpected error occurred. Please try again.';

      setGeneralError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="row justify-content-center mt-4">
      <div className="col-md-8 col-lg-6">
        <div className="card shadow-lg border-0 rounded-4">
          <div className="card-body p-5">
            <div className="text-center mb-4">
              <h2 className="fw-bold text-primary">📝 Create Account</h2>
              <p className="text-muted">
                Register using your approved student or staff ID.
              </p>
            </div>

            {generalError && (
              <div className="alert alert-danger">
                {generalError}
                <button
                  type="button"
                  className="btn-close float-end"
                  aria-label="Close"
                  onClick={() => setGeneralError('')}
                />
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label fw-semibold">
                  Student or Staff ID *
                </label>

                <div className="input-group">
                  <input
                    type="text"
                    className={`form-control ${
                      errors.student_id ? 'is-invalid' : ''
                    }`}
                    name="student_id"
                    value={formData.student_id}
                    onChange={handleChange}
                    required
                    placeholder="Enter your approved ID"
                    disabled={loading || checkingId}
                  />

                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={checkApprovedId}
                    disabled={checkingId || loading}
                  >
                    {checkingId ? 'Checking...' : 'Check ID'}
                  </button>
                </div>

                {errors.student_id && (
                  <div className="text-danger small mt-1">
                    {errors.student_id}
                  </div>
                )}
              </div>

              {approvedUser && (
                <>
                  <div className="alert alert-success">
                    <strong>ID approved.</strong> Confirm that the displayed
                    information matches your identity.
                  </div>

                  <h5 className="fw-semibold mb-3">
                    Approved identity (read-only)
                  </h5>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">First Name</label>
                      <input
                        className="form-control"
                        value={approvedUser.first_name || ''}
                        readOnly
                      />
                    </div>

                    <div className="col-md-6 mb-3">
                      <label className="form-label">Last Name</label>
                      <input
                        className="form-control"
                        value={approvedUser.last_name || ''}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Department</label>
                    <input
                      className="form-control"
                      value={approvedUser.department || ''}
                      readOnly
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Approved Role</label>
                    <input
                      className="form-control"
                      value={approvedUser.role || ''}
                      readOnly
                    />
                  </div>

                  <div className="alert alert-light border small">
                    <div>
                      <strong>Roster email:</strong>{' '}
                      {approvedUser.masked_email || 'Not available'}
                    </div>
                    <div>
                      <strong>Roster phone:</strong>{' '}
                      {approvedUser.masked_phone || 'Not available'}
                    </div>
                    <div className="mt-1">
                      Enter the email and phone number you want to use for
                      account verification below.
                    </div>
                  </div>

                  <hr />

                  <h5 className="fw-semibold mb-3">
                    Your registration details
                  </h5>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Username *
                    </label>
                    <input
                      type="text"
                      className={`form-control ${
                        errors.username ? 'is-invalid' : ''
                      }`}
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      required
                    />
                    {errors.username && (
                      <div className="invalid-feedback">
                        {errors.username}
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Email *</label>
                    <input
                      type="email"
                      className={`form-control ${
                        errors.email ? 'is-invalid' : ''
                      }`}
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="yourname@gmail.com"
                    />
                    {errors.email && (
                      <div className="invalid-feedback">{errors.email}</div>
                    )}
                    <small className="text-muted">
                      Verification will be sent to this email address.
                    </small>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Phone *</label>
                    <input
                      type="tel"
                      className={`form-control ${
                        errors.phone ? 'is-invalid' : ''
                      }`}
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      placeholder="0912345678"
                    />
                    {errors.phone && (
                      <div className="invalid-feedback">{errors.phone}</div>
                    )}
                    <small className="text-muted">
                      Enter a number that you can access for SMS verification.
                    </small>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-semibold">
                        Password *
                      </label>
                      <input
                        type="password"
                        className={`form-control ${
                          errors.password ? 'is-invalid' : ''
                        }`}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        autoComplete="new-password"
                      />
                      {errors.password && (
                        <div className="invalid-feedback">
                          {errors.password}
                        </div>
                      )}
                    </div>

                    <div className="col-md-6 mb-3">
                      <label className="form-label fw-semibold">
                        Confirm Password *
                      </label>
                      <input
                        type="password"
                        className={`form-control ${
                          errors.password2 ? 'is-invalid' : ''
                        }`}
                        name="password2"
                        value={formData.password2}
                        onChange={handleChange}
                        required
                        autoComplete="new-password"
                      />
                      {errors.password2 && (
                        <div className="invalid-feedback">
                          {errors.password2}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-100 btn-lg"
                    disabled={loading}
                  >
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </button>
                </>
              )}
            </form>

            <div className="text-center mt-4">
              <p className="text-muted">
                Already have an account?{' '}
                <Link to="/login" className="fw-semibold text-primary">
                  Login here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
