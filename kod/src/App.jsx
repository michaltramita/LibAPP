import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
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

// Wrapper component to extract sessionId from URL and pass it to the simulator
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
  const [isIntroComplete, setIntroComplete] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // R outy, na ktorých nechceme zobrazovať IntroOverlay
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
    if (!session) {
      navigate('/login');
    }
  };

  // Dôležité: intro NEzobrazujeme na auth routach (vrátane reset hesla)
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

      <Routes>
        {/* Public / auth routy */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Reset hesla */}
        <Route path="/auth/update-password" element={<UpdatePassword />} />
        <Route path="/auth/callback" element={<Callback />} />

        {/* Starší link bez /auth – presmerujeme */}
        <Route
          path="/update-password"
          element={<Navigate to="/auth/update-password" replace />}
        />

        {/* Chránené routy */}
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

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

export default App;
