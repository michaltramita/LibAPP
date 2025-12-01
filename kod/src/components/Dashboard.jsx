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
    if (!session) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const { data: responseData, error } = await supabase.functions.invoke(
          'dashboard-data'
        );

        if (error) throw new Error(error.message || 'An unknown error occurred.');
        if (responseData?.error) throw new Error(responseData.error);

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
  }, [session, toast]);

  const getInitials = (firstName, lastName) => {
    const first = firstName ? firstName.charAt(0).toUpperCase() : '';
    const last = lastName ? lastName.charAt(0).toUpperCase() : '';
    return `${first}${last}`;
  };

  return (
    <div className="min-h-screen px-4 py-4 md:px-8 md:py-6">
      {/* Glass header bar */}
      <header className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between rounded-full bg-white/5 border border-white/10 shadow-[0_18px_60px_rgba(15,23,42,0.65)] backdrop-blur-2xl px-4 py-2 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 border border-white/20 shadow-inner">
              <img
                src="https://horizons-cdn.hostinger.com/c7c4800e-7b32-471c-852f-a05cb57f1e91/083d123c3cdbe84b7f967b880b085698.png"
                alt="Libellius logo"
                className="h-6 w-6 object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-200/80">
                Libellius – LibApp
              </p>
              <p className="text-[11px] text-slate-300/70">
                Tvoj AI pomocník pre obchod a leadership
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/20"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-[#B81547]/10 text-slate-50">
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
      </header>

      {/* Main glass card */}
      <main className="max-w-7xl mx-auto">
        <div className="rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-2xl shadow-[0_24px_80px_rgba(15,23,42,0.75)] px-5 py-6 md:px-8 md:py-8">
          <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-2 mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-semibold text-slate-50 mb-1">
                Vitajte späť, {profile?.first_name || 'používateľ'}!
              </h2>
              <p className="text-sm text-slate-200/80">
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
                <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-white/20 bg-slate-900/30">
                  <BarChart2 className="mx-auto h-10 w-10 text-slate-300/70" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-50">
                    Zatiaľ žiadne dáta
                  </h3>
                  <p className="mt-2 text-sm text-slate-200/80">
                    Absolvujte svoje prvé simulované stretnutie a sledujte svoj pokrok.
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
