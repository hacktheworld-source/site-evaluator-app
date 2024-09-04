import React from 'react';

interface AuthProps {
  onSignInClick: () => void;
}

const Auth: React.FC<AuthProps> = ({ onSignInClick }) => {
  return (
    <button onClick={onSignInClick} className="sign-in-button">Sign In / Sign Up</button>
  );
};

export default Auth;