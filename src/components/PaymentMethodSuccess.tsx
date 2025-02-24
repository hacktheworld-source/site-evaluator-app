import React, { useEffect, useState } from 'react';
import { auth } from '../services/firebase';
import { paymentService } from '../services/paymentService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';

interface PaymentMethodSuccessProps {
    onNavigateToPoints: () => void;
}

const PaymentMethodSuccess: React.FC<PaymentMethodSuccessProps> = ({ onNavigateToPoints }) => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        
        const checkPaymentStatus = async () => {
            if (!auth.currentUser) {
                onNavigateToPoints();
                return;
            }

            try {
                // Use direct Stripe check
                const hasPaymentMethod = await paymentService.checkPaymentMethodStatus(auth.currentUser.uid);
                
                if (hasPaymentMethod) {
                    toast.success('Payment method successfully added!');
                } else {
                    toast.warning('No payment method was added. Please try again if this was not intended.');
                }
                
                // Redirect after a short delay
                timeoutId = setTimeout(() => {
                    onNavigateToPoints();
                }, 3000);
            } catch (error) {
                console.error('Error checking payment status:', error);
                toast.error('Error verifying payment method. Please check your account settings.');
                timeoutId = setTimeout(() => {
                    onNavigateToPoints();
                }, 3000);
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
                        <h2>Verifying payment method...</h2>
                    </>
                ) : (
                    <>
                        <FontAwesomeIcon icon={faCheckCircle} size="3x" className="success-icon" />
                        <h2>Returning to account...</h2>
                        <p>You will be redirected in a moment.</p>
                    </>
                )}
            </div>
        </div>
    );
};

export default PaymentMethodSuccess; 