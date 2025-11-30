import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/customSupabaseClient";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const UpdatePassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [initializing, setInitializing] = useState(true);   // načítavanie tokenu zo URL
  const [isSubmitting, setIsSubmitting] = useState(false);  // ukladané heslo

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  // 1. Po načítaní stránky spracuj hash a nastav Supabase session (bez blokovania UI)
  useEffect(() => {
    const initFromHash = () => {
      const hash = window.location.hash || "";

      // očakávame formát:
      // #access_token=...&refresh_token=...&type=recovery
      if (!hash.includes("access_token")) {
        toast({
          variant: "destructive",
          title: "Neplatný odkaz",
          description:
            "Chýba token pre obnovu hesla. Skúste si vyžiadať nový e-mail na obnovu hesla.",
        });
        navigate("/login");
        return;
      }

      const params = new URLSearchParams(hash.substring(1));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      if (!access_token) {
        toast({
          variant: "destructive",
          title: "Neplatný odkaz",
          description:
            "Token pre obnovu hesla nie je platný. Skúste to prosím znova.",
        });
        navigate("/login");
        return;
      }

      // Session nastavíme „na pozadí“ – nečakáme na výsledok, aby sme neviseli na spinnri
      supabase.auth
        .setSession(
          refresh_token
            ? { access_token, refresh_token }
            : { access_token }
        )
        .then(({ error }) => {
          if (error) {
            console.error("setSession error:", error);
            // len info pre používateľa, formulár necháme zobrazený
            toast({
              variant: "destructive",
              title: "Upozornenie",
              description:
                "Odkaz na obnovu hesla už nemusel byť platný. Ak zmena hesla zlyhá, požiadajte o nový e-mail.",
            });
          }
        })
        .catch((err) => {
          console.error("setSession unexpected error:", err);
        })
        .finally(() => {
          // UI vždy uvoľníme
          setInitializing(false);
        });
    };

    initFromHash();
  }, [navigate, toast]);

  // 2. Odoslanie nového hesla
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password.length < 8) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Heslo musí mať minimálne 8 znakov.",
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

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: formData.password,
      });

      if (error) {
        console.error("updateUser error:", error);
        toast({
          variant: "destructive",
          title: "Chyba pri zmene hesla",
          description:
            error.message || "Nepodarilo sa zmeniť heslo. Skúste to prosím znova.",
        });
        return;
      }

      toast({
        title: "Heslo bolo zmenené",
        description: "Teraz sa môžete prihlásiť novým heslom.",
      });

      navigate("/login");
    } catch (err) {
      console.error("updateUser unexpected error:", err);
      toast({
        variant: "destructive",
        title: "Chyba",
        description: "Nastala neočakávaná chyba pri zmene hesla.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Počas inicializácie (čítanie hash + setSession) zobrazíme loader
  if (initializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#B81547]" />
      </div>
    );
  }

  // 4. Formulár na nové heslo
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
                setFormData((prev) => ({
                  ...prev,
                  password: e.target.value,
                }))
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
            disabled={isSubmitting}
          >
            {isSubmitting && (
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
