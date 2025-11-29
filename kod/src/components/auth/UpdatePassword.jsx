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
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const hash = window.location.hash;

    let access_token = null;
    let refresh_token = null;

    // Case 1: Supabase sends url with two hashes
    // #/auth/update-password#access_token=...&refresh_token=...&type=recovery
    if (hash.includes("#access_token")) {
      const parts = hash.split("#");
      if (parts.length >= 3) {
        const params = new URLSearchParams(parts[2]);
        access_token = params.get("access_token");
        refresh_token = params.get("refresh_token");
      }
    }

    // Case 2: Hostinger Horizons format
    // #/auth/update-password?token=XYZ&type=recovery
    if (!access_token) {
      const query = hash.split("?")[1];
      if (query) {
        const params = new URLSearchParams(query);
        const token = params.get("token");
        if (token) {
          access_token = token;
        }
      }
    }

    if (!access_token) {
      navigate("/login");
      return;
    }

    supabase.auth.setSession({
      access_token,
      refresh_token,
    }).then(() => {
      setIsReady(true);
    });

  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password.length < 8) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Heslo musí mať min. 8 znakov."
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Heslá sa nezhodujú."
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.password,
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "Chyba",
          description: error.message,
        });
        return;
      }

      toast({ title: "Úspech", description: "Heslo bolo úspešne zmenené." });
      navigate("/login");

    } catch (err) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nastala neočakávaná chyba.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center">
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
