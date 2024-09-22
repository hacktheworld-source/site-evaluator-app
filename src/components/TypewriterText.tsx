import React, { useState, useEffect, useCallback } from 'react';

interface TypewriterTextProps {
  text: string;
  onComplete?: () => void;
  isLoading?: boolean;
}

const TypewriterText: React.FC<TypewriterTextProps> = ({ text, onComplete, isLoading }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  const getDelay = useCallback((char: string) => {
    if (['\n', '.', ',', ':', ';', '!', '?'].includes(char)) {
      return 100; // Longer delay for special characters
    }
    return 20; // Base delay for regular characters
  }, []);

  useEffect(() => {
    if (isLoading) {
      const loadingText = 'Loading...';
      const intervalId = setInterval(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % (loadingText.length + 1));
      }, 500);

      return () => clearInterval(intervalId);
    }

    if (currentIndex < text.length) {
      const timeoutId = setTimeout(() => {
        setDisplayedText((prevText) => prevText + text[currentIndex]);
        setCurrentIndex((prevIndex) => prevIndex + 1);
      }, getDelay(text[currentIndex]));

      return () => clearTimeout(timeoutId);
    } else if (onComplete) {
      onComplete();
    }
  }, [text, currentIndex, getDelay, onComplete, isLoading]);

  return <div>{isLoading ? 'Loading'.slice(0, currentIndex) + '...' : displayedText}</div>;
};

export default React.memo(TypewriterText);