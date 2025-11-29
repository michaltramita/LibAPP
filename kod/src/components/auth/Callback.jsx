import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2 } from 'lucide-react';

const Callback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const process = async () => {
      try {
        const rawHash = window.location.hash || "";

        // Rozdelíme hash na časti
        // #/auth/update-password#access_token=XYZ&type=recovery
        const parts = rawHash.split("#");

        const routerHash = parts.find(p => p.startsWith("/"));
        const tokenHash = parts.find(p => p.startsWith("access_token"));

        const isRecovery =
          (tokenHash && tokenHash.includes("type=recovery")) ||
          rawHash.includes("type=recovery");

        // RESET HESLA → presmeruj na stránku update-password
        if (isRecovery) {
          navigate("/auth/update-password");
          return;
        }

        // Počkaj na session
        const { data: { session } } = await supabase.auth.getSession();

        // Normálne prihlásenie
        if (session) {
          navigate("/dashboard");
          return;
        }

        // Ak nič nesedí → login
        navigate("/login");

      } catch (err) {
        console.error("Callback error:", err);
        navigate("/login");
      }
    };

    process();
  }, [navigate]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#B81547] mx-auto mb-4" />
        <p className="text-slate-600">Spracovávam prihlásenie...</p>
      </div>
    </div>
  );
};

export default Callback;