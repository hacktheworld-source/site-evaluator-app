import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';  // Add this line
import App from './App';

declare global {
  interface Window {
    React: typeof React;
    ReactDOM: any;  // Using 'any' to bypass strict typing
  }
}

// Expose React for debugging
window.React = React;
window.ReactDOM = ReactDOM;

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);