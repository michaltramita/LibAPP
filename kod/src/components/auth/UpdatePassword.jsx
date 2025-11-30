import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// 1) Supabase URL a anon key
// Najprv skúsime Vite env (Vercel), ak nie sú, použijeme hodnoty z customSupabaseClient
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://nzocogzhakmqwiifrjuk.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56b2NvZ3poYWttcXdpaWZyanVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNDE1NDcsImV4cCI6MjA3OTcxNzU0N30.nxlVycIOhyd7Zn9zXLhSP6FMhJfYvFdiIzReFRUHkHY";

const UpdatePassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState(null);

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  // 2) Pri načítaní stránky si len uložíme access_token z hash časti URL
  useEffect(() => {
    const hash = window.location.hash || "";

    // Očakávame: #access_token=...&expires_at=...&refresh_token=...&type=recovery
    if (!hash.includes("access_token")) {
      console.error("UpdatePassword: hash neobsahuje access_token", hash);
      navigate("/login");
      return;
    }

    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get("access_token");

    if (!accessToken) {
      console.error("UpdatePassword: access_token sa nepodarilo prečítať", hash);
      navigate("/login");
      return;
    }

    setRecoveryToken(accessToken);
    setIsReady(true);
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!recoveryToken) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Link na zmenu hesla je neplatný alebo vypršal.",
      });
      navigate("/login");
      return;
    }

    if (formData.password.length < 8) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Heslo musí mať min. 8 znakov.",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Heslá sa nezhodujú.",
      });
      return;
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("UpdatePassword: chýba SUPABASE_URL alebo SUPABASE_ANON_KEY", {
        SUPABASE_URL,
        hasKey: !!SUPABASE_ANON_KEY,
      });
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Chýba konfigurácia Supabase (URL alebo anon key).",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT", // Supabase podporuje PUT na /auth/v1/user
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${recoveryToken}`,
        },
        body: JSON.stringify({
          password: formData.password,
        }),
      });

      if (!response.ok) {
        let errorBody = null;
        try {
          errorBody = await response.json();
        } catch (_) {
          // nič
        }

        console.error("UpdatePassword: Supabase response error", {
          status: response.status,
          errorBody,
        });

        const message =
          errorBody?.message ||
          "Nepodarilo sa zmeniť heslo. Skúste to znova alebo si vyžiadajte nový link.";

        toast({
          variant: "destructive",
          title: "Chyba",
          description: message,
        });
        return;
      }

      toast({
        title: "Úspech",
        description: "Heslo bolo úspešne zmenené. Môžete sa prihlásiť.",
      });

      navigate("/login");
    } catch (err) {
      console.error("UpdatePassword: network/unknown error", err);
      toast({
        variant: "destructive",
        title: "Chyba",
        description:
          "Nastala neočakávaná chyba pri komunikácii so serverom. Skúste to prosím znova.",
      });
    } finally {
      setIsLoading(false);
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
