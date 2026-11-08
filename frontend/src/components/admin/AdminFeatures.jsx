
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
const featureGroups = [
    {
        id: 'admin',
        title: 'System Administration',
        description: 'Manage system configuration and backups',
        icon: 'bi-gear-wide-connected',
        links: [
            {
                to: '/admin/backups',
                label: 'Backup Management',
                icon: 'bi-database-check',
            },
            {
                to: '/admin/settings',
                label: 'System Settings',
                icon: 'bi-sliders',
            },
            {
                to: '/admin/restores',
                label: 'Restore Management',
                icon: 'bi-arrow-counterclockwise',
            },
        ],
    },
    {
        id: 'audit',
        title: 'Auditing & Monitoring',
        description: 'Review system activity and performance',
        icon: 'bi-shield-check',
        links: [
            {
                to: '/admin/audit',
                label: 'Audit Logs',
                icon: 'bi-journal-text',
            },
            {
                to: '/admin/dashboard',
                label: 'System Statistics',
                icon: 'bi-bar-chart-line',
            },
        ],
    },
    {
        id: 'reports',
        title: 'Reports & Analytics',
        description: 'Explore library reports and insights',
        icon: 'bi-graph-up-arrow',
        links: [
            {
                to: '/reports',
                label: 'View Reports',
                icon: 'bi-file-earmark-bar-graph',
            },
        ],
    },
];

const AdminFeatures = () => {
    const [open, setOpen] = useState(null);

    const toggle = (section) => {
        setOpen((current) => current === section ? null : section);
    };

    return (
        <section className="admin-features-section">
            <div className="admin-section-heading">
                <div>
                    <h4>Administration Tools</h4>
                    <p>Access system management and monitoring features</p>
                </div>
            </div>

            <div className="admin-feature-grid">
                {featureGroups.map((group) => {
                    const isOpen = open === group.id;

                    return (
                        <article
                            className={`admin-feature-card ${
                                isOpen ? 'feature-open' : ''
                            }`}
                            key={group.id}
                        >
                            <button
                                type="button"
                                className="admin-feature-toggle"
                                onClick={() => toggle(group.id)}
                                aria-expanded={isOpen}
                                aria-controls={`feature-panel-${group.id}`}
                            >
                                <span className="admin-feature-icon">
                                    <i className={`bi ${group.icon}`} />
                                </span>

                                <span className="admin-feature-info">
                                    <strong>{group.title}</strong>
                                    <small>{group.description}</small>
                                </span>

                                <span className="admin-feature-chevron">
                                    <i className={`bi ${
                                        isOpen
                                            ? 'bi-chevron-up'
                                            : 'bi-chevron-down'
                                    }`} />
                                </span>
                            </button>

                            {isOpen && (
                                <div
                                    className="admin-feature-links"
                                    id={`feature-panel-${group.id}`}
                                >
                                    {group.links.map((link) => (
                                        <Link
                                            key={link.to}
                                            to={link.to}
                                            className="admin-feature-link"
                                        >
                                            <i className={`bi ${link.icon}`} />
                                            <span>{link.label}</span>
                                            <i className="bi bi-arrow-up-right ms-auto" />
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </article>
                    );
                })}
            </div>
        </section>
    );
};

export default AdminFeatures;
