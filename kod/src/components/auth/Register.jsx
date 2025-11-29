import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const Register = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [serverError, setServerError] = useState(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    passwordConfirm: '',
    industry: '',
    company: '',
    position: '',
    terms: false,
  });

  const validate = () => {
    if (formData.firstName.length < 2 || formData.lastName.length < 2) {
      toast({ variant: "destructive", title: "Chyba", description: "Meno a priezvisko musia mať aspoň 2 znaky." });
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({ variant: "destructive", title: "Chyba", description: "Zadajte platný email." });
      return false;
    }
    if (formData.password.length < 8 || !/\d/.test(formData.password) || !/[a-zA-Z]/.test(formData.password)) {
      toast({ variant: "destructive", title: "Chyba", description: "Heslo musí mať min. 8 znakov, obsahovať písmeno a číslo." });
      return false;
    }
    if (formData.password !== formData.passwordConfirm) {
      toast({ variant: "destructive", title: "Chyba", description: "Heslá sa nezhodujú." });
      return false;
    }
    if (!formData.terms) {
      toast({ variant: "destructive", title: "Chyba", description: "Musíte súhlasiť s podmienkami." });
      return false;
    }
    if (!formData.industry) {
      toast({ variant: "destructive", title: "Chyba", description: "Zadajte oblasť podnikania." });
      return false;
    }
    if (!formData.company) {
      toast({ variant: "destructive", title: "Chyba", description: "Zadajte názov spoločnosti." });
      return false;
    }
    if (!formData.position) {
      toast({ variant: "destructive", title: "Chyba", description: "Zadajte vašu pracovnú pozíciu." });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setIsLoading(true);
    try {
      const { data, error } = await signUp({
        email: formData.email,
        password: formData.password,
        first_name: formData.firstName,
        last_name: formData.lastName,
        industry: formData.industry,
        company: formData.company,
        position: formData.position,
      });
      
      if (!error) {
        // Check if we have an active session immediately (Email confirmation disabled or auto-confirmed)
        if (data?.session) {
            toast({
                title: "Registrácia úspešná",
                description: "Boli ste úspešne prihlásený.",
            });
            navigate('/dashboard');
        } else {
            // No session, so email confirmation is likely required by Supabase
            setIsSubmitted(true);
        }
      } else {
        // Handle specific SMTP error
        if (error.message === "Error sending confirmation email") {
          setServerError("Nepodarilo sa odoslať potvrdzovací email. Skúste to prosím znova neskôr alebo kontaktujte podporu.");
        } else {
          setServerError(error.message || "Nastala neočakávaná chyba.");
        }
      }
    } catch (err) {
      console.error(err);
      setServerError("Nastala chyba pri komunikácii so serverom.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
       <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Helmet>
            <title>Potvrďte registráciu | LibApp</title>
        </Helmet>
        <div className="w-full max-w-md space-y-6 bg-white p-8 rounded-2xl shadow-lg border border-slate-100 text-center">
             <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
             </div>
             <h2 className="text-2xl font-bold text-slate-900">Skontrolujte si email</h2>
             <p className="text-slate-600">
                Poslali sme vám potvrdzovací odkaz na <br/>
                <span className="font-semibold text-slate-800">{formData.email}</span>
             </p>
             <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg text-left space-y-2">
                <p className="font-medium text-slate-700">Nevidíte email?</p>
                <ul className="list-disc pl-4 space-y-1">
                    <li>Skontrolujte priečinok Spam alebo Nevyžiadaná pošta.</li>
                    <li>Chvíľu počkajte, doručenie môže trvať niekoľko minút.</li>
                </ul>
             </div>
             <div className="pt-4">
                 <Link to="/login" className="text-[#B81547] hover:underline font-medium text-sm">
                    Späť na prihlásenie
                 </Link>
             </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Helmet>
        <title>Registrácia | LibApp</title>
      </Helmet>
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-lg border border-slate-100">
        <div className="text-center">
          <img 
            src="https://horizons-cdn.hostinger.com/c7c4800e-7b32-471c-852f-a05cb57f1e91/ab4d624ec565fdd77f17ba44828d378d.png" 
            alt="Libellius logo: red and blue circle with text 'LIBELLIUS HEALTHY BUSINESS MATTERS'"
            className="mx-auto mb-4 w-auto max-h-[60px]" 
           />
          <h2 className="text-3xl font-bold text-[#B81547]">LibApp</h2>
          <p className="mt-2 text-slate-600">Vytvorte si nový účet</p>
        </div>

        {serverError && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Chyba registrácie</AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
            </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Meno</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Priezvisko</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="industry">Oblasť / Priemysel</Label>
              <Input
                id="industry"
                placeholder="napr. IT"
                value={formData.industry}
                onChange={(e) => setFormData({...formData, industry: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Spoločnosť</Label>
              <Input
                id="company"
                placeholder="Názov firmy"
                value={formData.company}
                onChange={(e) => setFormData({...formData, company: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Pozícia</Label>
            <Input
              id="position"
              placeholder="napr. Obchodný zástupca"
              value={formData.position}
              onChange={(e) => setFormData({...formData, position: e.target.value})}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
              <Label htmlFor="password">Heslo</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordConfirm">Potvrdenie hesla</Label>
              <Input
                id="passwordConfirm"
                type="password"
                value={formData.passwordConfirm}
                onChange={(e) => setFormData({...formData, passwordConfirm: e.target.value})}
                required
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox 
              id="terms" 
              checked={formData.terms}
              onCheckedChange={(checked) => setFormData({...formData, terms: checked})}
            />
            <label
              htmlFor="terms"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Súhlasím s podmienkami používania
            </label>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-[#B81547] hover:bg-[#9e123d] text-white"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Registrovať sa
          </Button>
        </form>

        <div className="text-center text-sm">
          Už máte účet?{' '}
          <Link to="/login" className="text-[#B81547] hover:underline font-medium">
            Prihláste sa
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;