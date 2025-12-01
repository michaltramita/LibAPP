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
import GlassPanel from '@/components/GlassPanel';

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
    <div className="min-h-screen bg-gradient-to-b from-[#B81457] via-[#B81457] to-[#5f0930] text-slate-50">
      {/* Horný „liquid glass“ header */}
      <header className="px-4 pt-4">
        <GlassPanel className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-xs font-semibold text-white">
                L
              </span>
            </div>
            <div>
              <h1 className="font-semibold text-sm md:text-base tracking-[0.16em] uppercase text-white/80">
                Libellius – LibApp
              </h1>
              <p className="text-[11px] md:text-xs text-white/70">
                Tvoj AI pomocník pre obchod a leadership
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 w-9 md:h-10 md:w-10 rounded-full bg-white/10 hover:bg-white/20"
              >
                <Avatar className="h-9 w-9 md:h-10 md:w-10">
                  <AvatarFallback className="bg-transparent text-white text-sm">
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
        </GlassPanel>
      </header>

      {/* Hlavný „sklený“ obsah */}
      <main className="px-4 pb-10">
        <GlassPanel className="max-w-7xl mx-auto mt-6 p-6 md:p-8 space-y-8">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Vitajte späť, {profile?.first_name || 'používateľ'}.
              </h2>
              <p className="text-sm text-white/80">
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
                <div className="text-center py-10 px-4 rounded-3xl border border-dashed border-white/35 bg-black/10">
                  <BarChart2 className="mx-auto h-10 w-10 text-white/70" />
                  <h3 className="mt-4 text-lg font-semibold text-white">
                    Zatiaľ žiadne dáta
                  </h3>
                  <p className="mt-2 text-sm text-white/80">
                    Absolvujte svoje prvé simulované stretnutie a sledujte svoj pokrok.
                  </p>
                </div>
              )}

              {/* Dostupné moduly rozdelené na SALES / LEADERSHIP */}
              <ModuleSelector modules={data.modules} />

              {/* Podcast PRESAH – sklený panel, zarovnaný naľavo */}
              <PodcastBanner />
            </div>
          ) : null}
        </GlassPanel>
      </main>
    </div>
  );
};

export default Dashboard;
