import React, { useState, useEffect, useRef } from 'react';
import WebsiteInput from './components/WebsiteInput';
import EvaluationResults from './components/EvaluationResults';
import Auth from './components/Auth';
import UserDashboard from './components/UserDashboard';
import { evaluateWebsite } from './services/evaluator';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './services/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { saveEvaluation, getUserPoints, decrementUserPoints } from './services/database';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const App: React.FC = () => {
  const [user, loading, authError] = useAuthState(auth);
  const [evaluationResults, setEvaluationResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');
  const [showSignInPopup, setShowSignInPopup] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (user && !isOffline) {
      getUserPoints(user.uid).then(points => {
        setUserPoints(points);
        console.log(`User points: ${points}`); // Add this line for debugging
      });
    }
  }, [user, isOffline]);

  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        // Any Firestore operations should be performed here
        console.log('Firebase initialized successfully');
      } catch (error) {
        console.error('Error initializing Firebase:', error);
      }
    };

    initializeFirebase();
  }, []);

  const handleError = (message: string) => {
    toast.error(message);
    setError(message);
  };

  const handleSignInRequired = () => {
    setShowSignInPopup(true);
  };

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      setShowSignInPopup(false);
    } catch (error) {
      console.error('Sign-in error:', error);
    }
  };

  const handleEvaluation = async (website: string) => {
    if (!user) {
      handleSignInRequired();
      return;
    }

    if (isOffline) {
      handleError('You are currently offline. Please check your internet connection and try again.');
      return;
    }

    if (userPoints === null || userPoints <= 0) {
      handleError('You need more points to evaluate a website.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await decrementUserPoints(user.uid);
      setUserPoints(prevPoints => (prevPoints !== null ? prevPoints - 1 : null));

      const results = await evaluateWebsite(website);
      setEvaluationResults(results);
      await saveEvaluation({
        userId: user.uid,
        websiteUrl: website,
        ...results,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error evaluating website:', error);
      setError('An error occurred while evaluating the website. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = (points: number) => {
    setUserPoints(prevPoints => (prevPoints !== null ? prevPoints + points : points));
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setCurrentPage('home');
      setShowUserMenu(false);
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <div className="main-content">
            <h1>Olive Site Evaluator</h1>
            <p className="app-description">Evaluate any website with just one click. Enter a URL below to get started.</p>
            <WebsiteInput 
              onSubmit={handleEvaluation} 
              isLoading={isLoading} 
              isLoggedIn={!!user}
              onSignInRequired={handleSignInRequired}
            />
            {isLoading && <p>Evaluating website...</p>}
            {error && <p className="error-message">{error}</p>}
            {evaluationResults && <EvaluationResults result={evaluationResults} />}
          </div>
        );
      case 'profile':
        return <div>User Profile Page (To be implemented)</div>;
      case 'points':
        return <div>Points Management Page (To be implemented)</div>;
      default:
        return <div>Page not found</div>;
    }
  };

  if (loading) return <div>Loading...</div>;
  if (authError) return <div>Error: {authError.message}</div>;

  return (
    <div className="App">
      {isOffline && <div className="error-message">You are currently offline. Some features may not work.</div>}
      <header className="app-header">
        <div className="app-icon" onClick={() => setCurrentPage('home')}>🫒</div>
        {user ? (
          <div className="user-menu-container" ref={userMenuRef}>
            <div 
              className="points-counter"
              onClick={() => { setCurrentPage('points'); setShowUserMenu(false); }}
            >
              {userPoints !== null ? `${userPoints} pts` : 'Loading...'}
            </div>
            <button className="user-menu-button" onClick={() => setShowUserMenu(!showUserMenu)}>
              <img src={user.photoURL || undefined} alt={user.displayName || 'User'} className="user-avatar" />
            </button>
            {showUserMenu && (
              <div className="user-menu-dropdown">
                <button onClick={() => { setCurrentPage('profile'); setShowUserMenu(false); }}>Profile</button>
                <button onClick={handleSignOut}>Sign Out</button>
              </div>
            )}
          </div>
        ) : (
          <Auth />
        )}
      </header>
      {currentPage === 'home' && user && (
        <button className="history-toggle" onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
          {isHistoryOpen ? '📁' : '📂'}
        </button>
      )}
      <div className="content-wrapper">
        <main className="main-content">
          {renderPage()}
        </main>
      </div>
      {user && isHistoryOpen && currentPage === 'home' && (
        <div className={`history-panel ${isHistoryOpen ? 'open' : ''}`}>
          <UserDashboard userId={user.uid} />
        </div>
      )}
      {showSignInPopup && (
        <div className="sign-in-popup">
          <div className="sign-in-popup-content">
            <h2>Sign In Required</h2>
            <p>Please sign in to evaluate websites.</p>
            <button onClick={handleSignIn}>Sign In with Google</button>
            <button onClick={() => setShowSignInPopup(false)}>Cancel</button>
          </div>
        </div>
      )}
      <ToastContainer position="top-right" autoClose={5000} />
    </div>
  );
};

export default App;