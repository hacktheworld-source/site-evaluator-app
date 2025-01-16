import React, { useState, useEffect } from 'react';

interface TypewriterTextProps {
  text: string;
  onComplete?: () => void;
  isLoading?: boolean;
}

const TypewriterText: React.FC<TypewriterTextProps> = ({ text, onComplete, isLoading }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (isLoading) {
      const intervalId = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % (text.length + 1));
      }, 500);

      return () => clearInterval(intervalId);
    }
  }, [text, isLoading]);

  if (!isLoading) {
    return <div>{text}</div>;
  }

  return <div>{text.slice(0, currentIndex) + '...'}</div>;
};

export default React.memo(TypewriterText);