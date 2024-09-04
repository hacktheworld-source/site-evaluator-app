import React, { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { signInWithPopup, GoogleAuthProvider, User, signOut } from 'firebase/auth';

const Auth: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen for messages from the popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data === 'popup_closed') {
        console.log('Authentication popup was closed');
        // Handle popup closure here (e.g., update UI, retry authentication)
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const signIn = async () => {
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      setUser(result.user);
    } catch (error) {
      console.error('Sign-in error:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Sign-out error:', error);
      setError(`Failed to sign out. Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

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