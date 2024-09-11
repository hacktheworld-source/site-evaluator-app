import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';

interface WebsiteInputProps {
  onSubmit: (website: string) => void;
  isLoading: boolean;
  isLoggedIn: boolean;
  onSignInRequired: () => void;
}

const WebsiteInput: React.FC<WebsiteInputProps> = ({ onSubmit, isLoading, isLoggedIn, onSignInRequired }) => {
  const [website, setWebsite] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedUrl = formatUrl(website);
    if (isValidUrl(formattedUrl)) {
      if (isLoggedIn) {
        onSubmit(formattedUrl);
      } else {
        onSignInRequired();
      }
      setError('');
    } else {
      setError('Please enter a valid URL');
    }
  };

  const formatUrl = (url: string) => {
    if (!/^https?:\/\//i.test(url)) {
      return `https://${url}`;
    }
    return url;
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="website-input-form">
      <div className="input-wrapper">
        <input
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="Enter website URL (e.g., google.com)"
          disabled={isLoading}
          aria-describedby="website-input-error"
        />
        <button type="submit" disabled={isLoading} className="evaluate-submit-button">
          {isLoading ? (
            <div className="loading-indicator"></div>
          ) : (
            <FontAwesomeIcon icon={faArrowRight} />
          )}
        </button>
      </div>
      {error && <p id="website-input-error" className="error-message">{error}</p>}
    </form>
  );
};

export default WebsiteInput;