import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Intercept Emscripten / WebAssembly stderr messages that route informational logs to console.error
const originalConsoleError = console.error;
console.error = function (...args) {
  const msg = args && args[0] ? String(args[0]) : '';
  if (
    msg.includes('Created TensorFlow Lite XNNPACK delegate') ||
    msg.includes('INFO: Created TensorFlow Lite')
  ) {
    console.info(...args);
    return;
  }
  originalConsoleError.apply(console, args);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

