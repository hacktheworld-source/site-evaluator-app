import React, { useState, useEffect, useRef } from 'react';
import WebsiteInput from './components/WebsiteInput';
import EvaluationResults from './components/EvaluationResults';
import Auth from './components/Auth';
import { evaluateWebsite } from './services/evaluator';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './services/firebase';
import { signOut } from 'firebase/auth';
import { getUserPoints, decrementUserPoints, updateUserPoints } from './services/database';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ProfilePage from './components/ProfilePage';
import PointsManagementPage from './components/PointsManagementPage';
import AuthModal from './components/AuthModal';
import defaultUserIcon from './assets/default-user-icon.png';
import { User } from 'firebase/auth';
import ChatInterface from './components/ChatInterface';
import AnimatedEye from './components/AnimatedEye';

const App: React.FC = () => {
  const [user, loading, authError] = useAuthState(auth);
  const [evaluationResults, setEvaluationResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [websiteUrl, setWebsiteUrl] = useState<string>('');
  const [chatKey, setChatKey] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        if (user && !isOffline) {
          const points = await getUserPoints(user.uid);
          setUserPoints(points);
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        setError('An error occurred while initializing the app. Please try refreshing the page.');
      }
    };

    initializeApp();
  }, [user, isOffline]);

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

  const handleError = (message: string) => {
    toast.error(message);
    setError(message);
  };

  const handleEvaluation = async (website: string) => {
    if (!user) {
      handleError('You must be signed in to evaluate a website.');
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

    setIsGenerating(true);
    setWebsiteUrl(website);
    setIsLoading(true);
    setError(null);
    setStatusMessage('Initializing evaluation process...');
    setEvaluationResults(null);
    setChatKey(prevKey => prevKey + 1);

    try {
      await decrementUserPoints(user.uid);
      setUserPoints(prevPoints => (prevPoints !== null ? prevPoints - 1 : null));

      const eventSource = new EventSource(`${process.env.REACT_APP_API_URL}/api/evaluate?url=${encodeURIComponent(website)}`);

      eventSource.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.status) {
          setStatusMessage(data.status);
        } else if (data.result) {
          setEvaluationResults(data.result);
          eventSource.close();
          setIsLoading(false);
          setIsGenerating(false);
          setStatusMessage('Evaluation complete!');
          setTimeout(() => setStatusMessage(''), 2000);
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource failed:', error);
        eventSource.close();
        setIsLoading(false);
        setIsGenerating(false);
        setError('An error occurred while evaluating the website. Please try again.');
        setStatusMessage('');
      };
    } catch (error) {
      console.error('Error evaluating website:', error);
      setError('An error occurred while evaluating the website. Please try again.');
      setIsLoading(false);
      setIsGenerating(false);
      setStatusMessage('');
      // Refund the point if the evaluation failed
      await updateUserPoints(user.uid, (userPoints || 0) + 1);
      setUserPoints(prevPoints => (prevPoints !== null ? prevPoints + 1 : null));
    }
  };

  const handlePurchase = (points: number) => {
    setUserPoints(prevPoints => (prevPoints !== null ? prevPoints + points : points));
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      window.location.reload(); // Reload the page after signing out
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  const handleSignInClick = () => {
    setShowAuthModal(true);
  };

  const handleCloseAuthModal = () => {
    setShowAuthModal(false);
  };

  const handleSignInRequired = () => {
    setShowAuthModal(true);
  };

  const getProfilePicture = (user: User | null) => {
    if (!user) return defaultUserIcon;
    
    if (user.photoURL) {
      const highResURL = user.photoURL.replace('s96-c', 's400-c');
      return `${process.env.REACT_APP_API_URL}/api/proxy-image?url=${encodeURIComponent(highResURL)}`;
    }
    
    return defaultUserIcon;
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <div className="main-content">
            <h1>Olive Site Evaluator</h1>
            <AnimatedEye isGenerating={isGenerating} isWaitingForResponse={isWaitingForResponse} />
            <p className="app-description">Evaluate any website with just one click. Enter a URL below to get started.</p>
            <WebsiteInput 
              onSubmit={handleEvaluation} 
              isLoading={isLoading} 
              isLoggedIn={!!user}
              onSignInRequired={handleSignInRequired}
            />
            {statusMessage && <p className="status-message">{statusMessage}</p>}
            {error && <p className="error-message">{error}</p>}
            {websiteUrl && (
              <ChatInterface
                key={chatKey} // Add this line
                websiteUrl={websiteUrl}
                onStartEvaluation={handleEvaluation}
                evaluationResults={evaluationResults}
                isLoading={isLoading}
              />
            )}
          </div>
        );
      case 'profile':
        return <ProfilePage />;
      case 'points':
        return <PointsManagementPage />;
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
        <div className="app-title" onClick={() => setCurrentPage('home')}>Olive</div>
        {user ? (
          <div className="user-menu-container" ref={userMenuRef}>
            <div 
              className="points-counter"
              onClick={() => { setCurrentPage('points'); setShowUserMenu(false); }}
            >
              {userPoints !== null ? `${userPoints} pts` : 'Loading...'}
            </div>
            <button className="user-menu-button" onClick={() => setShowUserMenu(!showUserMenu)}>
              <img 
                src={getProfilePicture(user)}
                alt="User Avatar"
                className="user-avatar"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null; // Prevent infinite loop
                  target.src = defaultUserIcon;
                }}
              />
            </button>
            {showUserMenu && (
              <div className="user-menu-dropdown">
                <button onClick={() => { setCurrentPage('profile'); setShowUserMenu(false); }}>Profile</button>
                <button onClick={handleSignOut}>Sign Out</button>
              </div>
            )}
          </div>
        ) : (
          <button onClick={handleSignInClick} className="sign-in-button">Sign In / Sign Up</button>
        )}
      </header>
      <div className={`content-wrapper`}>
        <main className="main-content">
          {renderPage()}
        </main>
      </div>
      {showAuthModal && <AuthModal onClose={handleCloseAuthModal} />}
      <ToastContainer position="top-right" autoClose={5000} />
    </div>
  );
};

export default App;