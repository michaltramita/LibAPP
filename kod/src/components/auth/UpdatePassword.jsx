import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const UpdatePassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  // Spracovanie recovery linku z URL (hash)
  useEffect(() => {
    const hash = window.location.hash || '';

    // 1) Ak Supabase vráti chybu (expirovaný link a pod.)
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1));
      const description =
        params.get('error_description') || 'Odkaz na zmenu hesla je neplatný.';

      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: decodeURIComponent(description.replace(/\+/g, ' ')),
      });

      navigate('/login');
      return;
    }

    // 2) Ak v hashi nie je access_token, presmeruj na login
    if (!hash.includes('access_token')) {
      navigate('/login');
      return;
    }

    // hash má tvar: #access_token=...&refresh_token=...&...
    const params = new URLSearchParams(hash.substring(1));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (!access_token) {
      navigate('/login');
      return;
    }

    // 3) Najprv zobraz formulár (užívateľ nemusí čakať na setSession)
    setIsReady(true);

    // 4) Paralelne nastav session, aby Supabase vedel, ktorý účet mení heslo
    supabase.auth
      .setSession({
        access_token,
        refresh_token,
      })
      .then(({ error }) => {
        if (error) {
          console.error('setSession error:', error);
          toast({
            variant: 'destructive',
            title: 'Chyba',
            description:
              error.message ||
              'Odkaz na zmenu hesla je neplatný alebo mu vypršala platnosť.',
          });
          navigate('/login');
        }
      });
  }, [navigate, toast]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Heslo musí mať minimálne 8 znakov.',
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Heslá sa nezhodujú.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.password,
      });

      if (error) {
        console.error('updateUser error:', error);
        toast({
          variant: 'destructive',
          title: 'Chyba',
          description:
            error.message || 'Nepodarilo sa zmeniť heslo. Skúste to znova.',
        });
        return;
      }

      toast({
        title: 'Úspech',
        description: 'Heslo bolo úspešne zmenené. Teraz sa môžete prihlásiť.',
      });

      navigate('/login');
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Nastala neočakávaná chyba. Skúste to prosím znova.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Kým nevieme, či máme validný token, zobraz len loader
  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#B81547]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Helmet>
        <title>Nové heslo | Libellius</title>
      </Helmet>

      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-lg border border-slate-100">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900">
            Nastavenie nového hesla
          </h2>
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
              autoComplete="new-password"
              value={formData.password}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, password: e.target.value }))
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
              autoComplete="new-password"
              value={formData.confirmPassword}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  confirmPassword: e.target.value,
                }))
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
