import axios from 'axios';
import { toast } from 'react-toastify';
import { paymentService } from './paymentService';

const API_URL = process.env.REACT_APP_API_URL;

export const SERVICE_COSTS = {
  EVALUATION: 0.70,
  CHAT_MESSAGE: 0.10,
  REPORT_GENERATION: 0.30,
  MINIMUM_PURCHASE: 5.00,
  INITIAL_CREDIT: 5.00
};

export const getUserPoints = async (userId: string): Promise<number> => {
  const response = await axios.get(`${API_URL}/api/balance/${userId}`);
  return response.data.balance;
};

export const getUserBalance = async (userId: string): Promise<number> => {
  const response = await axios.get(`${API_URL}/api/balance/${userId}`);
  return response.data.balance;
};

export const decrementUserBalance = async (userId: string, amount: number): Promise<void> => {
  await axios.post(`${API_URL}/api/balance/${userId}/deduct`, { amount });
};

export const hasEnoughBalance = async (userId: string, requiredAmount: number): Promise<boolean> => {
  const currentBalance = await getUserBalance(userId);
  return currentBalance >= requiredAmount;
};

export const checkCreditsAndShowError = async (
  userId: string, 
  requiredAmount: number,
  onInsufficientBalance: () => void,
  onSuccess: () => void
): Promise<void> => {
  try {
    const [hasEnough, userData] = await Promise.all([
      hasEnoughBalance(userId, requiredAmount),
      paymentService.getUserData(userId)
    ]);

    if (hasEnough || (userData.isPayAsYouGo && userData.hasAddedPayment)) {
      // If user has enough balance OR is enrolled in pay-as-you-go,
      // let the onSuccess callback handle the balance deduction
      onSuccess();
      return;
    }

    // Not enough balance and not on pay-as-you-go
    toast.error(`This action requires $${requiredAmount.toFixed(2)}`);
    toast.info('Click here to enroll in pay-as-you-go', {
      onClick: () => window.location.href = '/points'
    });
    onInsufficientBalance();
  } catch (error) {
    console.error('Error checking credits:', error);
    toast.error('Error checking balance. Please try again.');
    onInsufficientBalance();
  }
}; 