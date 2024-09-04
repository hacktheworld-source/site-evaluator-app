import React, { useState } from 'react';
import { updateUserPoints } from '../services/database';

interface PurchasePointsProps {
  userId: string;
  onPurchase: (points: number) => void;
}

const PurchasePoints: React.FC<PurchasePointsProps> = ({ userId, onPurchase }) => {
  const [pointsToBuy, setPointsToBuy] = useState(5);

  const handlePurchase = async () => {
    try {
      await updateUserPoints(userId, pointsToBuy);
      onPurchase(pointsToBuy);
      alert(`Successfully purchased ${pointsToBuy} points!`);
    } catch (error) {
      console.error('Error purchasing points:', error);
      alert('Failed to purchase points. Please try again.');
    }
  };

  return (
    <div>
      <h3>Purchase Points</h3>
      <input
        type="number"
        min="1"
        value={pointsToBuy}
        onChange={(e) => setPointsToBuy(parseInt(e.target.value))}
      />
      <button onClick={handlePurchase}>Buy Points</button>
    </div>
  );
};

export default PurchasePoints;