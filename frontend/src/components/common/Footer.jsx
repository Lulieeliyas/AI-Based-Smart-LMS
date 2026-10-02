import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-light border-top mt-5 py-3">
      <div className="container">
        <div className="row">
          <div className="col-md-6 text-center text-md-start">
            <p className="mb-0 text-muted small">
              © {currentYear} AI-Based Smart Library Management System
            </p>
          </div>
          <div className="col-md-6 text-center text-md-end">
            <p className="mb-0 text-muted small">
              Built with ❤️ by Meseret, Eliyas & Hana
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;