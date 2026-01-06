import React, { useState, useEffect } from 'react';
import SalesSimulationUI from '@/components/SalesSimulationUI';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2 } from 'lucide-react';
import { buildFinalFeedback } from '@/utils/salesSimulator'; // Import the main feedback builder

const SALES_SESSION_STORAGE_KEY = 'sales_session_id';

const readStoredSessionId = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(SALES_SESSION_STORAGE_KEY);
};

const storeSessionId = (value) => {
  if (typeof window === 'undefined') return;
  if (!value) {
    window.localStorage.removeItem(SALES_SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SALES_SESSION_STORAGE_KEY, value);
};

const SalesMeetingSimulator = ({ sessionId, onSessionComplete }) => {
  const { user, session } = useAuth();
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(() => sessionId || readStoredSessionId());

  useEffect(() => {
    if (sessionId && sessionId !== activeSessionId) {
      setActiveSessionId(sessionId);
      storeSessionId(sessionId);
    }
  }, [sessionId, activeSessionId]);

  useEffect(() => {
    if (!activeSessionId) {
      const stored = readStoredSessionId();
      if (stored) {
        setActiveSessionId(stored);
      }
    }
  }, [activeSessionId]);

  useEffect(() => {
    const fetchSessionData = async () => {
      if (!activeSessionId || !user) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const { data, error: fetchError } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', activeSessionId)
          .eq('user_id', user.id)
          .single();

        if (fetchError) {
          throw new Error('Nepodarilo sa načítať dáta relácie. Skontrolujte, či máte oprávnenie.');
        }

        if (!data) {
          throw new Error('Relácia nebola nájdená.');
        }
        
        setSessionData(data);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSessionData();
  }, [activeSessionId, user]);

  const handleEndSession = async (finalState, transcript) => {
    if (!activeSessionId) {
      console.error("No active session to end.");
      if (onSessionComplete) onSessionComplete(null, sessionData?.module_code);
      return;
    }
    
    // Build the detailed evaluation using the final state from the meeting
    const evaluation = buildFinalFeedback(finalState);

    const duration = sessionData.started_at 
      ? Math.floor((new Date() - new Date(sessionData.started_at)) / 1000)
      : 0;

    const updates = {
      finished_at: new Date().toISOString(),
      status: 'completed',
      score: evaluation.score, // This is now a whole number
      outcome: evaluation.score > 6 ? 'successful' : 'unsuccessful',
      feedback: { // Storing the detailed evaluation
          personalizedMessage: evaluation.personalizedMessage,
          dimensions: evaluation.dimensions,
          nextSteps: evaluation.nextSteps,
      }, 
      transcript: transcript,
      total_messages: transcript.length,
      duration_seconds: duration,
    };

    try {
      const { error: updateError } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', activeSessionId);

      if (updateError) {
        console.error("Supabase update error:", updateError);
        throw updateError;
      }
    } catch (err) {
      console.error('Error ending session:', err);
    } finally {
      // Pass the full evaluation object to the parent
      if (onSessionComplete) onSessionComplete(evaluation, sessionData?.module_code);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100">
        <Loader2 className="h-12 w-12 animate-spin text-[#B81547]" />
        <p className="ml-4 text-lg text-slate-700">Načítava sa simulácia...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100 text-red-600">
        <p>{error}</p>
      </div>
    );
  }

  if (!sessionData) {
    return (
       <div className="flex h-screen w-full items-center justify-center bg-slate-100">
         <p className="text-lg text-slate-700">Relácia nie je k dispozícii.</p>
       </div>
    );
  }

  const sessionConfig = {
    topic: sessionData.topic,
    industry: sessionData.industry,
    clientDiscType: sessionData.client_disc_type, // Correctly mapped from DB
    clientType: sessionData.client_category || 'new',
    difficulty: sessionData.difficulty,
    salesmanLevel: user?.user_metadata?.experience_level || 'beginner'
  };

  return (
    <SalesSimulationUI
      config={sessionConfig}
      onEndMeeting={handleEndSession}
      sessionId={activeSessionId}
      accessToken={session?.access_token}
    />
  );
};

export default SalesMeetingSimulator;
