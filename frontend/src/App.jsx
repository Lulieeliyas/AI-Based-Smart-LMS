import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuth } from './context/AuthContext';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import ProtectedRoute from './components/common/ProtectedRoute';
import RoleDashboard from './components/common/RoleDashboard';
import AdminSidebar from './components/common/AdminSidebar';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/Forgotpassword';
import ResetPasswordConfirm from './components/auth/ResetPasswordConfirm';
import VerifyEmail from './components/auth/VerifyEmail';
import ResetPasswordOTP from './components/auth/ResetPasswordOTP';
import AccountCreatedSuccess from './components/auth/AccountCreatedSuccess';
import Dashboard from './components/dashboard/Dashboard';
import StudentDashboard from './components/dashboard/StudentDashboard';
import LibrarianDashboard from './components/dashboard/LibrarianDashboard';
import DigitalOfficerDashboard from "./pages/digital-officer/DigitalOfficerDashboard";
import BookList from './components/books/BookList';
import BookDetails from './components/books/BookDetails';
import BookManagement from './components/books/BookManagement';
import BorrowHistory from './components/borrowing/BorrowHistory';
import AllBorrowings from './components/borrowing/AllBorrowings';
import FineManagement from './components/borrowing/FineManagement';
import Recommendations from './components/recommendations/Recommendations';
import DigitalResources from './components/digital/DigitalResources';
import Reports from './components/reports/Reports';
import PublicDashboard from './components/public/PublicDashboard';
import PublicBooks from './components/public/PublicBooks';
import PublicBookDetail from './components/public/PublicBookDetail';
import UserProfile from './components/users/UserProfile';
import UserManagement from './components/users/UserManagement';
import ChangePassword from './components/users/ChangePassword';
import Notifications from './components/notifications/Notifications';
import BackupManagement from './components/admin/BackupManagement';
import RestoreLogs from './components/admin/RestoreLogs';
import SystemSettings from './components/admin/SystemSettings';
import AuditLogs from './components/admin/AuditLogs';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css';

function App() {
    const { user, isAuthenticated } = useAuth();
    const [sidebarExpanded, setSidebarExpanded] = useState(false);
    const showSidebar = Boolean(isAuthenticated && user);
    const toggleSidebar = () => setSidebarExpanded(!sidebarExpanded);

    return (
        <>
            <div className="d-flex flex-column min-vh-100">
                <Navbar />
                <div className={`app-main-layout ${showSidebar ? 'has-sidebar' : ''} ${sidebarExpanded ? 'sidebar-expanded' : ''}`}>
                    {showSidebar && <AdminSidebar user={user} expanded={sidebarExpanded} onToggle={toggleSidebar} />}
                    <main className="container flex-grow-1 mt-4 app-main-content">
                        <Routes>
                            <Route path="/" element={<RoleDashboard />} />
                            <Route path="/public" element={<PublicDashboard />} />
                            <Route path="/public/books" element={<PublicBooks />} />
                            <Route path="/public/books/:id" element={<PublicBookDetail />} />
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            <Route path="/forgot-password" element={<ForgotPassword />} />
                            <Route path="/reset-password/:token" element={<ResetPasswordConfirm />} />
                            <Route path="/reset-password-otp" element={<ResetPasswordOTP />} />
                            <Route path="/verify-email" element={<VerifyEmail />} />
                            <Route path="/account-created" element={<AccountCreatedSuccess />} />
                            <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><Dashboard /></ProtectedRoute>} />
                            <Route path="/librarian/dashboard" element={<ProtectedRoute allowedRoles={['librarian', 'admin']}><LibrarianDashboard /></ProtectedRoute>} />
                            <Route path="/digital-officer/dashboard" element={<ProtectedRoute allowedRoles={['digital_officer', 'librarian', 'admin']}><DigitalOfficerDashboard /></ProtectedRoute>} />
                            <Route path="/staff/dashboard" element={<ProtectedRoute allowedRoles={['academic_staff', 'admin']}><Dashboard /></ProtectedRoute>} />
                            <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['student', 'guest', 'admin']}><StudentDashboard /></ProtectedRoute>} />
                            <Route path="/books/manage" element={<ProtectedRoute allowedRoles={['librarian', 'admin']}><BookManagement /></ProtectedRoute>} />
                            <Route path="/books" element={<ProtectedRoute><BookList /></ProtectedRoute>} />
                            <Route path="/books/:id" element={<ProtectedRoute><BookDetails /></ProtectedRoute>} />
                            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                            <Route path="/borrowings" element={<ProtectedRoute><BorrowHistory /></ProtectedRoute>} />
                            <Route path="/borrowings/all" element={<ProtectedRoute allowedRoles={['librarian', 'admin']}><AllBorrowings /></ProtectedRoute>} />
                            <Route path="/recommendations" element={<ProtectedRoute><Recommendations /></ProtectedRoute>} />
                            <Route path="/digital" element={<ProtectedRoute><DigitalResources /></ProtectedRoute>} />
                            <Route path="/reports" element={<ProtectedRoute allowedRoles={['librarian', 'admin']}><Reports /></ProtectedRoute>} />
                            <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                            <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
                            <Route path="/users" element={<ProtectedRoute allowedRoles={['admin', 'librarian']}><UserManagement /></ProtectedRoute>} />
                            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                            <Route path="/fines" element={<ProtectedRoute allowedRoles={['student', 'academic_staff', 'digital_officer', 'admin', 'librarian']}><FineManagement /></ProtectedRoute>} />
                            <Route path="/admin/backups" element={<Navigate to="/admin/backups/history" replace />} />
                            <Route path="/admin/backups/create" element={<ProtectedRoute allowedRoles={['admin']}><BackupManagement view="create" /></ProtectedRoute>} />
                            <Route path="/admin/backups/history" element={<ProtectedRoute allowedRoles={['admin']}><BackupManagement view="history" /></ProtectedRoute>} />
                            <Route path="/admin/restores" element={<ProtectedRoute allowedRoles={['admin']}><RestoreLogs /></ProtectedRoute>} />
                            <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin']}><SystemSettings /></ProtectedRoute>} />
                            <Route path="/admin/audit" element={<ProtectedRoute allowedRoles={['admin']}><AuditLogs /></ProtectedRoute>} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </main>
                </div>
                <Footer />
            </div>
            <ToastContainer position="top-right" autoClose={3000} />
        </>
    );
}
export default App;
