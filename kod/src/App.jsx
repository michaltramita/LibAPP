import React, { useState } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  useLocation,
} from 'react-router-dom';
import { Helmet } from 'react-helmet';

import { useAuth } from '@/contexts/SupabaseAuthContext';
import RequireAuth from '@/components/RequireAuth';

import IntroOverlay from '@/components/IntroOverlay';
import Login from '@/components/auth/Login';
import Register from '@/components/auth/Register';
import ForgotPassword from '@/components/auth/ForgotPassword';
import UpdatePassword from '@/components/auth/UpdatePassword';
import Callback from '@/components/auth/Callback';
import Dashboard from '@/components/Dashboard';
import SalesMeetingSimulator from '@/components/SalesMeetingSimulator';
import ModuleDetail from '@/components/ModuleDetail';
import ProfilePage from '@/components/ProfilePage';
import FeedbackPanel from '@/components/FeedbackPanel';

// Stránka pre simuláciu – buď beží simulátor, alebo zobrazíme feedback
const SimulationPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [evaluation, setEvaluation] = useState(null);
  const [moduleCode, setModuleCode] = useState(null);

  const handleSessionComplete = (evalData, modCode) => {
    setEvaluation(evalData);
    setModuleCode(modCode);
  };

  const handleRestart = () => {
    navigate(`/modules/${moduleCode || 'OR01'}`);
  };

  const handleReturnToDashboard = () => {
    navigate('/dashboard');
  };

  if (evaluation) {
    return (
      <FeedbackPanel
        evaluation={evaluation}
        onRestart={handleRestart}
        onReturnToDashboard={handleReturnToDashboard}
      />
    );
  }

  return (
    <SalesMeetingSimulator
      sessionId={sessionId}
      onSessionComplete={handleSessionComplete}
    />
  );
};

function App() {
  const [isIntroComplete, setIntroComplete] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('introSeen') === '1';
    }
    return false;
  });

  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const authRoutes = [
    '/login',
    '/register',
    '/forgot-password',
    '/update-password',
    '/auth/update-password',
    '/auth/callback',
  ];

  const shouldSkipIntro = authRoutes.includes(location.pathname);

  const handleIntroComplete = () => {
    setIntroComplete(true);

    if (typeof window !== 'undefined') {
      localStorage.setItem('introSeen', '1');
    }

    if (!session) {
      navigate('/login');
    } else {
      navigate('/dashboard');
    }
  };

  if (!isIntroComplete && !shouldSkipIntro) {
    return <IntroOverlay onComplete={handleIntroComplete} />;
  }

  return (
    <>
      <Helmet>
        <title>Libellius - Virtuálny zákazník</title>
        <meta
          name="description"
          content="Interaktívna aplikácia na simuláciu obchodných stretnutí na precvičenie predajných zručností."
        />
      </Helmet>

      {/* Globálne biele pozadie aplikácie */}
      <div className="min-h-screen bg-white text-slate-900">
        <Routes>
          {/* Auth stránky */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          <Route path="/auth/update-password" element={<UpdatePassword />} />
          <Route path="/auth/callback" element={<Callback />} />

          {/* Chránené sekcie */}
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />

          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />

          <Route
            path="/modules/:moduleCode"
            element={
              <RequireAuth>
                <ModuleDetail />
              </RequireAuth>
            }
          />

          <Route
            path="/session/:sessionId"
            element={
              <RequireAuth>
                <SimulationPage />
              </RequireAuth>
            }
          />

          {/* Default a fallback */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </>
  );
}

export default App;
