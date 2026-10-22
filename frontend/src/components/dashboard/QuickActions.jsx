import React from 'react';
import { Link } from 'react-router-dom';

const QuickActions = ({ userRole }) => {
  const actions = [
    {
      label: 'Search Books',
      icon: '🔍',
      color: 'primary',
      link: '/books',
      roles: ['student', 'academic_staff', 'librarian', 'admin']
    },
    {
      label: 'My Borrowings',
      icon: '📖',
      color: 'info',
      link: '/borrowings',
      roles: ['student', 'academic_staff']
    },
    {
      // label: 'Recommendations',
      icon: '🤖',
      color: 'success',
      // link: '/recommendations',
      roles: ['student', 'academic_staff']
    },
    {
      label: 'Digital Resources',
      icon: '💻',
      color: 'secondary',
      link: '/digital',
      roles: ['student', 'academic_staff', 'librarian', 'digital_officer']
    },
    {
      label: 'Manage Books',
      icon: '📚',
      color: 'warning',
      link: '/books/manage',
      roles: ['librarian', 'admin']
    },
    {
      label: 'Reports',
      icon: '📊',
      color: 'danger',
      link: '/reports',
      roles: ['librarian', 'admin']
    },
    {
      label: 'User Management',
      icon: '👥',
      color: 'dark',
      link: '/users',
      roles: ['admin']
    },
    {
      label: 'Notifications',
      icon: '🔔',
      color: 'light',
      link: '/notifications',
      roles: ['student', 'academic_staff', 'librarian', 'admin']
    },
  ];

  const availableActions = actions.filter(action => 
    action.roles.includes(userRole)
  );

  return (
    <div className="card shadow-sm">
      <div className="card-header bg-white">
        <h5 className="mb-0">⚡ Quick Actions</h5>
      </div>
      <div className="card-body">
        <div className="row g-2">
          {availableActions.map((action, index) => (
            <div key={index} className="col-6 col-md-4">
              <Link
                to={action.link}
                className={`btn btn-${action.color} w-100 text-start`}
              >
                <span className="me-2">{action.icon}</span>
                {action.label}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickActions;