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

  const [isReady, setIsReady] = useState(false);   // či už máme platnú session
  const [isLoading, setIsLoading] = useState(false); // loading pri Uložení hesla
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  // 1) Po načítaní stránky z URL vytiahni tokeny a nastav Supabase session
  useEffect(() => {
    const initRecoverySession = async () => {
      try {
        // hash je vo formáte:
        // #access_token=...&expires_at=...&refresh_token=...&type=recovery
        const rawHash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash;

        if (!rawHash) {
          toast({
            variant: 'destructive',
            title: 'Chyba odkazu',
            description: 'Odkaz na obnovenie hesla je neplatný.',
          });
          navigate('/login');
          return;
        }

        const params = new URLSearchParams(rawHash);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        const type = params.get('type');

        if (!access_token || type !== 'recovery') {
          toast({
            variant: 'destructive',
            title: 'Chyba odkazu',
            description: 'Odkaz na obnovenie hesla je neplatný alebo expiroval.',
          });
          navigate('/login');
          return;
        }

        // nastavíme session z recovery tokenu
        const { error } = await supabase.auth.setSession({
          access_token,
          // refresh_token môže byť null – vtedy pošleme prázdny string
          refresh_token: refresh_token ?? '',
        });

        if (error) {
          console.error('Supabase setSession error:', error);
          toast({
            variant: 'destructive',
            title: 'Chyba prihlásenia',
            description: 'Odkaz na obnovenie hesla je neplatný alebo expiroval.',
          });
          navigate('/login');
          return;
        }

        // session OK → môžeme ukázať formulár
        setIsReady(true);
      } catch (err) {
        console.error('Init recovery session error:', err);
        toast({
          variant: 'destructive',
          title: 'Chyba',
          description: 'Nepodarilo sa načítať obnovu hesla.',
        });
        navigate('/login');
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
        description: 'Heslo musí mať aspoň 8 znakov.',
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
        console.error('Supabase updateUser error:', error);
        toast({
          variant: 'destructive',
          title: 'Chyba',
          description: error.message || 'Nepodarilo sa zmeniť heslo.',
        });
        return;
      }

      toast({
        title: 'Heslo zmenené',
        description: 'Vaše heslo bolo úspešne zmenené. Môžete sa prihlásiť.',
      });

      navigate('/login');
    } catch (err) {
      console.error('Unexpected update password error:', err);
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Nastala neočakávaná chyba pri zmene hesla.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Kým nemáme platnú session z recovery linku, zobraz spinner
  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-[#B81547]" />
      </div>
    );
  }

  // 3) UI formulár
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
