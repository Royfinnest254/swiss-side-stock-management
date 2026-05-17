import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#0f172a',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            boxShadow: '0 10px 30px -5px rgba(163, 94, 69, 0.1)',
            border: '1px solid #f1f5f9'
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
