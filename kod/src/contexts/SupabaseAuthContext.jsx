import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) return null;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);
        return null;
      } 
      setProfile(data);
      return data;
    } catch (error) {
      console.error('Profile fetch exception:', error);
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    const getInitialSession = async () => {
        setLoading(true);
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        if (initialSession?.user) {
            await fetchProfile(initialSession.user.id);
        }
        setLoading(false);
    };

    getInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setLoading(true);
        setSession(newSession);
        const currentUser = newSession?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
            await fetchProfile(currentUser.id);
            if (event === 'SIGNED_IN') {
                 await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', currentUser.id);
            }
        } else {
            setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signUp = useCallback(async (data) => {
    const { email, password, ...metaData } = data;
    
    // Updated: Explicitly using the specific Hostinger preview URL for email redirection as requested.
    // This ensures that the confirmation link always points to the correct deployed environment.
    const redirectUrl = 'https://mediumpurple-monkey-230561.hostingersites.com/auth/callback';

    const { data: authData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metaData,
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error("Signup error:", error);
      // We handle the toast in the component for more specific control, 
      // but keep a generic one here just in case.
      if (error.message !== "Error sending confirmation email") {
         toast({
            variant: "destructive",
            title: "Registrácia zlyhala",
            description: error.message || "Nastala chyba pri registrácii.",
          });
      }
    }
    return { data: authData, error };
  }, [toast]);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Prihlásenie zlyhalo",
        description: "Nesprávny email alebo heslo.",
      });
    }
    return { data, error };
  }, [toast]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Odhlásenie zlyhalo",
        description: error.message,
      });
    }
    return { error };
  }, [toast]);

  const resetPasswordForEmail = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Chyba",
        description: error.message,
      });
    } else {
        toast({
          title: "Email odoslaný",
          description: "Skontrolujte si email pre inštrukcie na obnovenie hesla.",
        });
    }
    return { error };
  }, [toast]);

  const updateUserPassword = useCallback(async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast({
        variant: "destructive",
        title: "Aktualizácia hesla zlyhala",
        description: error.message,
      });
    } else {
        toast({
          title: "Heslo aktualizované",
          description: "Vaše heslo bolo úspešne zmenené.",
        });
    }
    return { error };
  }, [toast]);

  const updateProfile = useCallback(async (profileData) => {
      if (!user) return;
      const { data, error } = await supabase
        .from('users')
        .update(profileData)
        .eq('id', user.id)
        .select()
        .single();
      
      if (error) {
          toast({
              variant: "destructive",
              title: "Uloženie profilu zlyhalo",
              description: error.message,
          });
      } else {
          setProfile(data);
          toast({
              title: "Profil uložený",
              description: "Vaše údaje boli úspešne aktualizované.",
          });
      }
      return { data, error };
  }, [user, toast]);

  const value = useMemo(() => ({
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPasswordForEmail,
    updateUserPassword,
    updateProfile
  }), [user, profile, session, loading, signUp, signIn, signOut, resetPasswordForEmail, updateUserPassword, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};