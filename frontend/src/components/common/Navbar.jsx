import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import NotificationBell from './NotificationBell';
import './Navbar.css';

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const dropdownRef = useRef(null);

  const loggedIn = Boolean(isAuthenticated && user);

  const handleLogout = () => {
    setDropdownOpen(false);
    setMobileOpen(false);
    logout();
    navigate('/login');
  };

  // Close menus on route change
  useEffect(() => {
    setDropdownOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const ThemeToggle = () => (
    <button
      type="button"
      className="theme-toggle-btn"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <i className={`bi ${theme === 'light' ? 'bi-moon-stars-fill' : 'bi-sun-fill'}`} />
    </button>
  );

  const isStaff =
    user?.role === 'digital_officer' ||
    user?.role === 'admin' ||
    user?.role === 'librarian';

  /* ================= LOGGED OUT ================= */
  if (!loggedIn) {
    return (
      <nav className="app-navbar">
        <div className="navbar-inner container">
          <Link className="navbar-brand" to="/">
            <span className="navbar-logo">📚</span>
            <span className="brand-text">AI Based Library</span>
          </Link>

          {/* Mobile Actions (Theme + Hamburger) */}
          <div className="navbar-mobile-actions">
            <ThemeToggle />
            <button
              className="mobile-toggle"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <i className={`bi ${mobileOpen ? 'bi-x-lg' : 'bi-list'}`} />
            </button>
          </div>

          {/* Menu (Desktop inline, Mobile dropdown) */}
          <div className={`navbar-menu ${mobileOpen ? 'open' : ''}`}>
            {/* Desktop actions (visible on large screens) */}
            <div className="navbar-actions d-none d-lg-flex">
              <ThemeToggle />
              <Link to="/login" className="btn btn-outline-light btn-sm">
                Login
              </Link>
              <Link to="/register" className="btn btn-light btn-sm">
                Register
              </Link>
            </div>

            {/* Mobile actions inside the dropdown */}
            <div className="navbar-mobile-user d-flex d-lg-none">
              <Link to="/login" className="nav-mobile-link">
                <i className="bi bi-box-arrow-in-right me-2" /> Login
              </Link>
              <Link to="/register" className="nav-mobile-link">
                <i className="bi bi-person-plus me-2" /> Register
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  /* ================= LOGGED IN ================= */
  return (
    <nav className="app-navbar">
      <div className="navbar-inner container">
        <Link className="navbar-brand" to="/">
          <span className="navbar-logo">📚</span>
          <span className="brand-text">AI Based Library</span>
        </Link>

        {/* Mobile Actions (Theme + Hamburger) */}
        <div className="navbar-mobile-actions">
          <ThemeToggle />
          <button
            className="mobile-toggle"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <i className={`bi ${mobileOpen ? 'bi-x-lg' : 'bi-list'}`} />
          </button>
        </div>

        {/* Menu (Desktop inline, Mobile dropdown) */}
        <div className={`navbar-menu ${mobileOpen ? 'open' : ''}`}>
          <ul className="navbar-links">
            <li><Link to="/books">Books</Link></li>
            <li><Link to="/borrowings">My Borrowings</Link></li>
            <li><Link to="/digital">Digital</Link></li>
            {isStaff && (
              <li><Link to="/digital-officer/dashboard">Digital Management</Link></li>
            )}
            {user?.role === 'admin' && (
              <li>
                <Link to="/users">
                  <i className="bi bi-people me-1" />Users
                </Link>
              </li>
            )}
          </ul>

          {/* Mobile-only user block */}
          <div className="navbar-mobile-user">
            <div className="mobile-user-header">
              <i className="bi bi-person-circle me-2" />
              <span>{user?.first_name || user?.username}</span>
            </div>
            <Link to="/profile">
              <i className="bi bi-person me-2" />Profile
            </Link>
            <Link to="/notifications">
              <i className="bi bi-bell me-2" />Notifications
            </Link>
            <Link to="/change-password">
              <i className="bi bi-key me-2" />Change Password
            </Link>
            <button className="logout-btn" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right me-2" />Logout
            </button>
          </div>

          {/* Desktop right side */}
          <ul className="navbar-right">
            <li className="d-none d-lg-flex">
              <ThemeToggle />
            </li>
            <li><NotificationBell /></li>
            <li className="profile-wrapper" ref={dropdownRef}>
              <button
                className="profile-button"
                onClick={() => setDropdownOpen((v) => !v)}
                aria-expanded={dropdownOpen}
              >
                <i className="bi bi-person-circle profile-icon" />
                <span className="profile-name">
                  {user?.first_name || user?.username}
                </span>
                <i className={`bi bi-chevron-down profile-chevron ${dropdownOpen ? 'up' : ''}`} />
              </button>

              {dropdownOpen && (
                <ul className="profile-dropdown">
                  <li>
                    <Link className="dropdown-item" to="/profile">
                      <i className="bi bi-person me-2" />Profile
                    </Link>
                  </li>
                  {isStaff && (
                    <li>
                      <Link className="dropdown-item" to="/digital-officer/dashboard">
                        <i className="bi bi-cpu me-2" />Digital & Devices Dashboard
                      </Link>
                    </li>
                  )}
                  <li>
                    <Link className="dropdown-item" to="/notifications">
                      <i className="bi bi-bell me-2" />Notifications
                    </Link>
                  </li>
                  <li>
                    <Link className="dropdown-item" to="/change-password">
                      <i className="bi bi-key me-2" />Change Password
                    </Link>
                  </li>
                  <li><hr className="dropdown-divider" /></li>
                  <li>
                    <button className="dropdown-item text-danger" onClick={handleLogout}>
                      <i className="bi bi-box-arrow-right me-2" />Logout
                    </button>
                  </li>
                </ul>
              )}
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;