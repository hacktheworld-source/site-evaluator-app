import React, { useState } from 'react';
import { auth } from '../services/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  AuthError,
  AuthErrorCodes
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';

interface AuthModalProps {
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validatePassword = (password: string): boolean => {
    return password.length >= 6;
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const getErrorMessage = (error: unknown): string => {
    // First check if it's a Firebase Auth error
    if (error instanceof FirebaseError) {
      switch (error.code) {
        // Sign-in errors
        case 'auth/invalid-email':
          return 'Please enter a valid email address.';
        case 'auth/user-disabled':
          return 'This account has been disabled. Please contact support.';
        case 'auth/user-not-found':
          return 'Account not found. Please check your email or sign up.';
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          return 'Invalid email or password.';
        
        // Sign-up errors
        case 'auth/email-already-in-use':
          return 'This email is already registered. Please sign in instead.';
        case 'auth/weak-password':
          return 'Please choose a stronger password (at least 6 characters).';
        case 'auth/operation-not-allowed':
          return 'Email/password accounts are not enabled. Please contact support.';
        
        // Network errors
        case 'auth/network-request-failed':
          return 'Network error. Please check your internet connection.';
        
        // Too many attempts
        case 'auth/too-many-requests':
          return 'Too many attempts. Please try again later.';
        
        // Google Sign-in specific errors
        case 'auth/popup-closed-by-user':
          return 'Sign-in window was closed. Please try again.';
        case 'auth/popup-blocked':
          return 'Sign-in popup was blocked. Please allow popups and try again.';
        
        // Generic errors
        case 'auth/internal-error':
          return 'An internal error occurred. Please try again later.';
        
        default:
          console.error('Unhandled Firebase error:', error);
          return 'An unexpected error occurred. Please try again.';
      }
    }
    
    // If it's not a Firebase error, log it and return generic message
    console.error('Non-Firebase error during authentication:', error);
    return 'An unexpected error occurred. Please try again.';
  };

  const handleEmailPasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLoading) {
      console.log('Preventing double submission');
      return;
    }
    
    setError(null);
    const trimmedEmail = email.trim();

    // Debug info about the auth state and input
    console.log('Starting email/password auth...', {
      isSignUp,
      isInitialized: !!auth.currentUser,
      emailLength: trimmedEmail.length,
      passwordLength: password.length,
      authDomain: auth.config.authDomain,
      apiKey: auth.config.apiKey ? 'present' : 'missing'
    });

    if (!validateEmail(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!validatePassword(password)) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    
    try {
      if (isSignUp) {
        console.log('Attempting account creation...');
        const result = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        console.log('Account creation successful:', {
          email: result.user.email,
          uid: result.user.uid
        });

        // Initialize user document
        try {
          await fetch(`${process.env.REACT_APP_API_URL}/api/balance/${result.user.uid}`, {
            method: 'GET'  // This will trigger document creation if it doesn't exist
          });
        } catch (initError) {
          console.error('Error initializing user document:', initError);
          // Don't throw - the document will be created on next data fetch
        }

        toast.success('Account created successfully!');
      } else {
        console.log('Attempting sign in...');
        const result = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        console.log('Sign in successful:', {
          email: result.user.email,
          uid: result.user.uid
        });
      }
      onClose();
    } catch (error) {
      console.error('Authentication error:', {
        error,
        code: error instanceof FirebaseError ? error.code : 'non-firebase-error',
        message: error instanceof Error ? error.message : 'unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      const errorMessage = getErrorMessage(error);
      setError(errorMessage);
      
      if (error instanceof FirebaseError) {
        console.log('Firebase error details:', {
          code: error.code,
          customData: error.customData,
          name: error.name
        });
        
        if (error.code === 'auth/network-request-failed') {
          toast.error('Network error. Please check your connection.');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      
      // Debug info about the auth state and config
      console.log('Starting Google sign-in...', {
        isInitialized: !!auth.currentUser,
        authDomain: auth.config.authDomain,
        apiKey: auth.config.apiKey ? 'present' : 'missing'
      });

      // Add error event listener to window
      const errorHandler = (e: ErrorEvent) => {
        console.error('Window error during auth:', e.error);
      };
      window.addEventListener('error', errorHandler);

      try {
        const result = await signInWithPopup(auth, provider);
        console.log('Sign-in successful:', {
          email: result.user.email,
          providerId: result.providerId
        });
        onClose();
      } finally {
        window.removeEventListener('error', errorHandler);
      }
    } catch (error) {
      console.error('Google sign-in error:', {
        error,
        code: error instanceof FirebaseError ? error.code : 'non-firebase-error',
        message: error instanceof Error ? error.message : 'unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      const errorMessage = getErrorMessage(error);
      setError(errorMessage);
      
      if (error instanceof FirebaseError) {
        console.log('Firebase error details:', {
          code: error.code,
          customData: error.customData,
          name: error.name
        });
        
        switch (error.code) {
          case 'auth/popup-blocked':
            toast.error('Please allow popups for this site to sign in with Google');
            break;
          case 'auth/popup-closed-by-user':
            toast.info('Sign-in window was closed. Please try again.');
            break;
          case 'auth/cancelled-popup-request':
            toast.info('Previous sign-in attempt was interrupted. Please try again.');
            break;
          case 'auth/network-request-failed':
            toast.error('Network error. Please check your connection and try again.');
            break;
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalClick = (e: React.MouseEvent) => {
    // Only allow closing if not loading
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={handleModalClick}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        {!isLoading && (
          <button className="close-button" onClick={onClose}>&times;</button>
        )}
        <h2>{isSignUp ? 'Sign Up' : 'Sign In'}</h2>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleEmailPasswordAuth}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            disabled={isLoading}
            autoComplete={isSignUp ? 'new-email' : 'email'}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            disabled={isLoading}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
          />
          <button 
            type="submit" 
            className="royal-olive primary"
            disabled={isLoading}
          >
            {isLoading ? (
              <FontAwesomeIcon icon={faSpinner} spin />
            ) : (
              isSignUp ? 'Sign Up' : 'Sign In'
            )}
          </button>
        </form>
        <button 
          onClick={() => !isLoading && setIsSignUp(!isSignUp)} 
          className="toggle-auth-mode"
          disabled={isLoading}
        >
          {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
        </button>
        <div className="divider">
          <span>or</span>
        </div>
        <button 
          onClick={handleGoogleSignIn} 
          className="google-sign-in-button royal-olive secondary"
          disabled={isLoading}
        >
          {isLoading ? (
            <FontAwesomeIcon icon={faSpinner} spin />
          ) : (
            'Sign In with Google'
          )}
        </button>
      </div>
    </div>
  );
};

export default AuthModal;