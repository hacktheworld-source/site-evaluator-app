import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '../services/firebase';
import { getUserBalance } from '../services/points';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';

const PaymentSuccessPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [balance, setBalance] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkPaymentStatus = async () => {
            if (!auth.currentUser) {
                navigate('/');
                return;
            }

            try {
                // Get the updated balance
                const newBalance = await getUserBalance(auth.currentUser.uid);
                setBalance(newBalance);
                
                // Show success message
                toast.success('Payment successful! Your balance has been updated.');
                
                // Redirect after a short delay
                setTimeout(() => {
                    navigate('/points');
                }, 3000);
            } catch (error) {
                console.error('Error checking payment status:', error);
                toast.error('Error verifying payment. Please contact support if your balance is not updated.');
            } finally {
                setIsLoading(false);
            }
        };

        checkPaymentStatus();
    }, [navigate]);

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