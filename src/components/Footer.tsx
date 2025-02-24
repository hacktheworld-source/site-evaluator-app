import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="app-footer">
      <div className="footer-links">
        <Link to="/terms-of-service">Terms of Service</Link>
        <Link to="/privacy-policy">Privacy Policy</Link>
      </div>
    </footer>
  );
};

export default Footer; 