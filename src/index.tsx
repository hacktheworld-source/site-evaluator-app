import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

declare global {
  interface Window {
    React: typeof React;
    ReactDOM: any;
  }
}

console.log('Index.tsx started executing');

// Expose React for debugging
window.React = React;
window.ReactDOM = ReactDOM;

console.log('React exposed to window');

try {
  console.log('Attempting to get root element');
  const rootElement = document.getElementById('root');
  console.log('Root element found:', rootElement);
  
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  console.log('Creating React root');
  const root = ReactDOM.createRoot(rootElement);
  console.log('Root created');

  console.log('Starting render');
  root.render(
    <App />
  );
  console.log('Render called');
} catch (error: unknown) {
  console.error('Error during React initialization:', error);
  if (error instanceof Error) {
    console.error('Error stack:', error.stack);
  }
}