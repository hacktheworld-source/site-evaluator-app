import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

export const CREDIT_COSTS = {
  EVALUATION: 7,
  CHAT_MESSAGE: 1,
  REPORT_GENERATION: 3
};

export const getUserPoints = async (userId: string): Promise<number> => {
  const response = await axios.get(`${API_URL}/api/points/${userId}`);
  return response.data.points;
};

export const updateUserPoints = async (userId: string, points: number): Promise<void> => {
  await axios.post(`${API_URL}/api/points/${userId}`, { points });
};

export const decrementUserPoints = async (userId: string, amount: number): Promise<void> => {
  await axios.post(`${API_URL}/api/points/${userId}/decrement`, { amount });
};

export const hasEnoughCredits = async (userId: string, requiredCredits: number): Promise<boolean> => {
  const currentPoints = await getUserPoints(userId);
  return currentPoints >= requiredCredits;
};

export const checkCreditsAndShowError = async (
  userId: string, 
  requiredCredits: number,
  onInsufficientCredits: () => void,
  onSuccess: () => void
): Promise<void> => {
  if (await hasEnoughCredits(userId, requiredCredits)) {
    onSuccess();
  } else {
    onInsufficientCredits();
  }
}; 