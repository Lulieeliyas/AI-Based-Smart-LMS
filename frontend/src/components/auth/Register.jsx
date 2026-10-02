import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
    first_name: '',
    last_name: '',
    role: 'student',
    phone: '',
    department: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [emailValidation, setEmailValidation] = useState({
    valid: null,
    message: '',
  });
  const { register } = useAuth();
  const navigate = useNavigate();

  const BLOCKED_DOMAINS = [
    'tempmail.com', 'throwaway.com', 'guerrillamail.com',
    'mailinator.com', '10minutemail.com', 'temp-mail.org',
    'fakeinbox.com', 'trashmail.com', 'yopmail.com',
    'example.com', 'example.org', 'example.net',
    'test.com', 'test.org', 'localhost', 'invalid.com',
    'fake.com', 'dummy.com', 'maildrop.cc', 'sharklasers.com',
    'getnada.com', 'dispostable.com', 'mintemail.com',
    'guerrillamailblock.com', 'grr.la', 'tempinbox.com',
    'spamgourmet.com', 'trashmail.net', 'mailnesia.com',
    'gmial.com', 'gmai.com', 'gamil.com', 'gmaill.com',
    'yaho.com', 'yahooo.com', 'outlok.com', 'outloo.com',
    'notreal.com', 'notanemail.com', 'random.com', 'asdf.com',
    'qwerty.com', 'abc.com', 'xyz.com', 'foo.com', 'bar.com',
  ];

  const TYPO_CORRECTIONS = {
    'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com',
    'gamil.com': 'gmail.com', 'gmaill.com': 'gmail.com',
    'gmal.com': 'gmail.com', 'gnail.com': 'gmail.com',
    'gmail.co': 'gmail.com', 'gmail.cm': 'gmail.com',
    'gmail.con': 'gmail.com', 'gmail.comm': 'gmail.com',
    'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
    'hotmil.com': 'hotmail.com', 'yaho.com': 'yahoo.com',
    'yahooo.com': 'yahoo.com', 'yahoo.co': 'yahoo.com',
    'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com',
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) setErrors({ ...errors, [name]: '' });
    if (generalError) setGeneralError('');
    if (name === 'email') {
      setEmailValidation({ valid: null, message: '' });
    }
  };

  const validateEmail = (email) => {
    const trimmed = email.toLowerCase().trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { valid: false, message: 'Please enter a valid email address (e.g., name@gmail.com)' };
    }
    if (!trimmed.includes('@')) {
      return { valid: false, message: 'Email must contain @ symbol' };
    }

    const [localPart, domain] = trimmed.split('@');

    if (localPart.length < 2) {
      return { valid: false, message: 'Email username is too short' };
    }
    if (localPart.startsWith('.') || localPart.endsWith('.')) {
      return { valid: false, message: 'Email username cannot start or end with a dot' };
    }
    if (!domain.includes('.')) {
      return { valid: false, message: 'Email domain is not valid' };
    }
    const tld = domain.split('.').pop();
    if (tld.length < 2) {
      return { valid: false, message: 'Email must have a valid domain (e.g., .com, .org, .edu)' };
    }
    if (BLOCKED_DOMAINS.includes(domain)) {
      if (TYPO_CORRECTIONS[domain]) {
        return {
          valid: false,
          message: `Did you mean ${localPart}@${TYPO_CORRECTIONS[domain]}? Please use a real email.`
        };
      }
      return {
        valid: false,
        message: 'This email domain is not allowed. Please use a real email (Gmail, Yahoo, Outlook, etc.)'
      };
    }
    if (trimmed.includes('..')) {
      return { valid: false, message: 'Email cannot have consecutive dots' };
    }

    return { valid: true, message: 'Email looks valid' };
  };

  const validatePhone = (phone) => {
    if (!phone) return 'Phone number is required for SMS verification';
    const cleaned = phone.trim().replace(/\s/g, '').replace(/-/g, '');
    if (!/^(\+251|251|0)?[79]\d{8}$/.test(cleaned)) {
      return 'Please enter a valid Ethiopian phone number (e.g., 0912345678)';
    }
    return '';
  };

  const handleEmailBlur = () => {
    if (!formData.email) return;
    const result = validateEmail(formData.email);
    setEmailValidation(result);
    if (!result.valid) {
      setErrors({ ...errors, email: result.message });
    } else {
      setErrors({ ...errors, email: '' });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) newErrors.username = 'Username is required';
    else if (formData.username.length < 3) newErrors.username = 'Username must be at least 3 characters';
    else if (!/^[a-zA-Z0-9_]+$/.test(formData.username))
      newErrors.username = 'Username can only contain letters, numbers, and underscores';

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else {
      const emailCheck = validateEmail(formData.email);
      if (!emailCheck.valid) newErrors.email = emailCheck.message;
    }

    const phoneError = validatePhone(formData.phone);
    if (phoneError) newErrors.phone = phoneError;

    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    else if (!/[A-Z]/.test(formData.password)) newErrors.password = 'Must include at least one uppercase letter';
    else if (!/[a-z]/.test(formData.password)) newErrors.password = 'Must include at least one lowercase letter';
    else if (!/[0-9]/.test(formData.password)) newErrors.password = 'Must include at least one number';
    else if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password))
      newErrors.password = 'Must include at least one special character';

    if (formData.password !== formData.password2) {
      newErrors.password2 = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    setLoading(true);

    const registerData = {
      username: formData.username.trim(),
      email: formData.email.toLowerCase().trim(),
      password: formData.password,
      password2: formData.password2,
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      role: formData.role,
      phone: formData.phone.trim(),
      department: formData.department.trim()
    };

    try {
      const result = await register(registerData);

      if (result.success) {
        toast.success('OTP sent! Please verify to activate your account.');

        // Store email for verification page
        sessionStorage.setItem(
          'pending_verification_email',
          formData.email.toLowerCase().trim()
        );

        // ✅ Go DIRECTLY to verification page
        // "Account Created Successfully" comes AFTER verification
        navigate('/verify-email', {
          state: { email: formData.email.toLowerCase().trim() },
          replace: true,
        });
      } else {
        if (typeof result.error === 'object') {
          setErrors(result.error);
          const firstError = Object.values(result.error)[0];
          if (firstError) {
            const msg = Array.isArray(firstError) ? firstError[0] : firstError;
            toast.error(msg);
            if (result.error.email) {
              setErrors({
                ...result.error,
                email: Array.isArray(result.error.email) ? result.error.email[0] : result.error.email,
              });
            }
          }
        } else if (typeof result.error === 'string') {
          setGeneralError(result.error);
          toast.error(result.error);
        } else {
          setGeneralError('Registration failed. Please try again.');
          toast.error('Registration failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      setGeneralError('An unexpected error occurred. Please try again.');
      toast.error('An unexpected error occurred. Please try again.');
    }

    setLoading(false);
  };

  return (
    <div className="row justify-content-center mt-4">
      <div className="col-md-8 col-lg-6">
        <div className="card shadow-lg border-0 rounded-4">
          <div className="card-body p-5">
            <div className="text-center mb-4">
              <h2 className="fw-bold text-primary">📝 Create Account</h2>
              <p className="text-muted">Join our library community today!</p>
            </div>

            {generalError && (
              <div className="alert alert-danger alert-dismissible fade show">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                {generalError}
                <button type="button" className="btn-close" onClick={() => setGeneralError('')}></button>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-semibold">First Name</label>
                  <input
                    type="text"
                    className="form-control"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    placeholder="Enter first name"
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-semibold">Last Name</label>
                  <input
                    type="text"
                    className="form-control"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Username *</label>
                <input
                  type="text"
                  className={`form-control ${errors.username ? 'is-invalid' : ''}`}
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  placeholder="Choose a username"
                />
                {errors.username && <div className="invalid-feedback">{errors.username}</div>}
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">
                  Email *
                  <small className="text-muted ms-2">(Must be a real, working email)</small>
                </label>
                <div className="input-group">
                  <input
                    type="email"
                    className={`form-control ${
                      errors.email ? 'is-invalid' :
                      emailValidation.valid === true ? 'is-valid' : ''
                    }`}
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={handleEmailBlur}
                    required
                    placeholder="yourname@gmail.com"
                  />
                  {emailValidation.valid === true && (
                    <span className="input-group-text bg-success text-white">
                      <i className="bi bi-check-circle-fill"></i>
                    </span>
                  )}
                  {emailValidation.valid === false && (
                    <span className="input-group-text bg-danger text-white">
                      <i className="bi bi-x-circle-fill"></i>
                    </span>
                  )}
                </div>
                {errors.email && <div className="invalid-feedback d-block">{errors.email}</div>}
                {emailValidation.valid === true && !errors.email && (
                  <small className="text-success d-block mt-1">
                    <i className="bi bi-check-circle me-1"></i>Email looks valid
                  </small>
                )}
                <small className="text-muted d-block mt-1">
                  <i className="bi bi-info-circle me-1"></i>
                  We'll send a verification OTP to this email.
                </small>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-semibold">Password *</label>
                  <input
                    type="password"
                    className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="Min 8 chars, mixed case + number + symbol"
                  />
                  {errors.password && <div className="invalid-feedback">{errors.password}</div>}
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-semibold">Confirm Password *</label>
                  <input
                    type="password"
                    className={`form-control ${errors.password2 ? 'is-invalid' : ''}`}
                    name="password2"
                    value={formData.password2}
                    onChange={handleChange}
                    required
                    placeholder="Re-enter password"
                  />
                  {errors.password2 && <div className="invalid-feedback">{errors.password2}</div>}
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-semibold">Role</label>
                  <select
                    className="form-control"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                  >
                    <option value="student">Student</option>
                    <option value="academic_staff">Academic Staff</option>
                    <option value="librarian">Librarian</option>
                    <option value="admin">Admin</option>
                    <option value="digital_officer">Digital Officer</option>
                  </select>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-semibold">
                    Phone *
                    <small className="text-muted ms-2">(for SMS OTP)</small>
                  </label>
                  <input
                    type="tel"
                    className={`form-control ${errors.phone ? 'is-invalid' : ''}`}
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    placeholder="0912345678"
                  />
                  {errors.phone && <div className="invalid-feedback">{errors.phone}</div>}
                  <small className="text-muted d-block mt-1">
                    <i className="bi bi-phone me-1"></i>
                    OTP will be sent to this number via SMS.
                  </small>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Department</label>
                <input
                  type="text"
                  className="form-control"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  placeholder="Enter your department"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100 btn-lg"
                disabled={loading || emailValidation.valid === false}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Creating Account...
                  </>
                ) : (
                  <>
                    <i className="bi bi-person-plus me-2"></i>
                    Create Account
                  </>
                )}
              </button>
            </form>

            <div className="text-center mt-4">
              <p className="text-muted">
                Already have an account?{' '}
                <Link to="/login" className="fw-semibold text-primary">Login here</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;