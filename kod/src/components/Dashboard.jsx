import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { LogOut, User } from 'lucide-react';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import ModuleSelector from '@/components/ModuleSelector';
import PodcastBanner from '@/components/PodcastBanner';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const Dashboard = () => {
  const { profile, signOut, session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      const fetchDashboardData = async () => {
        setLoading(true);
        try {
          const { data: responseData, error } =
            await supabase.functions.invoke('dashboard-data');

          if (error) throw new Error(error.message || 'An unknown error occurred.');
          if (responseData.error) throw new Error(responseData.error);

          setData(responseData);
        } catch (error) {
          console.error('Error fetching dashboard data:', error.message);
          toast({
            variant: 'destructive',
            title: 'Chyba pri načítaní dát',
            description: 'Nepodarilo sa načítať dáta pre nástenku. Skúste to znova.',
          });
        } finally {
          setLoading(false);
        }
      };

      fetchDashboardData();
    }
  }, [session, toast]);

  const getInitials = (firstName, lastName) => {
    const first = firstName ? firstName.charAt(0).toUpperCase() : '';
    const last = lastName ? lastName.charAt(0).toUpperCase() : '';
    return `${first}${last}`;
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Horný „glass“ header */}
      <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img
              src="https://horizons-cdn.hostinger.com/c7c4800e-7b32-471c-852f-a05cb57f1e91/083d123c3cdbe84b7f967b880b085698.png"
              alt="Libellius logo"
              className="w-8 h-8 md:w-10 md:h-10 object-contain"
            />
            <div>
              <h1 className="font-semibold text-sm md:text-base text-slate-900">
                Libellius – LibApp
              </h1>
              <p className="text-[11px] md:text-xs text-slate-500">
                Tvoj AI pomocník pre obchod a leadership
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 md:h-10 md:w-10 rounded-full"
                >
                  <Avatar className="h-9 w-9 md:h-10 md:w-10">
                    <AvatarFallback>
                      {getInitials(profile?.first_name, profile?.last_name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {profile?.first_name} {profile?.last_name}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session?.user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Môj profil</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Odhlásiť sa</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Hlavný obsah – jeden veľký svetlý glass panel */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        <div className="rounded-3xl bg-slate-50/80 backdrop-blur border border-slate-200/70 shadow-[0_24px_60px_rgba(15,23,42,0.12)] p-6 md:p-8 space-y-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">
                Vitajte späť, {profile?.first_name || 'používateľ'}!
              </h2>
              <p className="text-slate-600 text-sm">
                Tu je prehľad vašich doterajších aktivít a výsledkov.
              </p>
            </div>
          </div>

          {loading ? (
            <DashboardSkeleton />
          ) : data ? (
            <div className="space-y-8">
              {/* DOSTUPNÉ MODULY – SALES / LEADERSHIP */}
              <ModuleSelector modules={data.modules} />

              {/* PODCAST PRESAH */}
              <PodcastBanner />
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
