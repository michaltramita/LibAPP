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

const UpdatePassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  // Overíme, že máme session z recovery linku
  useEffect(() => {
    const verifySession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          toast({
            variant: 'destructive',
            title: 'Neplatný odkaz',
            description:
              'Odkaz na zmenu hesla je neplatný alebo mu vypršala platnosť. Skúste si vyžiadať nový.',
          });
          navigate('/login', { replace: true });
          return;
        }

        setIsReady(true);
      } catch (err) {
        console.error('Password recovery session error:', err);
        toast({
          variant: 'destructive',
          title: 'Chyba',
          description:
            'Nepodarilo sa overiť oprávnenie na zmenu hesla. Skúste to znova.',
        });
        navigate('/login', { replace: true });
      }
    };

    verifySession();
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

    setIsSaving(true);

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
        return;
      }

      toast({
        title: 'Heslo zmenené',
        description:
          'Vaše heslo bolo úspešne zmenené. Môžete sa prihlásiť novým heslom.',
      });

      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Unexpected password update error:', err);
      toast({
        variant: 'destructive',
        title: 'Chyba',
        description: 'Nastala neočakávaná chyba pri zmene hesla.',
      });
    } finally {
      setIsSaving(false);
    }
  };

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
            disabled={isSaving}
          >
            {isSaving && (
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
