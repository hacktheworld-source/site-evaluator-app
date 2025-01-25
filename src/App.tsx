import React, { useState, useEffect, useRef } from 'react';
import WebsiteInput from './components/WebsiteInput';
import EvaluationResults from './components/EvaluationResults';
import Auth from './components/Auth';
import { evaluateWebsite } from './services/evaluator';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './services/firebase';
import { signOut } from 'firebase/auth';
import { getUserPoints, decrementUserPoints, updateUserPoints } from './services/points';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ProfilePage from './components/ProfilePage';
import PointsManagementPage from './components/PointsManagementPage';
import AuthModal from './components/AuthModal';
import defaultUserIcon from './assets/default-user-icon.png';
import { User } from 'firebase/auth';
import ChatInterface from './components/ChatInterface';
import AnimatedEye from './components/AnimatedEye';
import MetricsSearch from './components/MetricsSearch';

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
  const [rawInput, setRawInput] = useState<string>('');
  const [chatKey, setChatKey] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [analysisState, setAnalysisState] = useState<'pre' | 'post'>('pre');
  const [metricsSearchTerm, setMetricsSearchTerm] = useState<string>('');

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

  const handleEvaluation = async (website: string, rawInput?: string) => {
    setAnalysisState('post');
    setWebsiteUrl(website);
    if (rawInput) {
      setRawInput(rawInput);
    }
    
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
    setIsLoading(true);
    setError(null);
    setStatusMessage('Initializing evaluation process...');
    setEvaluationResults(null);
    setChatKey(prevKey => prevKey + 1);

    const cleanupAndRefund = async () => {
      setIsLoading(false);
      setIsGenerating(false);
      if (user) {
        try {
          await updateUserPoints(user.uid, (userPoints || 0) + 1);
          setUserPoints(prevPoints => (prevPoints !== null ? prevPoints + 1 : null));
        } catch (error) {
          console.error('Error refunding point:', error);
        }
      }
    };

    try {
      await decrementUserPoints(user.uid);
      setUserPoints(prevPoints => (prevPoints !== null ? prevPoints - 1 : null));

      const eventSource = new EventSource(
        `${process.env.REACT_APP_API_URL}/api/evaluate?url=${encodeURIComponent(website)}&userId=${encodeURIComponent(user.uid)}`
      );

      // Increased timeout to 2 minutes to match Lighthouse's typical analysis time
      let timeoutId = setTimeout(() => {
        eventSource.close();
        cleanupAndRefund();
        handleError('Website analysis timed out after 2 minutes. The website might be blocking automated access or is too slow to respond.');
      }, 120000);

      eventSource.onmessage = async (event) => {
        try {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            eventSource.close();
            cleanupAndRefund();
            handleError('Website analysis timed out waiting for the next update. The process might have stalled.');
          }, 120000);

          console.log('Received EventSource message:', event.data);
          const data = JSON.parse(event.data);
          console.log('Parsed server response:', data);

          if (data.status) {
            console.log('Status update:', data.status);
            setStatusMessage(data.status);
            
            // If we get a completion status, close the connection properly
            if (data.status === 'completed' && data.result) {
              console.log('Evaluation results received:', data.result);
              setEvaluationResults(data.result);
              setStatusMessage('Evaluation complete!');
              clearTimeout(timeoutId);
              eventSource.close();
              setIsLoading(false);
              setIsGenerating(false);
              setTimeout(() => setStatusMessage(''), 2000);
            }
          } else if (data.error) {
            console.error('Server reported error:', data.error);
            clearTimeout(timeoutId);
            eventSource.close();
            await cleanupAndRefund();
            handleError(data.error);
          } else {
            console.log('Received unknown message type:', data);
          }
        } catch (error) {
          console.error('Error processing message:', error, 'Raw event data:', event.data);
          clearTimeout(timeoutId);
          eventSource.close();
          await cleanupAndRefund();
          handleError(`Error processing evaluation data: ${error instanceof Error ? error.message : 'An unknown error occurred'}`);
        }
      };

      eventSource.onerror = async (error) => {
        console.error('EventSource error:', error);
        console.log('EventSource readyState:', eventSource.readyState, {
          CONNECTING: EventSource.CONNECTING,
          OPEN: EventSource.OPEN,
          CLOSED: EventSource.CLOSED
        });
        
        // Only handle errors if we haven't received results yet
        if (!evaluationResults) {
          if (eventSource.readyState === EventSource.CLOSED) {
            console.log('Connection closed without results - treating as error');
            clearTimeout(timeoutId);
            eventSource.close();
            await cleanupAndRefund();
            handleError('Lost connection to the evaluation server. Please try again.');
          } else if (eventSource.readyState === EventSource.CONNECTING) {
            // Connection is attempting to reconnect - log but don't take action yet
            console.log('EventSource is attempting to reconnect...');
          } else {
            console.error('EventSource in unexpected state:', eventSource.readyState);
            clearTimeout(timeoutId);
            eventSource.close();
            await cleanupAndRefund();
            handleError('Connection error. Please try again.');
          }
        } else {
          // We have results, so just close quietly
          console.log('Connection closed after receiving results - normal completion');
          eventSource.close();
          setIsLoading(false);
          setIsGenerating(false);
        }
      };

    } catch (error) {
      await cleanupAndRefund();
      handleError(`Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`);
      setStatusMessage('');
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

  const handleMetricsSearch = (term: string) => {
    setMetricsSearchTerm(term);
  };

  const scrollToElement = (element: HTMLElement) => {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <div className={`main-content ${analysisState}`}>
            <div className={`pre-analysis-content ${analysisState === 'post' ? 'fade-out' : ''}`}>
              <h1>Olive Site Evaluator</h1>
              <AnimatedEye 
                isGenerating={isGenerating} 
                isWaitingForResponse={isWaitingForResponse} 
              />
              <p className="app-description">Evaluate any website with just one click. Enter a URL below to get started.</p>
              <WebsiteInput 
                onSubmit={handleEvaluation} 
                isLoading={isLoading} 
                isLoggedIn={!!user}
                onSignInRequired={handleSignInRequired}
              />
              {error && <p className="error-message">{error}</p>}
            </div>
            
            <div className={`post-analysis-content ${analysisState === 'post' ? 'fade-in' : ''}`}>
              <div className={`analysis-layout ${evaluationResults ? 'has-results' : ''}`}>
                <div className="metrics-panel">
                  {evaluationResults && (
                    <>
                      <div className="metrics-header">
                        <h3>Analysis Results</h3>
                        <MetricsSearch 
                          onSearch={handleMetricsSearch}
                          onResultSelect={scrollToElement}
                        />
                      </div>
                      <div className="metrics-scrollable">
                        {evaluationResults.screenshot && (
                          <div className="screenshot-preview">
                            <img 
                              src={`data:image/png;base64,${evaluationResults.screenshot}`}
                              alt="Website Preview" 
                              className="preview-image"
                            />
                          </div>
                        )}
                        {Object.entries(evaluationResults).map(([key, value]) => {
                          if (key !== 'screenshot' && key !== 'htmlContent') {
                            const formattedValue = typeof value === 'object' 
                              ? JSON.stringify(value, null, 2)
                              : typeof value === 'number'
                              ? value < 1 && value > 0
                                ? `${(value * 100).toFixed(2)}%`
                                : value.toFixed(2)
                              : String(value);

                            return (
                              <div key={key} className="metric-box">
                                <h4>{key
                                  // First split by capital letters
                                  .replace(/([A-Z])/g, ' $1')
                                  // Convert to lowercase
                                  .toLowerCase()
                                  // Capitalize first letter of each word
                                  .split(' ')
                                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                  .join(' ')
                                  .trim()}</h4>
                                <div className="metric-value">
                                  <pre>{formattedValue}</pre>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </>
                  )}
                </div>
                <div className="analysis-main">
                  <div className="compact-header">
                    <AnimatedEye 
                      isGenerating={isGenerating}
                      isWaitingForResponse={isWaitingForResponse}
                      size="small"
                    />
                    <WebsiteInput 
                      onSubmit={handleEvaluation}
                      isLoading={isLoading}
                      isLoggedIn={!!user}
                      onSignInRequired={handleSignInRequired}
                      variant="compact"
                      initialUrl={websiteUrl}
                      initialRawInput={rawInput}
                    />
                  </div>
                  <div className="chat-container">
                    {websiteUrl && (
                      <ChatInterface
                        key={chatKey}
                        websiteUrl={websiteUrl}
                        onStartEvaluation={handleEvaluation}
                        evaluationResults={evaluationResults}
                        isLoading={isLoading}
                        statusMessage={statusMessage}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
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