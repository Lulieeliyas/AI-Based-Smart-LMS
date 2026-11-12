<<<<<<< HEAD

=======
>>>>>>> 3d92b850 (Implement librarian return inspection and fine management)
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from './NotificationBell';
import './Navbar.css';

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    setDropdownOpen(false);
    logout();
    navigate('/login');
  };

  // Logged-out navbar
  if (!isAuthenticated || !user) {
    return (
<<<<<<< HEAD
      <nav className="navbar navbar-dark shadow fixed-top app-navbar">
        <div className="container-fluid px-4">
          <Link
            className="navbar-brand d-flex align-items-center"
            to="/"
          >
            <span className="navbar-logo">📚</span>
            <span className="ms-2 fw-bold">AI Based Library</span>
          </Link>

          <div className="ms-auto d-flex align-items-center gap-2">
            <Link to="/login" className="btn btn-outline-light">
              Login
            </Link>
            <Link to="/register" className="btn btn-light">
              Register
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  // Logged-in navbar
  return (
    <nav className="navbar navbar-dark shadow fixed-top app-navbar">
      <div className="container-fluid px-4">

        {/* Brand */}
        <Link
          className="navbar-brand d-flex align-items-center"
          to="/"
        >
          <span className="navbar-logo">📚</span>
          <span className="ms-2 fw-bold">AI Based Library</span>
        </Link>

        {/* Only notification and profile on the right */}
        <div className="ms-auto d-flex align-items-center navbar-actions">

          {/* Notification bell */}
          <div className="navbar-notification">
            <NotificationBell />
          </div>

          {/* Profile dropdown */}
          <div className="nav-item dropdown navbar-profile">
            <button
              type="button"
              className="profile-button"
              aria-expanded={dropdownOpen}
              onClick={() => setDropdownOpen((previous) => !previous)}
            >
              <i className="bi bi-person-circle profile-icon"></i>
              <span className="profile-name">
                {user?.first_name || user?.username}
              </span>
              <i className="bi bi-chevron-down profile-chevron"></i>
            </button>

            {dropdownOpen && (
              <>
                <div
                  className="profile-dropdown-backdrop"
                  onClick={() => setDropdownOpen(false)}
                />

                <ul className="dropdown-menu dropdown-menu-end show profile-dropdown">
                  <li>
                    <Link
                      className="dropdown-item"
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <i className="bi bi-person me-2"></i>
                      Profile
                    </Link>
                  </li>

                  {(user?.role === 'digital_officer' ||
                    user?.role === 'admin' ||
                    user?.role === 'librarian') && (
                    <li>
                      <Link
                        className="dropdown-item"
                        to="/digital-officer/dashboard"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <i className="bi bi-cpu me-2"></i>
                        Digital & Devices Dashboard
                      </Link>
                    </li>
                  )}

                  <li>
                    <Link
                      className="dropdown-item"
                      to="/notifications"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <i className="bi bi-bell me-2"></i>
                      Notifications
                    </Link>
                  </li>

                  <li>
                    <Link
                      className="dropdown-item"
                      to="/change-password"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <i className="bi bi-key me-2"></i>
                      Change Password
                    </Link>
                  </li>

                  <li>
                    <hr className="dropdown-divider" />
                  </li>

                  <li>
                    <button
                      type="button"
                      className="dropdown-item text-danger"
                      onClick={handleLogout}
                    >
                      <i className="bi bi-box-arrow-right me-2"></i>
                      Logout
                    </button>
                  </li>
                </ul>
              </>
            )}
          </div>
        </div>
=======
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow fixed-top app-navbar">
        <div className="container">
          <Link className="navbar-brand d-flex align-items-center" to="/">
            <span style={{ fontSize: '1.5rem' }}>📚</span>
            <span className="ms-2 fw-bold">AI Based Library</span>
          </Link>
          <div className="ms-auto d-flex align-items-center gap-2">
            <Link to="/login" className="btn btn-outline-light">Login</Link>
            <Link to="/register" className="btn btn-light">Register</Link>
          </div>
        </div>
      </nav>
    );
  }

  // Logged-in navbar
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow fixed-top app-navbar">
      <div className="container">
        <Link className="navbar-brand d-flex align-items-center" to="/">
          <span style={{ fontSize: '1.5rem' }}>📚</span>
          <span className="ms-2 fw-bold">AI Based Library</span>
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <Link className="nav-link" to="/books">
                <i className="bi bi-book me-1"></i>Books
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/borrowings">
                <i className="bi bi-journal-bookmark me-1"></i>My Borrowings
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/digital">
                <i className="bi bi-cloud-arrow-down me-1"></i>Digital
              </Link>
            </li>
            {(user?.role === 'digital_officer' ||
              user?.role === 'admin' ||
              user?.role === 'librarian') && (
              <li className="nav-item">
                <Link className="nav-link" to="/digital-officer/dashboard">
                  <i className="bi bi-cpu me-1"></i>Digital Management
                </Link>
              </li>
            )}
            {user?.role === 'admin' && (
              <li className="nav-item">
                <Link className="nav-link" to="/users">
                  <i className="bi bi-people me-1"></i>Users
                </Link>
              </li>
            )}
          </ul>
          <ul className="navbar-nav align-items-center">
            <NotificationBell />
            <li className="nav-item dropdown">
              <button
                className="nav-link dropdown-toggle btn btn-link text-white text-decoration-none d-flex align-items-center"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <i
                  className="bi bi-person-circle me-1"
                  style={{ fontSize: '1.2rem' }}
                ></i>
                <span>{user?.first_name || user?.username}</span>
              </button>
              <ul
                className={`dropdown-menu dropdown-menu-end ${
                  dropdownOpen ? 'show' : ''
                }`}
              >
                <li>
                  <Link className="dropdown-item" to="/profile">
                    <i className="bi bi-person me-2"></i>Profile
                  </Link>
                </li>
                {(user?.role === 'digital_officer' ||
                  user?.role === 'admin' ||
                  user?.role === 'librarian') && (
                  <li>
                    <Link
                      className="dropdown-item"
                      to="/digital-officer/dashboard"
                    >
                      <i className="bi bi-cpu me-2"></i>Digital & Devices
                      Dashboard
                    </Link>
                  </li>
                )}
                <li>
                  <Link className="dropdown-item" to="/notifications">
                    <i className="bi bi-bell me-2"></i>Notifications
                  </Link>
                </li>
                <li>
                  <Link className="dropdown-item" to="/change-password">
                    <i className="bi bi-key me-2"></i>Change Password
                  </Link>
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li>
                  <button
                    className="dropdown-item text-danger"
                    onClick={handleLogout}
                  >
                    <i className="bi bi-box-arrow-right me-2"></i>Logout
                  </button>
                </li>
              </ul>
            </li>
          </ul>
        </div>
>>>>>>> 3d92b850 (Implement librarian return inspection and fine management)
      </div>
    </nav>
  );
};

export default Navbar;
