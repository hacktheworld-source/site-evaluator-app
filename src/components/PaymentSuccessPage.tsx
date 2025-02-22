import React, { useEffect, useState } from 'react';
import { auth } from '../services/firebase';
import { getUserBalance } from '../services/points';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';

interface PaymentSuccessPageProps {
    onNavigateToPoints: () => void;
}

const PaymentSuccessPage: React.FC<PaymentSuccessPageProps> = ({ onNavigateToPoints }) => {
    const [balance, setBalance] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        
        const checkPaymentStatus = async () => {
            if (!auth.currentUser) {
                onNavigateToPoints();
                return;
            }

            try {
                // Get the updated balance
                const newBalance = await getUserBalance(auth.currentUser.uid);
                setBalance(newBalance);
                
                // Show success message
                toast.success('Payment successful! Your balance has been updated.');
                
                // Redirect after a short delay
                timeoutId = setTimeout(() => {
                    onNavigateToPoints();
                }, 3000);
            } catch (error) {
                console.error('Error checking payment status:', error);
                toast.error('Error verifying payment. Please contact support if your balance is not updated.');
            } finally {
                setIsLoading(false);
            }
        };

        checkPaymentStatus();

        return () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [onNavigateToPoints]);

    return (
        <div className="payment-success-page">
            <div className="success-content">
                {isLoading ? (
                    <>
                        <FontAwesomeIcon icon={faSpinner} spin size="3x" />
                        <h2>Verifying payment...</h2>
                    </>
                ) : (
                    <>
                        <FontAwesomeIcon icon={faCheckCircle} size="3x" className="success-icon" />
                        <h2>Payment Successful!</h2>
                        {balance !== null && (
                            <p>Your new balance: ${balance.toFixed(2)}</p>
                        )}
                        <p>Redirecting you back...</p>
                    </>
                )}
            </div>
        </div>
    );
};

export default PaymentSuccessPage; 