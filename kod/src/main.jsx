import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/SupabaseAuthContext';
import { Toaster } from './components/ui/toaster';

const Root = () => (
  <>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  </>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <Root />
);
