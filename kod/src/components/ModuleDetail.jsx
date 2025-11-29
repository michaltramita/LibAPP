import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, BarChart, Star, CheckCircle, Clock, Play } from 'lucide-react';
import RecentSessions from '@/components/RecentSessions';
import StartSessionDialog from '@/components/StartSessionDialog';

const StatCard = ({ icon, title, value, color }) => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4">
      <div className={`p-3 rounded-full ${color.bg}`}>
        {React.cloneElement(icon, { className: `w-6 h-6 ${color.text}` })}
      </div>
      <div>
        <p className="text-sm text-slate-500 mb-1">{title}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
};

const ModuleDetail = () => {
  const { moduleCode } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setDialogOpen] = useState(false);
  
  useEffect(() => {
    if (session && moduleCode) {
      const fetchModuleData = async () => {
        setLoading(true);
        try {
          const { data: responseData, error } = await supabase.functions.invoke('module-overview', {
             body: { module_code: moduleCode }
          });
          
          if (error) throw new Error(error.message || 'An unknown error occurred.');
          if (responseData.error) throw new Error(responseData.error);
          
          setData(responseData);
        } catch (error) {
          console.error("Error fetching module data:", error.message);
          toast({
            variant: "destructive",
            title: "Chyba pri načítaní modulu",
            description: "Nepodarilo sa načítať dáta pre tento modul.",
          });
          navigate('/dashboard');
        } finally {
          setLoading(false);
        }
      };
      fetchModuleData();
    }
  }, [session, moduleCode, toast, navigate]);

  const stats = useMemo(() => {
    if (!data?.summary_stats) return [];
    const { total_sessions, avg_score, success_rate, last_session_at } = data.summary_stats;
    return [
      { icon: <BarChart />, title: "Celkový počet tréningov", value: total_sessions, color: { bg: 'bg-blue-100', text: 'text-blue-600' } },
      { icon: <Star />, title: "Priemerné skóre", value: `${avg_score} / 10`, color: { bg: 'bg-yellow-100', text: 'text-yellow-600' } },
      { icon: <CheckCircle />, title: "Miera úspešnosti", value: `${success_rate}%`, color: { bg: 'bg-green-100', text: 'text-green-600' } },
      { icon: <Clock />, title: "Posledný tréning", value: last_session_at ? new Date(last_session_at).toLocaleDateString('sk-SK') : 'N/A', color: { bg: 'bg-purple-100', text: 'text-purple-600' } }
    ];
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100">
        <Loader2 className="h-12 w-12 animate-spin text-[#B81547]" />
      </div>
    );
  }

  if (!data) {
    return null; // Or some error component
  }

  return (
    <div className="min-h-screen bg-slate-50">
       <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20">
         <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
           <ArrowLeft className="w-4 h-4 mr-2" />
           Späť na nástenku
         </Button>
         <div className="text-right">
           <h1 className="font-bold text-lg leading-tight text-slate-900">{data.module_info.title}</h1>
           <p className="text-xs text-slate-500">Prehľad modulu</p>
         </div>
       </header>

       <main className="p-6 max-w-7xl mx-auto">
         <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 mb-8">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-3">{data.module_info.title}</h2>
                <p className="text-slate-600 max-w-3xl mb-6">{data.module_info.long_description}</p>
                <Button onClick={() => setDialogOpen(true)} className="bg-[#B81547] hover:bg-[#9e123d] text-white whitespace-nowrap">
                    <Play className="w-4 h-4 mr-2"/>
                    Začať nový simulovaný rozhovor
                </Button>
            </div>
         </section>
        
        {data?.summary_stats?.total_sessions > 0 ? (
          <>
            <section className="mb-8">
                <h3 className="text-xl font-bold text-slate-900 mb-4">Vaše štatistiky v tomto module</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {stats.map((stat, index) => <StatCard key={index} {...stat} />)}
                </div>
            </section>
            
            <RecentSessions sessions={data.recent_sessions} />
          </>
        ) : (
           <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-slate-300">
              <BarChart className="mx-auto h-12 w-12 text-slate-400"/>
              <h3 className="mt-4 text-xl font-semibold text-slate-800">Pre tento modul zatiaľ nemáte žiadne dáta</h3>
              <p className="mt-2 text-slate-500">Absolvujte svoj prvý tréning a sledujte svoj pokrok.</p>
          </div>
        )}
       </main>
       
       <StartSessionDialog
          moduleCode={moduleCode}
          open={isDialogOpen}
          onOpenChange={setDialogOpen}
       />
    </div>
  );
};

export default ModuleDetail;