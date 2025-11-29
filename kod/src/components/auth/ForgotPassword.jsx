import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft } from 'lucide-react';

const ForgotPassword = () => {
  const { resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error } = await resetPasswordForEmail(email);
      if (!error) {
        setIsSent(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Helmet>
        <title>Obnova hesla | Libellius</title>
      </Helmet>
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-lg border border-slate-100">
        <div className="text-center">
          <img-replace 
            src="https://horizons-cdn.hostinger.com/c7c4800e-7b32-471c-852f-a05cb57f1e91/ab4d624ec565fdd77f17ba44828d378d.png" 
            alt="Libellius logo: red and blue circle with text 'LIBELLIUS HEALTHY BUSINESS MATTERS'"
            className="mx-auto mb-4 w-auto max-h-[60px]" 
          />
          <h2 className="text-2xl font-bold text-slate-900">Obnova hesla</h2>
          <p className="mt-2 text-slate-600 text-sm">
            Zadajte svoj email a my vám pošleme inštrukcie na obnovenie hesla.
          </p>
        </div>

        {!isSent ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="vas@email.sk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-[#B81547] hover:bg-[#9e123d] text-white"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Odoslať link na obnovu
            </Button>
          </form>
        ) : (
          <div className="text-center space-y-4">
            <div className="bg-green-50 text-green-800 p-4 rounded-lg text-sm">
              Email bol úspešne odoslaný! Skontrolujte si schránku.
            </div>
            <Button 
              variant="outline"
              onClick={() => setIsSent(false)}
              className="w-full"
            >
              Odoslať znova
            </Button>
          </div>
        )}

        <div className="text-center">
          <Link to="/login" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Späť na prihlásenie
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;