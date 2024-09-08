import React, { useState, useEffect, useCallback } from 'react';

interface TypewriterTextProps {
  text: string;
  onComplete?: () => void;
}

const TypewriterText: React.FC<TypewriterTextProps> = ({ text, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  const getDelay = useCallback((char: string) => {
    if (['\n', '.', ',', ':', ';', '!', '?'].includes(char)) {
      return 100; // Longer delay for special characters
    }
    return 20; // Base delay for regular characters
  }, []);

  useEffect(() => {
    if (isComplete) return;

    let currentIndex = 0;
    const intervalId = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(prevText => prevText + text[currentIndex]);
        currentIndex++;
      } else {
        clearInterval(intervalId);
        setIsComplete(true);
        if (onComplete) {
          onComplete();
        }
      }
    }, getDelay(text[currentIndex]));

    return () => clearInterval(intervalId);
  }, [text, onComplete, getDelay, isComplete]);

  return <div>{displayedText}</div>;
};

export default React.memo(TypewriterText);