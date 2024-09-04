import React, { useState } from 'react';

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

  const formatUrl = (url: string): string => {
    url = url.trim();
    if (!url.match(/^[a-zA-Z]+:\/\//)) {
      return `https://${url}`;
    }
    return url;
  };

  const isValidUrl = (url: string): boolean => {
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
        {isLoading && <div className="loading-indicator"></div>}
      </div>
      <button type="submit" disabled={isLoading}>
        Evaluate
      </button>
      {error && <p id="website-input-error" className="error-message">{error}</p>}
    </form>
  );
};

export default WebsiteInput;