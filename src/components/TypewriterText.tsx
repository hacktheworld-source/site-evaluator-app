import React, { useState, useEffect } from 'react';

interface TypewriterTextProps {
  text: string;
  onComplete?: () => void;
}

const TypewriterText: React.FC<TypewriterTextProps> = ({ text, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prevText => prevText + text[currentIndex]);
        setCurrentIndex(prevIndex => prevIndex + 1);
      }, getDelay(text[currentIndex]));

      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, onComplete]);

  const getDelay = (char: string) => {
    if (['\n', '.', ',', ':', ';', '!', '?'].includes(char)) {
      return 100; // Longer delay for special characters
    }
    return 20; // Base delay for regular characters
  };

  return <div>{displayedText}</div>;
};

export default TypewriterText;