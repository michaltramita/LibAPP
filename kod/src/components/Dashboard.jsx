// src/components/Dashboard.jsx
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
          description: 'Nepodarilo sa načítať dáta pre nástenku. Skúste to znova.',
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
    <div className="min-h-screen bg-[#B81457] bg-gradient-to-br from-[#B81457] via-[#B81457] to-[#7b0e3a] text-white">
      {/* HEADER – glass bar hore */}
      <header className="px-4 pt-4 pb-3">
        <GlassPanel className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/15 border border-white/25 shadow-inner">
              <span className="text-xs font-semibold tracking-wide">
                L
              </span>
            </div>
            <div>
              <h1 className="text-xs font-semibold uppercase tracking-[0.18em]">
                Libellius – LibApp
              </h1>
              <p className="text-[11px] text-white/70">
                Tvoj AI pomocník pre obchod a leadership
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 border border-white/25"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
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
        </GlassPanel>
      </header>

      {/* HLAVNÝ OBSAH – veľký glass panel */}
      <main className="px-4 pb-6">
        <div className="max-w-6xl mx-auto">
          <GlassPanel className="p-6 md:p-8 space-y-8 bg-white/10">
            {/* Úvodný text */}
            <div>
              <h2 className="text-2xl font-semibold mb-1">
                Vitajte späť, {profile?.first_name || 'používateľ'}!
              </h2>
              <p className="text-sm text-white/80">
                Tu je prehľad vašich doterajších aktivít a výsledkov.
              </p>
            </div>

            {/* Sekcia štatistík / prázdna karta */}
            {loading ? (
              <DashboardSkeleton />
            ) : data ? (
              <>
                {data.summary_stats.total_sessions > 0 ? (
                  <DashboardStats stats={data.summary_stats} />
                ) : (
                  <GlassPanel className="border border-white/20 bg-white/6">
                    <div className="border border-dashed border-white/30 rounded-3xl px-6 py-10 text-center">
                      <BarChart2 className="mx-auto h-8 w-8 text-white/70 mb-4" />
                      <h3 className="text-sm font-semibold tracking-wide uppercase text-white/80">
                        Zatiaľ žiadne dáta
                      </h3>
                      <p className="mt-2 text-xs text-white/70 max-w-md mx-auto">
                        Absolvujte svoje prvé simulované stretnutie a sledujte svoj pokrok.
                      </p>
                    </div>
                  </GlassPanel>
                )}

                {/* Posledné stretnutia */}
                {data.summary_stats.total_sessions > 0 && (
                  <RecentSessions sessions={data.recent_sessions} />
                )}

                {/* MODULY */}
                <ModuleSelector modules={data.modules} />

                {/* PODCAST – celý blok na jednom glass paneli */}
                <GlassPanel className="mt-4 p-5 md:p-6 bg-white/10">
                  <PodcastBanner />
                </GlassPanel>
              </>
            ) : null}
          </GlassPanel>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
