
import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Authentication context
import { useAuth } from './context/AuthContext';

// Common Components
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import ProtectedRoute from './components/common/ProtectedRoute';
import RoleDashboard from './components/common/RoleDashboard';
import AdminSidebar from './components/common/AdminSidebar';

// Authentication Pages
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/Forgotpassword';
import ResetPasswordConfirm from './components/auth/ResetPasswordConfirm';
import VerifyEmail from './components/auth/VerifyEmail';
import ResetPasswordOTP from './components/auth/ResetPasswordOTP';
import AccountCreatedSuccess from './components/auth/AccountCreatedSuccess';

// Dashboards
import Dashboard from './components/dashboard/Dashboard';
import StudentDashboard from './components/dashboard/StudentDashboard';
import LibrarianDashboard from './components/dashboard/LibrarianDashboard';
import DigitalOfficerDashboard from './pages/digital-officer/DigitalOfficerDashboard';

// Books
import BookList from './components/books/BookList';
import BookDetails from './components/books/BookDetails';
import BookManagement from './components/books/BookManagement';

// Borrowing
import BorrowHistory from './components/borrowing/BorrowHistory';
import AllBorrowings from './components/borrowing/AllBorrowings';

// Recommendations
import Recommendations from './components/recommendations/Recommendations';

// Digital Resources
import DigitalResources from './components/digital/DigitalResources';

// Reports
import Reports from './components/reports/Reports';

// Public Pages
import PublicDashboard from './components/public/PublicDashboard';
import PublicBooks from './components/public/PublicBooks';
import PublicBookDetail from './components/public/PublicBookDetail';

// Users
import UserProfile from './components/users/UserProfile';
import UserManagement from './components/users/UserManagement';
import ChangePassword from './components/users/ChangePassword';

// Notifications
import Notifications from './components/notifications/Notifications';

// Fine Management
import FineManagement from './components/fines/FineManagement';

// Admin Features
import BackupManagement from './components/admin/BackupManagement';
import RestoreLogs from './components/admin/RestoreLogs';
import SystemSettings from './components/admin/SystemSettings';
import AuditLogs from './components/admin/AuditLogs';

// Styles
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css';


