
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import './AdminSidebar.css';

function AdminSidebar({ user, expanded, onToggle }) {
    const [openGroup, setOpenGroup] = useState(null);

    const role = user?.role;

    const dashboardPath = {
        admin: '/admin/dashboard',
        librarian: '/librarian/dashboard',
        student: '/student/dashboard',
        academic_staff: '/staff/dashboard',
        digital_officer: '/digital-officer/dashboard',
        guest: '/student/dashboard',
    }[role] || '/';

    const toggleGroup = (group) => {
    setOpenGroup((previous) =>
        previous === group ? null : group
    );
};

    const Item = ({ to, icon, children }) => (
    <NavLink
        to={to}
        end
        className={({ isActive }) =>
            `sidebar-link ${isActive ? 'active' : ''}`
        }
    >
        <i className={`bi ${icon}`}></i>
        <span>{children}</span>
    </NavLink>
);

    const Group = ({ id, icon, title, children }) => (
    <div className="sidebar-group">
        <button
            type="button"
            className={`sidebar-group-button ${
                openGroup === id ? 'group-open' : ''
            }`}
            onClick={() => toggleGroup(id)}
            aria-expanded={openGroup === id}
        >
            <i className={`bi ${icon}`} />
            <span>{title}</span>

            <i
                className={`bi ms-auto ${
                    openGroup === id
                        ? 'bi-chevron-up'
                        : 'bi-chevron-down'
                }`}
            />
        </button>

        {openGroup === id && (
            <div className="sidebar-submenu">
                {children}
            </div>
        )}
    </div>
);

    return (
        <>

            <aside
                className={`admin-sidebar ${
                    expanded ? 'expanded' : 'collapsed'
                }`}
            >
                {/* Menu button is always visible */}
                <div className="sidebar-header">
                    <button
                        type="button"
                        className="sidebar-toggle"
                        onClick={onToggle}
                        aria-label={
                            expanded ? 'Close navigation menu' : 'Open navigation menu'
                        }
                        title={
                            expanded ? 'Close menu' : 'Open menu'
                        }
                    >
                        <i
                            className={`bi ${
                                expanded ? 'bi-x-lg' : 'bi-list'
                            }`}
                        />
                    </button>

                    {expanded && (
                        <span className="sidebar-title">
                            NAVIGATION MENU
                        </span>
                    )}
                </div>

                {/* Do not display any navigation items while collapsed */}
                {expanded && (
                    <nav className="sidebar-navigation">

                        <div className="sidebar-section-title">
                            MAIN MENU
                        </div>

                        <Item to={dashboardPath} icon="bi-speedometer2">
                            Dashboard
                        </Item>

                        {/* Books */}
                        {(role === 'admin' || role === 'librarian') && (
                            <Group
                                id="books"
                                icon="bi-book"
                                title="Books"
                            >
                                <Item to="/books" icon="bi-list-ul">
                                    Browse Books
                                </Item>

                                <Item to="/books/manage" icon="bi-pencil-square">
                                    Manage Books
                                </Item>
                            </Group>
                        )}

                        {(role === 'student' ||
                          role === 'academic_staff' ||
                          role === 'guest' ||
                          role === 'digital_officer') && (
                            <Item to="/books" icon="bi-book">
                                Books
                            </Item>
                        )}

                        {/* Borrowings */}
                        {(role === 'student' ||
                          role === 'academic_staff' ||
                          role === 'librarian' ||
                          role === 'admin') && (
                            <Group
                                id="borrowing"
                                icon="bi-arrow-left-right"
                                title="Borrowings"
                            >
                                <Item to="/borrowings" icon="bi-clock-history">
                                    My Borrowings
                                </Item>

                                {(role === 'librarian' || role === 'admin') && (
                                    <Item
                                        to="/borrowings/all"
                                        icon="bi-collection"
                                    >
                                        All Borrowings
                                    </Item>
                                )}
                            </Group>
                        )}

                        {/* Recommendations */}
                        {role !== 'guest' && (
                            <Item to="/recommendations" icon="bi-stars">
                                Recommendations
                            </Item>
                        )}

                        {/* Digital Resources */}
                        <Item to="/digital" icon="bi-file-earmark-pdf">
                            Digital Resources
                        </Item>

                        {role === 'digital_officer' && (
                            <Item
                                to="/digital-officer/dashboard"
                                icon="bi-hdd-stack"
                            >
                                Digital Management
                            </Item>
                        )}

                        {/* Reports */}
                        {(role === 'admin' || role === 'librarian') && (
                            <Item to="/reports" icon="bi-bar-chart">
                                Reports
                            </Item>
                        )}

                        {/* Fines */}
                        {role !== 'guest' && (
                            <Item to="/fines" icon="bi-cash-coin">
                                Fine Management
                            </Item>
                        )}

                        {/* Users */}
                        {(role === 'admin' || role === 'librarian') && (
                            <Item to="/users" icon="bi-people">
                                Manage Users
                            </Item>
                        )}

                        {/* Admin-only features */}
                        {role === 'admin' && (
                            <>
                                <div className="sidebar-divider" />

                                <div className="sidebar-section-title">
                                    ADMINISTRATION
                                </div>

                                <Group
                                    id="backup"
                                    icon="bi-database"
                                    title="Backup & Restore"
                                >
                                    <Item
                                        to="/admin/backups/create"
                                        icon="bi-cloud-arrow-up"
                                    >
                                        Create Backup
                                    </Item>

                                    <Item
                                        to="/admin/backups/history"
                                        icon="bi-clock-history"
                                    >
                                        Backup History
                                    </Item>

                                    <Item
                                        to="/admin/restores"
                                        icon="bi-arrow-counterclockwise"
                                    >
                                        Restore History
                                    </Item>
                                </Group>

                                <Item to="/admin/settings" icon="bi-gear">
                                    System Settings
                                </Item>

                                <Item to="/admin/audit" icon="bi-journal-text">
                                    Audit Logs
                                </Item>
                            </>
                        )}

                        <div className="sidebar-divider" />

                        <div className="sidebar-section-title">
                            MY ACCOUNT
                        </div>

                        {role !== 'guest' && (
                            <>
                                <Item to="/notifications" icon="bi-bell">
                                    Notifications
                                </Item>

                                <Item to="/profile" icon="bi-person-circle">
                                    My Profile
                                </Item>

                                <Item to="/change-password" icon="bi-shield-lock">
                                    Change Password
                                </Item>
                            </>
                        )}

                        <div className="sidebar-user">
                            <i className="bi bi-person-badge" />
                            <span>
                                {role?.replace('_', ' ').toUpperCase()}
                            </span>
                        </div>

                    </nav>
                )}
            </aside>
        </>
    );
}

export default AdminSidebar;
