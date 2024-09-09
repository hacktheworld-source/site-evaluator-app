import React, { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { getUserPoints } from '../services/database';
import defaultUserIcon from '../assets/default-user-icon.png';

const ProfilePage: React.FC = () => {
  const [userPoints, setUserPoints] = useState<number | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser) {
        const points = await getUserPoints(auth.currentUser.uid);
        setUserPoints(points);
      }
    };

    fetchUserData();
  }, []);

  return (
    <div className="profile-page">
      <h2>User Profile</h2>
      {auth.currentUser && (
        <div className="profile-info">
          <img 
            src={auth.currentUser.photoURL || defaultUserIcon} 
            alt="Profile" 
            className="profile-picture"
          />
          <p><strong>Name:</strong> {auth.currentUser.displayName || 'N/A'}</p>
          <p><strong>Email:</strong> {auth.currentUser.email}</p>
          <p><strong>Points:</strong> {userPoints !== null ? userPoints : 'Loading...'}</p>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;