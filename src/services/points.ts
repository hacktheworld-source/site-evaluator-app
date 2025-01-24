import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

export const getUserPoints = async (userId: string): Promise<number> => {
  const response = await axios.get(`${API_URL}/api/points/${userId}`);
  return response.data.points;
};

export const updateUserPoints = async (userId: string, points: number): Promise<void> => {
  await axios.post(`${API_URL}/api/points/${userId}`, { points });
};

export const decrementUserPoints = async (userId: string): Promise<void> => {
  await axios.post(`${API_URL}/api/points/${userId}/decrement`);
}; 