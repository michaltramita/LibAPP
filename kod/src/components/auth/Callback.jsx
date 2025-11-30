import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2 } from 'lucide-react';

const Callback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let subscription;

    const run = async () => {
      try {
        const hash = window.location.hash || '';
        const hashString = hash.startsWith('#') ? hash.slice(1) : hash;
        const params = new URLSearchParams(hashString);
        const type = params.get('type'); // napr. 'recovery'

        // 1) Skúsime hneď zistiť session
        const { data: { session } } = await supabase.auth.getSession();

        // Ak už máme session v momente načítania
        if (session) {
          if (type === 'recovery') {
            navigate('/update-password', { replace: true });
            return;
          }
          navigate('/dashboard', { replace: true });
          return;
        }

        // 2) Ak session ešte nie je, počkáme na auth eventy
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY') {
            // Supabase oznámil recovery flow
            navigate('/update-password', { replace: true });
          } else if (event === 'SIGNED_IN') {
            const currentHash = window.location.hash || '';
            if (currentHash.includes('type=recovery')) {
              navigate('/update-password', { replace: true });
            } else {
              navigate('/dashboard', { replace: true });
            }
          } else if (event === 'SIGNED_OUT') {
            navigate('/login', { replace: true });
          }
        });

        subscription = data.subscription;
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/login', { replace: true });
      }
    };

    run();

    return () => {
      subscription?.unsubscribe();
    };
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
