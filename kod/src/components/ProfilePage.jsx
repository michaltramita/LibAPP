
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowLeft, LogOut, Trash2, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ProfilePage = () => {
    const { user, profile, updateProfile, signOut, resetPasswordForEmail, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        company: '',
        position: '',
        industry: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSendingReset, setIsSendingReset] = useState(false);

    useEffect(() => {
        if (profile) {
            setFormData({
                first_name: profile.first_name || '',
                last_name: profile.last_name || '',
                company: profile.company || '',
                position: profile.position || '',
                industry: profile.industry || ''
            });
        }
    }, [profile]);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSelectChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        await updateProfile(formData);
        setIsSaving(false);
    };

    const handlePasswordReset = async () => {
        if (!user?.email) return;
        setIsSendingReset(true);
        try {
            await resetPasswordForEmail(user.email);
        } catch (e) {
            console.error("Password reset error:", e);
        } finally {
            setIsSendingReset(false);
        }
    };

    const handleDeleteAllSessions = async () => {
        setIsDeleting(true);
        try {
            const { error } = await supabase.functions.invoke('delete-all-sessions');
            if (error) throw error;
            toast({
                title: "Úspech",
                description: "Všetky vaše tréningové konverzácie boli úspešne odstránené.",
            });
            navigate('/dashboard', { replace: true });
            window.location.reload();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Chyba",
                description: "Nepodarilo sa odstrániť vaše konverzácie. Skúste to prosím znova.",
            });
        } finally {
            setIsDeleting(false);
        }
    };
    
    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    if (authLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-100">
                <Loader2 className="h-12 w-12 animate-spin text-[#B81547]" />
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20">
                <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Späť na nástenku
                </Button>
                <h1 className="font-bold text-lg leading-tight text-slate-900">Váš profil</h1>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Odhlásiť sa
                </Button>
            </header>

            <main className="p-6 max-w-3xl mx-auto space-y-6">
                <Card className="w-full">
                    <form onSubmit={handleSave}>
                        <CardHeader>
                            <CardTitle>Profilové údaje</CardTitle>
                            <CardDescription>Upravte svoje osobné a pracovné informácie.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="first_name">Krstné meno</Label>
                                    <Input id="first_name" value={formData.first_name} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="last_name">Priezvisko</Label>
                                    <Input id="last_name" value={formData.last_name} onChange={handleInputChange} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input id="email" value={user?.email || ''} disabled className="bg-slate-50 text-slate-500" />
                            </div>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="company">Spoločnosť</Label>
                                    <Input id="company" value={formData.company} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="position">Pozícia</Label>
                                    <Input id="position" value={formData.position} onChange={handleInputChange} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="industry">Odvetvie</Label>
                                <Select name="industry" value={formData.industry} onValueChange={(value) => handleSelectChange('industry', value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Vyberte odvetvie" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="it">IT a Telekomunikácie</SelectItem>
                                        <SelectItem value="financie">Financie a Bankovníctvo</SelectItem>
                                        <SelectItem value="vyroba">Výroba a Priemysel</SelectItem>
                                        <SelectItem value="retail">Maloobchod a Veľkoobchod</SelectItem>
                                        <SelectItem value="sluzby">Služby</SelectItem>
                                        <SelectItem value="marketing">Marketing a Reklama</SelectItem>
                                        <SelectItem value="other">Iné</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end">
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Uložiť zmeny
                            </Button>
                        </CardFooter>
                    </form>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Zabezpečenie</CardTitle>
                        <CardDescription>Spravujte svoje heslo a bezpečnosť účtu.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 gap-4">
                           <div>
                                <p className="font-semibold text-slate-800">Zmeniť heslo</p>
                                <p className="text-sm text-slate-600">Odošleme vám email s odkazom na obnovenie hesla.</p>
                           </div>
                           <Button variant="outline" onClick={handlePasswordReset} disabled={isSendingReset} className="w-full sm:w-auto">
                                {isSendingReset ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                                Odoslať email na zmenu
                           </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-red-500/50">
                    <CardHeader>
                        <CardTitle className="text-red-600">Nebezpečná zóna</CardTitle>
                        <CardDescription>Tieto akcie sú trvalé a nemožno ich vrátiť späť.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-red-50/50 rounded-lg border border-red-200 gap-4">
                           <div>
                                <p className="font-semibold text-slate-800">Vymazať všetky konverzácie</p>
                                <p className="text-sm text-slate-600">Trvalo odstráni celú vašu históriu tréningových konverzácií.</p>
                           </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={isDeleting} className="w-full sm:w-auto">
                                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                        Vymazať všetko
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Naozaj chcete pokračovať?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Táto akcia je nezvratná. Trvalo odstráni všetky vaše tréningové konverzácie a súvisiace dáta.
                                            Tieto dáta nebudete môcť obnoviť.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Zrušiť</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteAllSessions} className="bg-red-600 hover:bg-red-700">
                                            Áno, vymazať všetko
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default ProfilePage;
