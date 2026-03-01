import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Polyfill process for simple-peer (uses Node.js process in browser bundle)
if (typeof window !== 'undefined' && typeof window.process === 'undefined') {
  window.process = { env: { NODE_ENV: 'production' }, nextTick: function(fn) { setTimeout(fn, 0); } };
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);