import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from './NotificationBell';

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const dropdownRef = useRef(null);

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));

  // Close menus on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setDropdownOpen(false);
  }, [location.pathname]);

  // Lock scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  // Close dropdown on outside click / Escape
  useEffect(() => {
    const onClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsMobileMenuOpen(false);
  };

  // ✅ Only digital_officer and admin can MANAGE digital resources.
  // Librarians may only browse them (read-only via /digital).
  const canManageDigital =
    user?.role === 'digital_officer' || user?.role === 'admin';

  // ✅ Librarian + admin can manage books
  const canManageBooks =
    user?.role === 'librarian' || user?.role === 'admin';

  // ✅ Librarian + admin can manage users
  const canManageUsers =
    user?.role === 'librarian' || user?.role === 'admin';

  const navLinks = (
    <>
      <li className="nav-item">
        <Link className="nav-link" to="/books">Books</Link>
      </li>
      <li className="nav-item">
        <Link className="nav-link" to="/borrowings">My Borrowings</Link>
      </li>
      <li className="nav-item">
        <Link className="nav-link" to="/digital">Digital</Link>
      </li>

      {/* ✅ Manage Books — librarian + admin */}
      {canManageBooks && (
        <li className="nav-item">
          <Link className="nav-link" to="/books/manage">
            Manage Books
          </Link>
        </li>
      )}

      {/* ✅ Digital Management — digital_officer + admin only (NOT librarian) */}
      {canManageDigital && (
        <li className="nav-item">
          <Link className="nav-link" to="/digital-officer/dashboard">
            Digital Management
          </Link>
        </li>
      )}

      {/* ✅ Manage Users — librarian + admin */}
      {canManageUsers && (
        <li className="nav-item">
          <Link className="nav-link" to="/users">
            <i className="bi bi-people me-1"></i>
            {user?.role === 'admin' ? 'Users' : 'Manage Users'}
          </Link>
        </li>
      )}
    </>
  );

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow fixed-top app-navbar">
        <div className="container">
          <Link className="navbar-brand d-flex align-items-center" to="/">
            <span style={{ fontSize: '1.5rem' }}>📚</span>
            <span className="ms-2 fw-bold">AI Based Library</span>
          </Link>

          {/* Desktop menu */}
          <div className="d-none d-lg-flex flex-grow-1 align-items-center">
            {!isAuthenticated || !user ? (
              <ul className="navbar-nav ms-auto align-items-center">
                <li className="nav-item me-3">
                  <button
                    onClick={toggleTheme}
                    className="btn btn-outline-light btn-sm"
                  >
                    {theme === 'light' ? '🌙' : '☀️'}
                  </button>
                </li>
                <li className="nav-item me-2">
                  <Link to="/login" className="btn btn-outline-light">
                    Login
                  </Link>
                </li>
                <li className="nav-item">
                  <Link to="/register" className="btn btn-light">
                    Register
                  </Link>
                </li>
              </ul>
            ) : (
              <>
                <ul className="navbar-nav me-auto">{navLinks}</ul>

                <ul className="navbar-nav align-items-center">
                  <li className="nav-item me-3">
                    <button
                      onClick={toggleTheme}
                      className="btn btn-link text-white"
                      aria-label="Toggle theme"
                    >
                      {theme === 'light'
                        ? <i className="bi bi-moon-stars fs-5"></i>
                        : <i className="bi bi-sun fs-5"></i>}
                    </button>
                  </li>

                  {/* ✅ NotificationBell renders its own <li> — do NOT wrap it */}
                  <NotificationBell />

                  <li className="nav-item position-relative" ref={dropdownRef}>
                    <button
                      type="button"
                      className="btn btn-link text-white text-decoration-none d-flex align-items-center"
                      onClick={() => setDropdownOpen(o => !o)}
                      aria-haspopup="true"
                      aria-expanded={dropdownOpen}
                    >
                      <i
                        className="bi bi-person-circle me-2"
                        style={{ fontSize: '1.2rem' }}
                      ></i>
                      <span>{user?.first_name || user?.username}</span>
                    </button>
                    {dropdownOpen && (
                      <ul className="dropdown-menu dropdown-menu-end shadow show position-absolute end-0 mt-2">
                        <li>
                          <Link className="dropdown-item" to="/profile">
                            <i className="bi bi-person me-2"></i>Profile
                          </Link>
                        </li>
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
                    )}
                  </li>
                </ul>
              </>
            )}
          </div>

          {/* Hamburger */}
          <button
            className="navbar-toggler d-lg-none border-0"
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={isMobileMenuOpen}
          >
            <span className="navbar-toggler-icon"></span>
          </button>
        </div>
      </nav>

      {/* Full-screen mobile menu */}
      <div
        className={`mobile-overlay-menu ${isMobileMenuOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!isMobileMenuOpen}
      >
        <button
          className="mobile-close-btn"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Close menu"
        >
          <i className="bi bi-x-lg"></i>
        </button>

        <ul className="mobile-menu-links">
          {!isAuthenticated || !user ? (
            <>
              <li><Link to="/login">Login</Link></li>
              <li><Link to="/register">Register</Link></li>
              <li>
                <button onClick={toggleTheme} className="mobile-theme-btn">
                  {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
                </button>
              </li>
            </>
          ) : (
            <>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/books">Books</Link></li>
              <li><Link to="/borrowings">My Borrowings</Link></li>
              <li><Link to="/digital">Digital</Link></li>

              {/* ✅ Manage Books — librarian + admin */}
              {canManageBooks && (
                <li><Link to="/books/manage">Manage Books</Link></li>
              )}

              {/* ✅ Digital Management — digital_officer + admin only */}
              {canManageDigital && (
                <li>
                  <Link to="/digital-officer/dashboard">Digital Management</Link>
                </li>
              )}

              {/* ✅ Manage Users — librarian + admin */}
              {canManageUsers && (
                <li>
                  <Link to="/users">
                    {user?.role === 'admin' ? 'Users' : 'Manage Users'}
                  </Link>
                </li>
              )}

              <li><Link to="/profile">Profile</Link></li>
              <li>
                <button onClick={toggleTheme} className="mobile-theme-btn">
                  {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
                </button>
              </li>
              <li>
                <button onClick={handleLogout} className="mobile-logout-btn">
                  Logout
                </button>
              </li>
            </>
          )}
        </ul>
      </div>
    </>
  );
};

export default Navbar;