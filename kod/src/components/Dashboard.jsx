import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { LogOut, BarChart2, User } from 'lucide-react';
import DashboardStats from '@/components/DashboardStats';
import RecentSessions from '@/components/RecentSessions';
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
          const { data: responseData, error } = await supabase.functions.invoke(
            'dashboard-data'
          );

          if (error) throw new Error(error.message || 'An unknown error occurred.');
          if (responseData.error) throw new Error(responseData.error);

          setData(responseData);
        } catch (error) {
          console.error('Error fetching dashboard data:', error.message);
          toast({
            variant: 'destructive',
            title: 'Chyba pri načítaní dát',
            description:
              'Nepodarilo sa načítať dáta pre nástenku. Skúste to znova.',
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
    <div className="min-h-[70vh] flex flex-col gap-6">
      {/* Header ako glass panel */}
      <header className="rounded-3xl border border-white/15 bg-white/10 bg-gradient-to-br from-white/15 via-white/5 to-white/0 backdrop-blur-xl shadow-2xl shadow-black/40 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img
            src="https://horizons-cdn.hostinger.com/c7c4800e-7b32-471c-852f-a05cb57f1e91/083d123c3cdbe84b7f967b880b085698.png"
            alt="Libellius logo"
            className="w-10 h-10 object-contain"
          />
          <div>
            <h1 className="font-bold text-lg leading-tight text-slate-50">
              Libellius - LibApp
            </h1>
            <p className="text-xs text-slate-200/80">Tvoj AI pomocník</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full hover:bg-white/10"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    {getInitials(profile?.first_name, profile?.last_name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56"
              align="end"
              forceMount
            >
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-slate-900">
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
      </header>

      {/* Hlavný obsah v jednom väčšom glass paneli */}
      <main>
        <div className="rounded-3xl border border-white/15 bg-white/10 bg-gradient-to-br from-white/15 via-white/5 to-white/0 backdrop-blur-xl shadow-2xl shadow-black/40 p-6 lg:p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-50 mb-2">
                Vitajte späť, {profile?.first_name || 'používateľ'}!
              </h2>
              <p className="text-slate-200/90">
                Tu je prehľad vašich doterajších aktivít a výsledkov.
              </p>
            </div>
          </div>

          {loading ? (
            <DashboardSkeleton />
          ) : data ? (
            <div className="space-y-8">
              {data.summary_stats.total_sessions > 0 ? (
                <>
                  <DashboardStats stats={data.summary_stats} />
                  <RecentSessions sessions={data.recent_sessions} />
                </>
              ) : (
                <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-white/30 bg-white/5">
                  <BarChart2 className="mx-auto h-12 w-12 text-slate-200/80" />
                  <h3 className="mt-4 text-xl font-semibold text-slate-50">
                    Zatiaľ žiadne dáta
                  </h3>
                  <p className="mt-2 text-slate-200/80">
                    Absolvujte svoje prvé simulované stretnutie a sledujte svoj
                    pokrok.
                  </p>
                </div>
              )}

              <ModuleSelector modules={data.modules} />
              <PodcastBanner />
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
