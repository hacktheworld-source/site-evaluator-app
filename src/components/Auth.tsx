import React from 'react';
import { auth } from '../services/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';

const Auth: React.FC = () => {
  const [user, loading, error] = useAuthState(auth);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error('Sign-in error:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  if (loading) {
    return null;
  }

  if (error) {
    return <div className="auth-error">Error: {error.message}</div>;
  }

  if (user) {
    return (
      <div className="auth-container">
        <span className="user-greeting">Welcome, {user.displayName}!</span>
        <button onClick={handleSignOut} className="sign-out-button">Sign Out</button>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <button onClick={signIn} className="sign-in-button">Sign In with Google</button>
    </div>
  );
};

export default Auth;