import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const AccountCreatedSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || sessionStorage.getItem('pending_verification_email') || '';
  const [countdown, setCountdown] = useState(5);

  // Countdown to redirect to login
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/login', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="row justify-content-center mt-5">
      <div className="col-md-7 col-lg-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="card shadow-lg border-0 rounded-4 overflow-hidden"
        >
          <div className="text-center text-white py-5"
               style={{ background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              style={{ fontSize: '5rem' }}
            >
              🎉
            </motion.div>
            <h1 className="fw-bold mt-3 mb-2" style={{ fontSize: '2rem' }}>
              Account Created Successfully!
            </h1>
            <p className="mb-0 opacity-90">Your email and phone have been verified</p>
          </div>

          <div className="card-body p-5 text-center">
            <div className="alert alert-success">
              <i className="bi bi-check-circle-fill me-2"></i>
              Your account is now active and ready to use.
            </div>

            <h5 className="fw-bold mb-3">✅ What's next?</h5>
            <p className="text-muted">
              You can now login with your username and password.
              <br />
              <small>You will not be asked to verify again.</small>
            </p>

            <div className="alert alert-warning d-flex justify-content-between align-items-center mt-4">
              <small>
                Redirecting to login in <strong>{countdown}</strong> second{countdown !== 1 ? 's' : ''}...
              </small>
              <button
                className="btn btn-sm btn-warning"
                onClick={() => navigate('/login', { replace: true })}
              >
                Login Now
              </button>
            </div>

            <div className="d-grid gap-2 mt-3">
              <Link to="/login" className="btn btn-primary btn-lg">
                <i className="bi bi-box-arrow-in-right me-2"></i>
                Go to Login
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AccountCreatedSuccess;