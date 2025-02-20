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
  const baseUrl = process.env.REACT_APP_FRONTEND_URL ? new URL(process.env.REACT_APP_FRONTEND_URL).pathname : '';
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
          target.src = `${baseUrl}/eye-graphics/eye1.png`; // Fallback to first image
        }}
      />
    </div>
  );
};

export default AnimatedEye;
