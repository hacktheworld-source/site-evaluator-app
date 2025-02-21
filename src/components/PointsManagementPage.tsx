import React, { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { getUserBalance, SERVICE_COSTS } from '../services/points';
import { paymentService } from '../services/paymentService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDollarSign, faInfoCircle, faHistory, faCreditCard, faCheckCircle, faSpinner, faCog } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';

interface UserData {
  balance: number;
  isPayAsYouGo: boolean;
  hasAddedPayment: boolean;
}

const PointsManagementPage: React.FC = () => {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchUserData = async () => {
    if (auth.currentUser) {
      try {
        // First check payment method status
        const hasPaymentMethod = await paymentService.checkPaymentMethodStatus(auth.currentUser.uid);
        console.log('Initial payment method status check:', hasPaymentMethod);

        // Then get user data and history
        const [userDataResponse, history] = await Promise.all([
          paymentService.getUserData(auth.currentUser.uid),
          paymentService.getPaymentHistory(auth.currentUser.uid)
        ]);
        setUserData(userDataResponse);
        setBalance(userDataResponse.balance);
        setPaymentHistory(history);
      } catch (error) {
        toast.error('Failed to load user data');
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const refreshAppUserData = () => {
    // Dispatch a custom event that App.tsx will listen for
    window.dispatchEvent(new Event('paymentStatusChanged'));
  };

  const handlePayAsYouGoSignup = async () => {
    if (!auth.currentUser) {
      toast.error('Please sign in to continue');
      return;
    }

    setIsProcessing(true);
    try {
      const portalUrl = await paymentService.createSetupSession(auth.currentUser.uid);
      // Log the actual pathname
      console.log('Current pathname:', window.location.pathname);
      // Store current URL in localStorage to handle return
      localStorage.setItem('returnPath', window.location.pathname);
      // Log what was actually stored
      console.log('Stored returnPath:', localStorage.getItem('returnPath'));
      // Use window.location.href for external URL navigation
      window.location.href = portalUrl;
    } catch (error) {
      console.error('Setup error:', error);
      toast.error('Failed to initialize setup. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleUnenroll = async () => {
    if (!auth.currentUser) {
      toast.error('Please sign in to continue');
      return;
    }

    setIsProcessing(true);
    try {
      await paymentService.unenrollFromPayAsYouGo(auth.currentUser.uid);
      const userDataResponse = await paymentService.getUserData(auth.currentUser.uid);
      setUserData(userDataResponse);
      refreshAppUserData();
      toast.success('Successfully unenrolled from pay-as-you-go');
    } catch (error) {
      console.error('Unenroll error:', error);
      toast.error('Failed to unenroll. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManagePaymentMethods = async () => {
    if (!auth.currentUser) {
      toast.error('Please sign in to continue');
      return;
    }

    setIsProcessing(true);
    try {
      const portalUrl = await paymentService.createSetupSession(auth.currentUser.uid);
      // Don't store returnPath since we're just managing payment methods
      window.location.href = portalUrl;
    } catch (error) {
      console.error('Portal access error:', error);
      toast.error('Failed to access payment settings. Please try again.');
      setIsProcessing(false);
    }
  };

  const formatPrice = (price: number) => {
    return `$${price.toFixed(2)}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Add polling for payment method status after portal return
  useEffect(() => {
    const checkPaymentMethodStatus = async () => {
      if (!auth.currentUser) return;

      console.log('Checking payment method status...'); // Debug log
      try {
        const hasPaymentMethod = await paymentService.checkPaymentMethodStatus(auth.currentUser.uid);
        console.log('Payment method status result:', hasPaymentMethod); // Debug log
        if (hasPaymentMethod) {
          console.log('Payment method found, refreshing user data...'); // Debug log
          await fetchUserData();
          refreshAppUserData();
        } else {
          // If no payment methods found, treat as unenrolled
          await handleUnenroll();
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
      }
    };

    // Check if we're returning from the portal
    const returnPath = localStorage.getItem('returnPath');
    console.log('Return path from localStorage:', returnPath); // Debug log
    if (returnPath !== null) { // If there's any return path, we're coming back from portal
      console.log('Detected return from portal, starting polling...'); // Debug log
      localStorage.removeItem('returnPath');
      
      // Poll for payment method status a few times
      let attempts = 0;
      const maxAttempts = 3;
      const interval = setInterval(async () => {
        console.log(`Polling attempt ${attempts + 1} of ${maxAttempts}`); // Debug log
        if (attempts >= maxAttempts) {
          console.log('Max polling attempts reached, stopping...'); // Debug log
          clearInterval(interval);
          return;
        }
        await checkPaymentMethodStatus();
        attempts++;
      }, 2000);

      return () => clearInterval(interval);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="points-management-page">
        <div className="loading-state">
          <FontAwesomeIcon icon={faSpinner} spin />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="points-management-page">
      <div className="balance-header">
        <h2>Account Balance</h2>
        <div className="current-balance">
          <FontAwesomeIcon icon={faDollarSign} className="balance-icon" />
          <span>{formatPrice(balance || 0)}</span>
        </div>
      </div>

      <div className="service-costs">
        <h3>Pay-as-you-go Pricing</h3>
        <div className="costs-grid">
          <div className="cost-item">
            <span>Website Evaluation</span>
            <span>{formatPrice(SERVICE_COSTS.EVALUATION)}</span>
          </div>
          <div className="cost-item">
            <span>Report Generation</span>
            <span>{formatPrice(SERVICE_COSTS.REPORT_GENERATION)}</span>
          </div>
          <div className="cost-item">
            <span>Chat Message</span>
            <span>{formatPrice(SERVICE_COSTS.CHAT_MESSAGE)}</span>
          </div>
        </div>
      </div>

      {!userData?.hasAddedPayment ? (
        <div className="signup-section">
          <div className="info-card">
            <FontAwesomeIcon icon={faInfoCircle} className="info-icon" />
            <h3>Start with ${SERVICE_COSTS.INITIAL_CREDIT} Free Credit</h3>
            <p>New users receive ${SERVICE_COSTS.INITIAL_CREDIT} in credit to try our services. Set up pay-as-you-go now to ensure uninterrupted service when your credit runs out.</p>
          </div>
          <div className="payment-buttons">
            <button 
              className="signup-button"
              onClick={handlePayAsYouGoSignup}
              disabled={isProcessing}
            >
              <FontAwesomeIcon icon={faCreditCard} />
              Set Up Pay-as-you-go
            </button>
            <button 
              className="manage-payment-button"
              onClick={handleManagePaymentMethods}
              disabled={isProcessing}
            >
              <FontAwesomeIcon icon={faCog} />
              Manage Payment Methods
            </button>
          </div>
        </div>
      ) : (
        <div className="status-section">
          <div className="info-card success">
            <FontAwesomeIcon icon={faCheckCircle} className="success-icon" />
            <h3>Pay-as-you-go Active</h3>
            <p>Your account is set up for automatic payments. You'll be charged only for what you use, when your credit runs low.</p>
          </div>
          <div className="payment-buttons">
            <button 
              className="unenroll-button"
              onClick={handleUnenroll}
              disabled={isProcessing}
            >
              <FontAwesomeIcon icon={faCreditCard} />
              Unenroll from Pay-as-you-go
            </button>
            <button 
              className="manage-payment-button"
              onClick={handleManagePaymentMethods}
              disabled={isProcessing}
            >
              <FontAwesomeIcon icon={faCog} />
              Manage Payment Methods
            </button>
          </div>
        </div>
      )}

      <div className="payment-history-section">
        <button 
          className="toggle-history-button"
          onClick={() => setShowHistory(!showHistory)}
        >
          <FontAwesomeIcon icon={faHistory} />
          {showHistory ? 'Hide Payment History' : 'Show Payment History'}
        </button>

        {showHistory && (
          <div className="history-list">
            {paymentHistory.length > 0 ? (
              paymentHistory.map(payment => (
                <div key={payment.id} className="history-item">
                  <div className="payment-info">
                    <span className="payment-amount">{formatPrice(payment.amount)}</span>
                    <span className="payment-date">{formatDate(payment.created)}</span>
                  </div>
                  <div className="payment-status">
                    <span className={`status-badge ${payment.status}`}>
                      {payment.status}
                    </span>
                    {payment.receipt_url && (
                      <a 
                        href={payment.receipt_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="receipt-link"
                      >
                        View Receipt
                      </a>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="no-history">No payment history available</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PointsManagementPage;