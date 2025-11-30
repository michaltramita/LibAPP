// src/components/auth/UpdatePassword.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

function getHashParams() {
  // Môžeš mať rôzne tvary:
  // 1) /update-password#access_token=...
  // 2) /#/update-password#access_token=...
  // 3) /#/update-password?token=...
  // 4) /update-password#token=...
  let hash = window.location.hash || '';

  // odstránime prvé #
  if (hash.startsWith('#')) {
    hash = hash.slice(1); // napr. "access_token=..." alebo "/update-password#access_token=..."
  }

  // ak je tam ešte jedno '#', vezmeme časť až za ním (HashRouter route + hash Supabase)
  const secondHashIndex = hash.indexOf('#');
  if (secondHashIndex !== -1) {
    hash = hash.slice(secondHashIndex + 1); // "access_token=..."
  }

  // ak je tam path + query (napr. "/update-password?token=...")
  if (hash.includes('?')) {
    hash = hash.split('?')[1];
  }

  return new URLSearchParams(hash);
}

const UpdatePassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  // 1) Po mountnutí spracujeme token z URL a nastavíme Supabase session
  useEffect(() => {
    const init = async () => {
      try {
        const params = getHashParams();

        const access_token =
          params.get('access_token') || // Supabase štandard
          params.get('token');          // fallback, keby bol iný template

        const refresh_token = params.get('refresh_token') || '';
        const type = params.get('type'); // "recovery" pri obnove hesla

        if (!access_token) {
          console.error('Nebolo možné nájsť token v hash URL:', window.location.hash);
          toast({
            variant: 'destructive',
            title: 'Neplatný odkaz',
            description: 'Odkaz na obnovu hesla je neplatný alebo poškodený. Skúste si vyžiadať nový.'
          });
          navigate('/login');
          return;
        }

        if (type && type !== 'recovery') {
          toast({
            variant: 'destructive',
            title: 'Neplatný odkaz',
            description: 'Tento odkaz neslúži na obnovu hesla. Skúste sa prihlásiť alebo vyžiadať nový odkaz.'
          });
          navigate('/login');
          return;
        }

        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          console.error('Supabase setSession error:', error);
          toast({
            variant: 'destructive',
            title: 'Odkaz expiroval',
            description: 'Odkaz na obnovu hesla už pravdepodobne expiroval. Skúste si vyžiadať nový.'
          });
          navigate('/login');
          return;
        }

        // všetko OK → zobraz formulár
        setIsReady(true);
      } catch (err) {
        console.error('Chyba pri inicializácii stránky na obnovu hesla:', err);
        toast({
          variant: 'destructive',
          title: 'Chyba',
          description: 'Nepodarilo sa načítať stránku na zmenu hesla. Skúste to znova alebo si vyžiadajte nový odkaz.'
        });
        navigate('/login');
      }
    };

    init();
  }, [navigate, toast]);

  // 2) Odoslanie nového hesla
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Heslo musí mať minimálne 8 znakov.'
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Heslá sa nezhodujú.'
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.password,
      });

      if (error) {
        console.error('Supabase updateUser error:', error);
        toast({
          variant: 'destructive',
          title: 'Chyba pri zmene hesla',
          description: error.message || 'Nepodarilo sa zmeniť heslo. Skúste to prosím znova.'
        });
        return;
      }

      toast({
        title: 'Heslo zmenené',
        description: 'Vaše heslo bolo úspešne zmenené. Môžete sa prihlásiť novým heslom.'
      });

      navigate('/login');
    } catch (err) {
      console.error('Neočakávaná chyba pri zmene hesla:', err);
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Nastala neočakávaná chyba. Skúste to prosím znova.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 3) Kým nemáme potvrdenú session, ukážeme len spinner (max pár sekúnd)
  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#B81547]" />
      </div>
    );
  }

  // 4) Formulár na zadanie nového hesla
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Helmet>
        <title>Nové heslo | Libellius</title>
      </Helmet>

      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-lg border border-slate-100">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900">Nastavenie nového hesla</h2>
          <p className="mt-2 text-slate-600 text-sm">
            Zadajte svoje nové heslo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="password">Nové heslo</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
              placeholder="Min. 8 znakov"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Potvrdiť heslo</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) =>
                setFormData({ ...formData, confirmPassword: e.target.value })
              }
              required
              placeholder="Zopakujte heslo"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-[#B81547] hover:bg-[#9e123d] text-white"
            disabled={isLoading}
          >
            {isLoading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Uložiť nové heslo
          </Button>
        </form>
      </div>
    </div>
  );
};

export default UpdatePassword;
