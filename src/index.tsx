import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { toast } from 'react-toastify';

declare global {
  interface Window {
    React: typeof React;
    ReactDOM: any;
    debugToast: (type: 'success' | 'error' | 'info' | 'warning', message: string, duration?: number) => void;
  }
}

console.log('Index.tsx started executing');

// Expose React and toast helper for debugging
window.React = React;
window.ReactDOM = ReactDOM;
window.debugToast = (type, message, duration = 4000) => {
  if (toast[type]) {
    toast[type](message, { autoClose: duration });
  } else {
    console.error('Invalid toast type. Use: success, error, info, or warning');
  }
};

console.log('React and debug helpers exposed to window');

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