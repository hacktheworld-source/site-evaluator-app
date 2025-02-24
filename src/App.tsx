import React, { useState, useEffect, useRef } from 'react';
import WebsiteInput from './components/WebsiteInput';
import EvaluationResults from './components/EvaluationResults';
import Auth from './components/Auth';
import { evaluateWebsite } from './services/evaluator';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './services/firebase';
import { signOut } from 'firebase/auth';
import { getUserBalance, decrementUserBalance, SERVICE_COSTS, checkCreditsAndShowError } from './services/points';
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
import PaymentSuccessPage from './components/PaymentSuccessPage';
import PaymentMethodSuccess from './components/PaymentMethodSuccess';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { paymentService, UserData } from './services/paymentService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faDollarSign, faCreditCard } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import { db } from './services/firebase';
import { getFirestore, collection, doc, onSnapshot, DocumentSnapshot, updateDoc } from 'firebase/firestore';
import { Message } from './components/ChatInterface';
import Footer from './components/Footer';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';

console.log('App loaded');

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

// Add this new Error Boundary component
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: 'white' }}>
          <h1>Something went wrong.</h1>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

// Add this new component
const LegalLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  
  const handleHomeClick = () => {
    navigate('/');
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="app-title" onClick={handleHomeClick}>
          <h1>Olive</h1>
        </div>
      </header>
      {children}
      <Footer />
    </div>
  );
};

