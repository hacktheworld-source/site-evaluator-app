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
    if (isGenerating || isWaitingForResponse) {
      setAnimationSpeed(200);
    } else {
      setAnimationSpeed(5000);
    }
  }, [isGenerating, isWaitingForResponse]);

  useEffect(() => {
    const interval = setInterval(() => {
      let newImage;
      do {
        newImage = Math.floor(Math.random() * 5) + 1;
      } while (newImage === currentImage);
      setCurrentImage(newImage);
    }, animationSpeed);

    return () => clearInterval(interval);
  }, [animationSpeed, currentImage]);

  // Get the base URL from the environment variable, defaulting to '' for local development
  const baseUrl = process.env.REACT_APP_FRONTEND_URL ? new URL(process.env.REACT_APP_FRONTEND_URL).pathname : '';

  return (
    <div className={`animated-eye ${size}`}>
      <img src={`${baseUrl}/eye-graphics/eye${currentImage}.png`} alt="Animated Eye" />
    </div>
  );
};

export default AnimatedEye;
