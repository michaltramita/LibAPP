import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/SupabaseAuthContext';
import { Toaster } from './components/ui/toaster';

const Root = () => (
  <>
    <HashRouter>
      <AuthProvider>
        <App />
        <Toaster />
      </AuthProvider>
    </HashRouter>
  </>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <Root />
);