const AppContent: React.FC = () => {
  const [user, loading, authError] = useAuthState(auth);
  const [evaluationResults, setEvaluationResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [websiteUrl, setWebsiteUrl] = useState<string>('');
  const [rawInput, setRawInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [analysisState, setAnalysisState] = useState<'pre' | 'post'>('pre');
  const [metricsSearchTerm, setMetricsSearchTerm] = useState<string>('');
  const [isPayAsYouGo, setIsPayAsYouGo] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const navigate = useNavigate();

  // Add chat state
  const [chatState, setChatState] = useState<{
    messages: Message[];
    currentPhase: string | null;
    phaseScores: { [key: string]: number };
    overallScore: number | null;
    userInput: string;
    isThinking: boolean;
  }>({
    messages: [],
    currentPhase: null,
    phaseScores: {},
    overallScore: null,
    userInput: '',
    isThinking: false
  });

  useEffect(() => {
    console.log('App component mounted');
    
    const initializeApp = async () => {
      if (user) {
        try {
          const [balance, userData] = await Promise.all([
            getUserBalance(user.uid),
            paymentService.getUserData(user.uid)
          ]);
          setUserPoints(balance);
          setIsPayAsYouGo(!!(userData?.stripeCustomerId && userData?.hasAddedPayment));
        } catch (error) {
          console.error('Error initializing app:', error);
          handleError('Failed to load user data');
        }
      } else {
        // Reset points when user logs out
        setUserPoints(null);
        setIsPayAsYouGo(false);
      }
    };

    if (!loading) {
      initializeApp();
    }

    // Add event listener for payment status changes
    const handlePaymentStatusChange = () => {
      console.log('Payment status change detected, refreshing app data');
      initializeApp();
    };

    window.addEventListener('paymentStatusChanged', handlePaymentStatusChange);

    return () => {
      console.log('App component unmounting', {
        auth: !!auth,
        user: !!user,
        loading,
        error
      });
      window.removeEventListener('paymentStatusChanged', handlePaymentStatusChange);
    };
  }, [user, loading]);

  useEffect(() => {
    console.log('Auth state changed:', { user, loading, error });
  }, [user, loading, error]);

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
    if (!user) return;

    // Check if we're returning from Stripe portal
    const returnPath = localStorage.getItem('returnPath');
    if (returnPath === window.location.pathname) {
      localStorage.removeItem('returnPath');
      // Check payment status and unenroll if no payment methods remain
      paymentService.checkPaymentMethodStatus(user.uid)
        .then(hasPaymentMethod => {
          if (!hasPaymentMethod) {
            // If we don't have any payment methods, update Firestore
            const userRef = doc(db, 'users', user.uid);
            updateDoc(userRef, {
              hasAddedPayment: false,
              isPayAsYouGo: false
            })
              .then(() => {
                toast.info('Payment method removed. Unenrolled from pay-as-you-go.');
              })
              .catch((error: Error) => {
                console.error('Error updating payment status:', error);
                toast.error('Failed to update payment status');
              });
          }
        })
        .catch(error => {
          console.error('Error checking payment status:', error);
          toast.error('Failed to verify payment status');
        });
    }

    // Set up real-time listener for user data
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setUserData({
            balance: data.balance || 0,
            isPayAsYouGo: !!(data.stripeCustomerId && data.hasAddedPayment),
            hasAddedPayment: data.hasAddedPayment || false
          });
          // Dispatch event for components that need to know about payment status changes
          window.dispatchEvent(new CustomEvent('userDataUpdated', { 
            detail: { 
              hasAddedPayment: data.hasAddedPayment || false,
              isPayAsYouGo: !!(data.stripeCustomerId && data.hasAddedPayment),
              balance: data.balance || 0
            }
          }));
        }
      },
      (error) => {
        console.error('Error in Firestore listener:', error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Check for Stripe portal return anywhere in the app
  useEffect(() => {
    const returnPath = localStorage.getItem('returnPath');
    if (returnPath && user) {
      localStorage.removeItem('returnPath');
      
      const verifyPaymentStatus = async () => {
        try {
          const hasPaymentMethod = await paymentService.checkPaymentMethodStatus(user.uid);
          if (hasPaymentMethod) {
            toast.success('Payment method successfully added!');
          }
        } catch (error) {
          console.error('Error checking payment status:', error);
          toast.error('Failed to verify payment status');
        }
      };

      verifyPaymentStatus();
    }
  }, [user]);

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

    // Reset chat state for new evaluation
    setChatState({
      messages: [],
      currentPhase: null,
      phaseScores: {},
      overallScore: null,
      userInput: '',
      isThinking: false
    });

    if (!user) {
      handleError('You must be signed in to evaluate a website.');
      return;
    }

    if (isOffline) {
      handleError('You are currently offline. Please check your internet connection and try again.');
      return;
    }

    // Define cleanup function outside the success callback
    const cleanupAndRefund = async () => {
      if (user) {
        try {
          // Add credits back to user's balance
          await decrementUserBalance(user.uid, -SERVICE_COSTS.EVALUATION);
          setUserPoints(prevPoints => (prevPoints !== null ? prevPoints + SERVICE_COSTS.EVALUATION : null));
          toast.info('Credits have been refunded.');
        } catch (error) {
          console.error('Error refunding credits:', error);
        }
      }
    };

    await checkCreditsAndShowError(
      user.uid,
      SERVICE_COSTS.EVALUATION,
      () => {
        // If we get here, it means either:
        // 1. User is not enrolled in pay-as-you-go
        // 2. User is enrolled but payment failed in production mode
        // We don't need to show any additional messages as they are handled in checkCreditsAndShowError
      },
      async () => {
        setIsGenerating(true);
        setIsLoading(true);
        setError(null);
        setStatusMessage('Job in queue...');
        setEvaluationResults(null);

        try {
          // Deduct credits only once
          await decrementUserBalance(user.uid, SERVICE_COSTS.EVALUATION);
          setUserPoints(prevPoints => (prevPoints !== null ? prevPoints - SERVICE_COSTS.EVALUATION : null));

          const eventSource = new EventSource(
            `${process.env.REACT_APP_API_URL}/api/evaluate?url=${encodeURIComponent(website)}&userId=${encodeURIComponent(user.uid)}`
          );

          // Track connection state and retry attempts
          let isFirstConnect = true;
          let retryCount = 0;
          const MAX_RETRIES = 3;
          const RETRY_DELAY = 2000;
          let hasResults = false;
          let lastStatus = '';

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
                // Don't show "Connecting to existing analysis" if we're already showing progress
                if (!(data.status === 'Connecting to existing analysis...' && lastStatus !== '')) {
                  setStatusMessage(data.status);
                  lastStatus = data.status;
                }

                // If we get a completion status, close the connection properly
                if (data.status === 'completed' && data.result) {
                  hasResults = true;
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
            if (!hasResults) {
              if (eventSource.readyState === EventSource.CLOSED) {
                // If this is the first connection attempt, or we've exceeded retries, treat as error
                if (isFirstConnect || retryCount >= MAX_RETRIES) {
                  console.log('Connection closed without results - treating as error');
                  clearTimeout(timeoutId);
                  eventSource.close();
                  await cleanupAndRefund();
                  handleError('Lost connection to the evaluation server. Please try again.');
                } else {
                  // Otherwise, increment retry count and wait for reconnect
                  retryCount++;
                  console.log(`Retry attempt ${retryCount}/${MAX_RETRIES}`);
                  await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                }
              } else if (eventSource.readyState === EventSource.CONNECTING) {
                // Connection is attempting to reconnect - log but don't take action yet
                console.log('EventSource is attempting to reconnect...');
                isFirstConnect = false;
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
      }
    );
  };

  const handlePurchase = (amount: number) => {
    setUserPoints(prevBalance => (prevBalance !== null ? prevBalance + amount : amount));
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      window.location.reload();
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
    return (
      <>
        <div className={`main-content ${analysisState}`} style={{ display: currentPage === 'home' ? 'flex' : 'none' }}>
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
                  <ChatInterface
                    chatState={chatState}
                    setChatState={setChatState}
                    websiteUrl={websiteUrl}
                    onStartEvaluation={handleEvaluation}
                    evaluationResults={evaluationResults}
                    isLoading={isLoading}
                    statusMessage={statusMessage}
                    onPointsUpdated={(points) => setUserPoints(points)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {currentPage === 'profile' && <ProfilePage />}
        {currentPage === 'points' && <PointsManagementPage />}
      </>
    );
  };

  // Replace navigate with direct state changes
  const goToPage = (page: string) => {
    setCurrentPage(page);
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'points':
        return <PointsManagementPage />;
      case 'profile':
        return <ProfilePage />;
      case 'home':
      default:
        return renderPage();
    }
  };

  if (loading) return <div>Loading...</div>;
  if (authError) return <div>Error: {authError.message}</div>;

  return (
    <div className="App">
      {isOffline && <div className="error-message">You are currently offline. Some features may not work.</div>}
      <header className="app-header">
        <div className="app-title" onClick={() => goToPage('home')}>
          <h1>Olive</h1>
        </div>
        {user ? (
          <div className="user-menu-container">
            <div className="points-counter" onClick={() => goToPage('points')}>
              <span>${userData?.balance?.toFixed(2) || '0.00'}</span>
              {userData?.isPayAsYouGo && (
                <FontAwesomeIcon 
                  icon={faBolt} 
                  className="pay-as-you-go-icon" 
                  title="Pay-as-you-go enabled"
                />
              )}
            </div>
            <button 
              className="user-menu-button" 
              onClick={() => goToPage('profile')}
              title="View Profile"
            >
              <img
                src={getProfilePicture(user)}
                alt="User Avatar"
                className="user-avatar"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.src = defaultUserIcon;
                }}
              />
            </button>
          </div>
        ) : (
          <button onClick={handleSignInClick} className="sign-in-button">Sign In / Sign Up</button>
        )}
      </header>
      <div className={`content-wrapper`}>
        <main className="main-content">
          {currentPage === 'payment-success' ? (
            <PaymentMethodSuccess onNavigateToPoints={() => goToPage('points')} />
          ) : currentPage === 'payment-success-page' ? (
            <PaymentSuccessPage onNavigateToPoints={() => goToPage('points')} />
          ) : (
            renderCurrentPage()
          )}
        </main>
      </div>
      {showAuthModal && <AuthModal onClose={handleCloseAuthModal} />}
      <ToastContainer 
        position="bottom-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable={false}
        pauseOnHover
        theme="dark"
        style={{
          zIndex: 9999
        }}
      />
      <Footer />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<AppContent />} />
          <Route
            path="/terms-of-service"
            element={
              <LegalLayout>
                <TermsOfService />
              </LegalLayout>
            }
          />
          <Route
            path="/privacy-policy"
            element={
              <LegalLayout>
                <PrivacyPolicy />
              </LegalLayout>
            }
          />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
};

export default App;