function App() {
    const { user, isAuthenticated } = useAuth();

    // Sidebar state
    const [sidebarExpanded, setSidebarExpanded] = useState(false);

    // Display sidebar for authenticated users
    const showSidebar = Boolean(isAuthenticated && user);

    // Toggle sidebar
    const toggleSidebar = () => {
        setSidebarExpanded((previousState) => !previousState);
    };

    return (
        <>
            <div className="d-flex flex-column min-vh-100">

                {/* Top Navigation */}
                <Navbar />

                {/* Main Application Layout */}
                <div
    className={`app-main-layout ${
        showSidebar ? 'has-sidebar' : ''
    } ${sidebarExpanded ? 'sidebar-expanded' : ''}`}
>

                    {/* Left Navigation Sidebar */}
                    {showSidebar && (
                        <AdminSidebar
                            user={user}
                            expanded={sidebarExpanded}
                            onToggle={toggleSidebar}
                        />
                    )}

                    {/* Main Content */}
                    <main className="container flex-grow-1 mt-4 app-main-content">

                        <Routes>

                            {/* =====================================
                                PUBLIC PAGES
                            ===================================== */}

                            <Route
                                path="/"
                                element={<RoleDashboard />}
                            />

                            <Route
                                path="/public"
                                element={<PublicDashboard />}
                            />

                            <Route
                                path="/public/books"
                                element={<PublicBooks />}
                            />

                            <Route
                                path="/public/books/:id"
                                element={<PublicBookDetail />}
                            />


                            {/* =====================================
                                AUTHENTICATION
                            ===================================== */}

                            <Route
                                path="/login"
                                element={<Login />}
                            />

                            <Route
                                path="/register"
                                element={<Register />}
                            />

                            <Route
                                path="/forgot-password"
                                element={<ForgotPassword />}
                            />

                            <Route
                                path="/reset-password/:token"
                                element={<ResetPasswordConfirm />}
                            />

                            <Route
                                path="/reset-password-otp"
                                element={<ResetPasswordOTP />}
                            />

                            <Route
                                path="/verify-email"
                                element={<VerifyEmail />}
                            />

                            <Route
                                path="/account-created"
                                element={<AccountCreatedSuccess />}
                            />


                            {/* =====================================
                                ROLE-SPECIFIC DASHBOARDS
                            ===================================== */}

                            {/* Admin Dashboard */}
                            <Route
                                path="/admin/dashboard"
                                element={
                                    <ProtectedRoute allowedRoles={['admin']}>
                                        <Dashboard />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Librarian Dashboard */}
                            <Route
                                path="/librarian/dashboard"
                                element={
                                    <ProtectedRoute
                                        allowedRoles={['librarian', 'admin']}
                                    >
                                        <LibrarianDashboard />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Digital Officer Dashboard */}
                            <Route
                                path="/digital-officer/dashboard"
                                element={
                                    <ProtectedRoute
                                        allowedRoles={['digital_officer']}
                                    >
                                        <DigitalOfficerDashboard />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Academic Staff Dashboard */}
                            <Route
                                path="/staff/dashboard"
                                element={
                                    <ProtectedRoute
                                        allowedRoles={['academic_staff', 'admin']}
                                    >
                                        <Dashboard />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Student Dashboard */}
                            <Route
                                path="/student/dashboard"
                                element={
                                    <ProtectedRoute
                                        allowedRoles={['student', 'guest', 'admin']}
                                    >
                                        <StudentDashboard />
                                    </ProtectedRoute>
                                }
                            />


                            {/* =====================================
                                BOOK MANAGEMENT
                            ===================================== */}

                            <Route
                                path="/books/manage"
                                element={
                                    <ProtectedRoute
                                        allowedRoles={['librarian', 'admin']}
                                    >
                                        <BookManagement />
                                    </ProtectedRoute>
                                }
                            />

                            <Route
                                path="/books"
                                element={
                                    <ProtectedRoute>
                                        <BookList />
                                    </ProtectedRoute>
                                }
                            />

                            <Route
                                path="/books/:id"
                                element={
                                    <ProtectedRoute>
                                        <BookDetails />
                                    </ProtectedRoute>
                                }
                            />


                            {/* =====================================
                                SHARED PROTECTED ROUTES
                            ===================================== */}

                            <Route
                                path="/dashboard"
                                element={
                                    <ProtectedRoute>
                                        <Dashboard />
                                    </ProtectedRoute>
                                }
                            />

                            {/* My Borrowings */}
                            <Route
                                path="/borrowings"
                                element={
                                    <ProtectedRoute>
                                        <BorrowHistory />
                                    </ProtectedRoute>
                                }
                            />

                            {/* All Borrowings */}
                            <Route
                                path="/borrowings/all"
                                element={
                                    <ProtectedRoute
                                        allowedRoles={['librarian', 'admin']}
                                    >
                                        <AllBorrowings />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Recommendations */}
                            <Route
                                path="/recommendations"
                                element={
                                    <ProtectedRoute>
                                        <Recommendations />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Digital Resources */}
                            <Route
                                path="/digital"
                                element={
                                    <ProtectedRoute>
                                        <DigitalResources />
                                    </ProtectedRoute>
                                }
                            />


                            {/* =====================================
                                REPORTS
                            ===================================== */}

                            <Route
                                path="/reports"
                                element={
                                    <ProtectedRoute
                                        allowedRoles={['librarian', 'admin']}
                                    >
                                        <Reports />
                                    </ProtectedRoute>
                                }
                            />


                            {/* =====================================
                                USER MANAGEMENT
                            ===================================== */}

                            <Route
                                path="/profile"
                                element={
                                    <ProtectedRoute>
                                        <UserProfile />
                                    </ProtectedRoute>
                                }
                            />

                            <Route
                                path="/change-password"
                                element={
                                    <ProtectedRoute>
                                        <ChangePassword />
                                    </ProtectedRoute>
                                }
                            />

                            <Route
                                path="/users"
                                element={
                                    <ProtectedRoute
                                        allowedRoles={['admin', 'librarian']}
                                    >
                                        <UserManagement />
                                    </ProtectedRoute>
                                }
                            />


                            {/* =====================================
                                NOTIFICATIONS
                            ===================================== */}

                            <Route
                                path="/notifications"
                                element={
                                    <ProtectedRoute>
                                        <Notifications />
                                    </ProtectedRoute>
                                }
                            />


                            {/* =====================================
                                FINE MANAGEMENT
                            ===================================== */}

                            <Route
                                path="/fines"
                                element={
                                    <ProtectedRoute
                                        allowedRoles={[
                                            'student',
                                            'academic_staff',
                                            'digital_officer',
                                            'admin',
                                            'librarian',
                                        ]}
                                    >
                                        <FineManagement />
                                    </ProtectedRoute>
                                }
                            />


                            {/* =====================================
                                ADMIN BACKUP FEATURES
                            ===================================== */}

                            {/* Redirect old backup URL */}
                            <Route
                                path="/admin/backups"
                                element={
                                    <Navigate
                                        to="/admin/backups/history"
                                        replace
                                    />
                                }
                            />

                            {/* Create Backup - separate page */}
                            <Route
                                path="/admin/backups/create"
                                element={
                                    <ProtectedRoute allowedRoles={['admin']}>
                                        <BackupManagement view="create" />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Backup History - separate page */}
                            <Route
                                path="/admin/backups/history"
                                element={
                                    <ProtectedRoute allowedRoles={['admin']}>
                                        <BackupManagement view="history" />
                                    </ProtectedRoute>
                                }
                            />

                            {/* Restore History */}
                            <Route
                                path="/admin/restores"
                                element={
                                    <ProtectedRoute allowedRoles={['admin']}>
                                        <RestoreLogs />
                                    </ProtectedRoute>
                                }
                            />


                            {/* =====================================
                                SYSTEM MANAGEMENT
                            ===================================== */}

                            <Route
                                path="/admin/settings"
                                element={
                                    <ProtectedRoute allowedRoles={['admin']}>
                                        <SystemSettings />
                                    </ProtectedRoute>
                                }
                            />

                            <Route
                                path="/admin/audit"
                                element={
                                    <ProtectedRoute allowedRoles={['admin']}>
                                        <AuditLogs />
                                    </ProtectedRoute>
                                }
                            />


                            {/* =====================================
                                404
                            ===================================== */}

                            <Route
                                path="*"
                                element={<Navigate to="/" replace />}
                            />

                        </Routes>

                    </main>
                </div>

                {/* Footer */}
                <Footer />

            </div>

            {/* Toast Notifications */}
            <ToastContainer
                position="top-right"
                autoClose={3000}
            />
        </>
    );
}

export default App;