// src/components/auth/UpdatePassword.jsx
import React, { useEffect, useState } from 'react';
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

  const [initializing, setInitializing] = useState(true); // spracovanie tokenu z URL
  const [saving, setSaving] = useState(false);            // ukladanie nového hesla
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  // 1) Spracovanie access_token a refresh_token z URL hash
  useEffect(() => {
    const initRecoverySession = async () => {
      try {
        const hash = window.location.hash || '';

        // očakávame tvar: #access_token=...&refresh_token=...&type=recovery
        if (!hash.includes('access_token')) {
          toast({
            variant: 'destructive',
            title: 'Neplatný odkaz',
            description:
              'Odkaz na zmenu hesla je neplatný alebo mu vypršala platnosť. Skúste si vyžiadať nový.',
          });
          navigate('/login', { replace: true });
          return;
        }

        const hashString = hash.startsWith('#') ? hash.slice(1) : hash;
        const params = new URLSearchParams(hashString);

        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token') || '';

        if (!access_token || !refresh_token) {
          toast({
            variant: 'destructive',
            title: 'Neúplný odkaz',
            description:
              'V odkaze chýbajú údaje potrebné na zmenu hesla. Skúste si vyžiadať nový odkaz.',
          });
          navigate('/login', { replace: true });
          return;
        }

        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) {
          console.error('setSession error:', error);
          toast({
            variant: 'destructive',
            title: 'Chyba prihlásenia',
            description:
              error.message ||
              'Nepodarilo sa overiť odkaz na zmenu hesla. Skúste si vyžiadať nový.',
          });
          navigate('/login', { replace: true });
          return;
        }

        // session je nastavená, môžeme zobraziť formulár
        setInitializing(false);
      } catch (err) {
        console.error('Unexpected init error:', err);
        toast({
          variant: 'destructive',
          title: 'Chyba',
          description: 'Nastala neočakávaná chyba pri spracovaní odkazu.',
        });
        navigate('/login', { replace: true });
      }
    };

    initRecoverySession();
  }, [navigate, toast]);

  // 2) Odoslanie formulára – samotná zmena hesla
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

    setSaving(true);

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
            error.message ||
            'Nepodarilo sa zmeniť heslo. Skúste to prosím znova.',
        });
        setSaving(false);
        return;
      }

      toast({
        title: 'Heslo zmenené',
        description:
          'Vaše heslo bolo úspešne zmenené. Teraz sa môžete prihlásiť novým heslom.',
      });

      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Unexpected password update error:', err);
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Nastala neočakávaná chyba pri zmene hesla.',
      });
      setSaving(false);
    }
  };

  // 3) Loader počas spracovania tokenu
  if (initializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#B81547]" />
      </div>
    );
  }

  // 4) Formulár na nové heslo
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
            disabled={saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Uložiť nové heslo
          </Button>
        </form>
      </div>
    </div>
  );
};

export default UpdatePassword;
