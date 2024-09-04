import React, { useState } from 'react';

interface WebsiteInputProps {
  onSubmit: (website: string) => void;
  isLoading: boolean;
}

const WebsiteInput: React.FC<WebsiteInputProps> = ({ onSubmit, isLoading }) => {
  const [website, setWebsite] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidUrl(website)) {
      onSubmit(website);
      setError('');
    } else {
      setError('Please enter a valid URL');
    }
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
    <form onSubmit={handleSubmit}>
      <label htmlFor="website-input">Website URL:</label>
      <input
        id="website-input"
        type="text"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        placeholder="Enter website URL"
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