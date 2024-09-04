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
    <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <input
        type="text"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        placeholder="Enter website URL (e.g., google.com)"
        disabled={isLoading}
        aria-describedby="website-input-error"
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Evaluating...' : 'Evaluate'}
      </button>
      {error && <p id="website-input-error" style={{ color: 'red' }}>{error}</p>}
    </form>
  );
};

export default WebsiteInput;