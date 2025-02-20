import React, { useState, useEffect } from 'react';

interface AnimatedEyeProps {
  isGenerating: boolean;
  isWaitingForResponse: boolean;
  size?: 'normal' | 'small';
}

const AnimatedEye: React.FC<AnimatedEyeProps> = ({ 
  isGenerating, 
  isWaitingForResponse,
  size = 'normal' 
}) => {
  const [currentImage, setCurrentImage] = useState(1);
  const [animationSpeed, setAnimationSpeed] = useState(5000);

  useEffect(() => {
    console.log('AnimatedEye state change:', {
      isGenerating,
      isWaitingForResponse,
      currentSpeed: animationSpeed
    });

    if (isGenerating || isWaitingForResponse) {
      setAnimationSpeed(200);
    } else {
      setAnimationSpeed(5000);
    }
  }, [isGenerating, isWaitingForResponse]);

  useEffect(() => {
    console.log('Setting up eye animation interval with speed:', animationSpeed);
    
    const interval = setInterval(() => {
      let newImage;
      do {
        newImage = Math.floor(Math.random() * 5) + 1;
      } while (newImage === currentImage);
      setCurrentImage(newImage);
    }, animationSpeed);

    return () => {
      console.log('Cleaning up eye animation interval');
      clearInterval(interval);
    };
  }, [animationSpeed, currentImage]);

  // Get the base URL from the environment variable, defaulting to '' for local development
  const getBaseUrl = () => {
    if (!process.env.REACT_APP_FRONTEND_URL) return '';
    
    try {
      const url = new URL(process.env.REACT_APP_FRONTEND_URL);
      // If we're on the production domain, just use a relative path
      if (url.hostname === 'olivesays.com') {
        return '';
      }
      // Otherwise, use the full URL's pathname
      return url.pathname;
    } catch (e) {
      console.error('Failed to parse FRONTEND_URL:', e);
      return '';
    }
  };

  const baseUrl = getBaseUrl();
  console.log('Eye animation using base URL:', baseUrl);

  return (
    <div className={`animated-eye ${size}`}>
      <img 
        src={`${baseUrl}/eye-graphics/eye${currentImage}.png`} 
        alt="Animated Eye"
        onError={(e) => {
          console.error('Failed to load eye image:', e);
          const target = e.target as HTMLImageElement;
          target.onerror = null; // Prevent infinite error loop
          target.src = `/eye-graphics/eye1.png`; // Use absolute path for fallback
        }}
      />
    </div>
  );
};

export default AnimatedEye;
