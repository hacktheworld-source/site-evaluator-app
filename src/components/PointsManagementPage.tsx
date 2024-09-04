import React, { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { getUserPoints, updateUserPoints } from '../services/database';
import PurchasePoints from './PurchasePoints';

const PointsManagementPage: React.FC = () => {
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [purchaseAmount, setPurchaseAmount] = useState<number>(5);

  useEffect(() => {
    const fetchUserPoints = async () => {
      if (auth.currentUser) {
        const points = await getUserPoints(auth.currentUser.uid);
        setUserPoints(points);
      }
    };

    fetchUserPoints();
  }, []);

  const handlePurchase = async () => {
    if (auth.currentUser) {
      const newTotal = (userPoints || 0) + purchaseAmount;
      await updateUserPoints(auth.currentUser.uid, newTotal);
      setUserPoints(newTotal);
      alert(`Successfully purchased ${purchaseAmount} points!`);
    }
  };

  return (
    <div className="points-management-page">
      <h2>Points Management</h2>
      <p>Current Points: {userPoints !== null ? userPoints : 'Loading...'}</p>
      <div className="purchase-points">
        <h3>Purchase Points</h3>
        <input
          type="number"
          min="1"
          value={purchaseAmount}
          onChange={(e) => setPurchaseAmount(parseInt(e.target.value))}
        />
        <button onClick={handlePurchase}>Purchase Points</button>
      </div>
      <div className="points-info">
        <h3>About Points</h3>
        <p>Points are used to evaluate websites. Each evaluation costs 1 point.</p>
        <p>You can purchase more points here or earn them by referring friends.</p>
      </div>
    </div>
  );
};

export default PointsManagementPage;