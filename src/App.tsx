import React, { useState, useEffect } from 'react';
import WebsiteInput from './components/WebsiteInput';
import EvaluationResults from './components/EvaluationResults';
import Auth from './components/Auth';
import UserDashboard from './components/UserDashboard';
import PurchasePoints from './components/PurchasePoints';
import { evaluateWebsite } from './services/evaluator';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './services/firebase';
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

  const handleEvaluation = async (website: string) => {
    if (isOffline) {
      handleError('You are currently offline. Please check your internet connection and try again.');
      return;
    }

    if (!user || userPoints === null || userPoints <= 0) {
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

  if (loading) return <div>Loading...</div>;
  if (authError) return <div>Error: {authError.message}</div>;

  return (
    <div className="App">
      <h1>Olive Site Evaluator</h1>
      {isOffline && <div style={{ color: 'red' }}>You are currently offline. Some features may not work.</div>}
      <Auth />
      {user ? (
        <>
          <p>Available points: {userPoints !== null ? userPoints : 'Loading...'}</p>
          <WebsiteInput onSubmit={handleEvaluation} isLoading={isLoading} />
          {isLoading && <p>Evaluating website...</p>}
          {error && <p style={{ color: 'red' }}>{error}</p>}
          {evaluationResults && <EvaluationResults result={evaluationResults} />}
          <PurchasePoints userId={user.uid} onPurchase={handlePurchase} />
          <UserDashboard userId={user.uid} />
        </>
      ) : (
        <p>Please sign in to use the Olive Site Evaluator. New users start with 100 points!</p>
      )}
      <ToastContainer position="top-right" autoClose={5000} />
    </div>
  );
};

export default App;