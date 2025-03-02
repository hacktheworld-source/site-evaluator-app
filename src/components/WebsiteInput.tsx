import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';

interface WebsiteInputProps {
  onSubmit: (website: string, rawInput: string) => void;
  isLoading: boolean;
  isLoggedIn: boolean;
  onSignInRequired: () => void;
  variant?: 'normal' | 'compact';
  initialUrl?: string;
  initialRawInput?: string;
}

const WebsiteInput: React.FC<WebsiteInputProps> = ({ 
  onSubmit, 
  isLoading, 
  isLoggedIn,
  onSignInRequired,
  variant = 'normal',
  initialUrl = '',
  initialRawInput = ''
}) => {
  const [website, setWebsite] = useState(variant === 'compact' ? initialRawInput : initialUrl);

  useEffect(() => {
    if (variant === 'compact' && initialRawInput) {
      setWebsite(initialRawInput);
    }
  }, [initialRawInput, variant]);

  const formatUrl = (url: string): string => {
    if (!url.match(/^https?:\/\//i)) {
      return `https://${url}`;
    }
    return url;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      onSignInRequired();
      return;
    }
    if (website.trim()) {
      onSubmit(formatUrl(website.trim()), website.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`website-input-form ${variant}`}>
      <div className="input-wrapper">
        <input
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder={variant === 'compact' ? 'Enter new URL...' : 'Enter website URL...'}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="evaluate-submit-button"
          disabled={isLoading || !website.trim()}
        >
          {isLoading ? (
            <div className="royal-spinner" />
          ) : (
            "Analyze"
          )}
        </button>
      </div>
    </form>
  );
};

export default WebsiteInput;