import React, { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { getUserPoints } from '../services/points';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faBolt, faGift, faCrown } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';

interface PricingTier {
  points: number;
  price: number;
  popular?: boolean;
  features: string[];
}

const pricingTiers: PricingTier[] = [
  {
    points: 50,
    price: 4.99,
    features: [
      'Basic website evaluations',
      'Performance metrics',
      'Basic SEO analysis',
      'PDF reports'
    ]
  },
  {
    points: 150,
    price: 9.99,
    popular: true,
    features: [
      'All Basic features',
      'Detailed AI recommendations',
      'Competitor analysis',
      'Priority support',
      'Bulk evaluations'
    ]
  },
  {
    points: 500,
    price: 24.99,
    features: [
      'All Popular features',
      'Custom metrics tracking',
      'API access',
      'White-label reports',
      'Team collaboration',
      'Advanced analytics'
    ]
  }
];

const PointsManagementPage: React.FC = () => {
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);

  useEffect(() => {
    const fetchUserPoints = async () => {
      if (auth.currentUser) {
        try {
          const points = await getUserPoints(auth.currentUser.uid);
          setUserPoints(points);
        } catch (error) {
          toast.error('Failed to load points balance');
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchUserPoints();
  }, []);

  const handlePurchase = async (tier: PricingTier) => {
    // Placeholder for Stripe integration
    toast.info('Stripe integration coming soon!');
  };

  return (
    <div className="points-management-page">
      <div className="points-header">
        <h2>Points Management</h2>
        <div className="current-points">
          <FontAwesomeIcon icon={faBolt} className="points-icon" />
          {isLoading ? (
            <FontAwesomeIcon icon={faSpinner} spin />
          ) : (
            <span>{userPoints !== null ? userPoints : '0'} points</span>
          )}
        </div>
      </div>

      <div className="pricing-tiers">
        {pricingTiers.map((tier, index) => (
          <div 
            key={index} 
            className={`pricing-tier ${tier.popular ? 'popular' : ''} ${selectedTier === index ? 'selected' : ''}`}
          >
            {tier.popular && (
              <div className="popular-badge">
                <FontAwesomeIcon icon={faCrown} /> Most Popular
              </div>
            )}
            <div className="tier-header">
              <h3>{tier.points} Points</h3>
              <div className="price">${tier.price}</div>
            </div>
            <ul className="features-list">
              {tier.features.map((feature, fIndex) => (
                <li key={fIndex}>{feature}</li>
              ))}
            </ul>
            <button 
              className="purchase-button"
              onClick={() => handlePurchase(tier)}
            >
              Purchase
            </button>
          </div>
        ))}
      </div>

      <div className="points-info">
        <div className="info-card">
          <FontAwesomeIcon icon={faGift} className="info-icon" />
          <h3>About Points</h3>
          <p>Points are used to evaluate websites. Each evaluation costs 1 point.</p>
          <p>Purchase points to unlock advanced features and evaluate more websites.</p>
        </div>
      </div>
    </div>
  );
};

export default PointsManagementPage;