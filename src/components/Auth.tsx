import React, { useEffect } from 'react';
import { auth } from '../services/firebase';
import { signInWithPopup, GoogleAuthProvider, User, signOut } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';

const Auth: React.FC = () => {
  const [user, loading, error] = useAuthState(auth);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'popup_closed') {
        console.log('Authentication popup was closed');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

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
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (user) {
    return (
      <div>
        <p>Welcome, {user.displayName}!</p>
        <button onClick={handleSignOut}>Sign Out</button>
      </div>
    );
  }

  return <button onClick={signIn}>Sign In with Google</button>;
};

export default Auth;