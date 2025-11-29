import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

const Login = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error } = await signIn(formData.email, formData.password);
      if (!error) {
        navigate(from, { replace: true });
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
        <title>Prihlásenie | Libellius</title>
      </Helmet>
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-2xl shadow-lg border border-slate-100">
        <div className="text-center">
          <img
            class="mx-auto mb-4 w-auto max-h-[60px]"
            alt="Libellius logo: red and blue circle with text 'LIBELLIUS HEALTHY BUSINESS MATTERS'"
            src="https://imgur.com/uIFVoDI.png" />
          <h2 className="text-3xl font-bold text-[#B81547]">LibApp</h2>
          <p className="mt-2 text-slate-600">Vitajte späť! Prihláste sa do svojho účtu.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="vas@email.sk"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Heslo</Label>
              <Link 
                to="/forgot-password" 
                className="text-sm text-[#B81547] hover:underline"
              >
                Zabudli ste heslo?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox 
              id="remember" 
              checked={formData.rememberMe}
              onCheckedChange={(checked) => setFormData({...formData, rememberMe: checked})}
            />
            <label
              htmlFor="remember"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Zapamätať si ma
            </label>
          </div>

          <Button 
            type="submit" 
            className="w-full bg-[#B81547] hover:bg-[#9e123d] text-white"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Prihlásiť sa
          </Button>
        </form>

        <div className="text-center text-sm">
          Nemáte ešte účet?{' '}
          <Link to="/register" className="text-[#B81547] hover:underline font-medium">
            Zaregistrujte sa
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;