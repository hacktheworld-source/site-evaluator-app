import React, { useState, useEffect, useRef } from 'react';
import WebsiteInput from './components/WebsiteInput';
import EvaluationResults from './components/EvaluationResults';
import Auth from './components/Auth';
import UserDashboard from './components/UserDashboard';
import { evaluateWebsite } from './services/evaluator';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './services/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { saveEvaluation, getUserPoints, decrementUserPoints, updateUserPoints } from './services/database';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Evaluation } from './services/database'; // Add this import
import ProfilePage from './components/ProfilePage';
import PointsManagementPage from './components/PointsManagementPage';
import AuthModal from './components/AuthModal';
import defaultUserIcon from './assets/default-user-icon.png'; // Change .svg to .png
import { User } from 'firebase/auth';
import ChatInterface from './components/ChatInterface';

const App: React.FC = () => {
  const [user, loading, authError] = useAuthState(auth);
  const [evaluationResults, setEvaluationResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const historyPanelRef = useRef<HTMLDivElement>(null);
  const [refreshHistory, setRefreshHistory] = useState(0);
  const [isDetailPopupOpen, setIsDetailPopupOpen] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState<{ show: boolean; action: () => void } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [websiteUrl, setWebsiteUrl] = useState<string>('');

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
      if (historyPanelRef.current && 
          !historyPanelRef.current.contains(event.target as Node) && 
          !(event.target as Element).closest('.history-toggle') &&
          !(event.target as Element).closest('.detail-popup-overlay') &&
          !(event.target as Element).closest('.confirm-dialog-overlay') &&
          isHistoryOpen) {
        setIsHistoryOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isHistoryOpen]);

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

    setWebsiteUrl(website);
    setIsLoading(true);
    setError(null);
    setStatusMessage('Initializing evaluation process...');
    setEvaluationResults(null);

    try {
      await decrementUserPoints(user.uid);
      setUserPoints(prevPoints => (prevPoints !== null ? prevPoints - 1 : null));

      const eventSource = new EventSource(`${process.env.REACT_APP_API_URL}/api/evaluate?url=${encodeURIComponent(website)}`);

      eventSource.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.status) {
          setStatusMessage(data.status);
        } else if (data.result) {
          // The result now contains only metrics, no AI analysis
          setEvaluationResults(data.result);
          eventSource.close();
          setIsLoading(false);
          setStatusMessage('Evaluation complete!');
          setTimeout(() => setStatusMessage(''), 2000);

          // Save the evaluation
          try {
            await saveEvaluation({
              userId: user.uid,
              websiteUrl: website,
              ...data.result,
              timestamp: new Date()
            });
            setRefreshHistory(prev => prev + 1);
          } catch (error) {
            console.error('Error saving evaluation:', error);
            toast.error('Failed to save evaluation history. Please try again.');
          }
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource failed:', error);
        eventSource.close();
        setIsLoading(false);
        setError('An error occurred while evaluating the website. Please try again.');
        setStatusMessage('');
      };
    } catch (error) {
      console.error('Error evaluating website:', error);
      setError('An error occurred while evaluating the website. Please try again.');
      setIsLoading(false);
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
      {currentPage === 'home' && user && (
        <button className="history-toggle" onClick={() => setIsHistoryOpen(!isHistoryOpen)}>
          {isHistoryOpen ? '📁' : '📂'}
        </button>
      )}
      <div className={`content-wrapper ${(isHistoryOpen || isDetailPopupOpen) ? 'blur' : ''}`}>
        <main className="main-content">
          {renderPage()}
        </main>
      </div>
      {user && (
        <div ref={historyPanelRef} className={`history-panel ${isHistoryOpen ? 'open' : ''}`}>
          <UserDashboard 
            userId={user.uid} 
            refreshTrigger={refreshHistory} 
            onDetailPopupOpen={(evaluation) => {
              setSelectedEvaluation(evaluation);
              setIsDetailPopupOpen(true);
            }}
            onConfirmDialogOpen={(action) => {
              setShowConfirmDialog({ 
                show: true, 
                action: () => {
                  action();
                  setShowConfirmDialog(null);
                }
              });
            }}
          />
        </div>
      )}
      {selectedEvaluation && (
        <div className="detail-popup-overlay">
          <div className="detail-popup">
            <button className="detail-popup-close" onClick={() => {
              setSelectedEvaluation(null);
              setIsDetailPopupOpen(false);
            }}>&times;</button>
            <div className="detail-popup-content">
              <h3>Detailed Evaluation for {selectedEvaluation.websiteUrl}</h3>
              <p>Overall Score: {selectedEvaluation.aiAnalysis?.overallScore ?? 'N/A'}</p>
              
              <h4>Performance Metrics:</h4>
              <ul>
                <li>Load Time: {selectedEvaluation.metrics?.loadTime?.toFixed(2) ?? 'N/A'} ms</li>
                <li>DOM Content Loaded: {selectedEvaluation.metrics?.domContentLoaded?.toFixed(2) ?? 'N/A'} ms</li>
                <li>First Paint: {selectedEvaluation.metrics?.firstPaint?.toFixed(2) ?? 'N/A'} ms</li>
                <li>First Contentful Paint: {selectedEvaluation.metrics?.firstContentfulPaint?.toFixed(2) ?? 'N/A'} ms</li>
                <li>Time to Interactive: {selectedEvaluation.metrics?.timeToInteractive?.toFixed(2) ?? 'N/A'} ms</li>
                <li>Largest Contentful Paint: {selectedEvaluation.metrics?.largestContentfulPaint?.toFixed(2) ?? 'N/A'} ms</li>
                <li>Cumulative Layout Shift: {selectedEvaluation.metrics?.cumulativeLayoutShift?.toFixed(4) ?? 'N/A'}</li>
              </ul>

              <h4>UI Analysis:</h4>
              <p>{selectedEvaluation.aiAnalysis?.uiAnalysis ?? 'N/A'}</p>

              <h4>Functionality Analysis:</h4>
              <p>{selectedEvaluation.aiAnalysis?.functionalityAnalysis ?? 'N/A'}</p>

              <h4>Recommendations:</h4>
              <ul>
                {selectedEvaluation.aiAnalysis?.recommendations?.map((rec, index) => (
                  <li key={index}>{rec}</li>
                )) ?? <li>No recommendations available</li>}
              </ul>

              <h4>Screenshot:</h4>
              {selectedEvaluation.screenshot && (
                <img src={`data:image/png;base64,${selectedEvaluation.screenshot}`} alt="Website Screenshot" style={{maxWidth: '100%'}} />
              )}
            </div>
          </div>
        </div>
      )}
      {showConfirmDialog && (
        <div className="confirm-dialog-overlay">
          <div className="confirm-dialog">
            <p>Are you sure you want to proceed?</p>
            <div className="confirm-dialog-actions">
              <button onClick={() => {
                showConfirmDialog.action();
                setShowConfirmDialog(null);
              }}>Yes</button>
              <button onClick={() => setShowConfirmDialog(null)}>No</button>
            </div>
          </div>
        </div>
      )}
      {showAuthModal && <AuthModal onClose={handleCloseAuthModal} />}
      <ToastContainer position="top-right" autoClose={5000} />
    </div>
  );
};

export default App;