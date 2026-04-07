'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '@/lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ShieldAlert, KeyRound, Activity, LayoutDashboard, Users, Store } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

export default function Home() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Login Form State
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Auth Listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!loginEmail || !loginPassword) {
            toast.warning('Credentials Required', { description: 'Please enter both email and password.' });
            return;
        }

        setActionLoading(true);
        setLoginError('');
        try {
            await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
            toast.success('Welcome Back, Commander', { description: 'Access granted to God Mode.' });
        } catch (error: any) {
            setLoginError('Invalid credentials. Access denied.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        toast.info('Session Terminated', { description: 'See you later.' });
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="animate-pulse flex flex-col items-center">
                <div className="w-12 h-12 bg-gray-200 rounded-full mb-4"></div>
                <div className="h-4 w-32 bg-gray-200 rounded"></div>
            </div>
        </div>
    );

    // --- LOGIN SCREEN ---
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-6 font-sans">
                <div className="w-full max-w-md bg-white rounded-3xl border-[3px] border-brand-dark shadow-[8px_8px_0px_0px_rgba(34,34,34,1)] overflow-hidden">
                    <div className="p-8 border-b-[3px] border-brand-dark bg-gray-50/50">
                        <h1 className="text-2xl font-black text-brand-dark flex items-center gap-2">
                            <ShieldAlert className="w-8 h-8" />
                            ACCESS RELAY
                        </h1>
                        <p className="text-gray-500 font-medium mt-1">Superadmin Authentication</p>
                    </div>

                    {/* LOGIN FORM */}
                    <form onSubmit={handleLogin} className="p-8 space-y-6">
                        {loginError && (
                            <div className="p-4 bg-red-50 text-red-600 text-sm font-bold border-2 border-red-100 rounded-xl flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4" /> {loginError}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-brand-dark uppercase tracking-wider">Email</label>
                            <input
                                type="email"
                                required
                                value={loginEmail}
                                onChange={e => setLoginEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-dark outline-none font-medium transition-colors text-gray-900 bg-white"
                                placeholder="officer@clicker.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-brand-dark uppercase tracking-wider">Password</label>
                            <div className="relative">
                                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="password"
                                    required
                                    value={loginPassword}
                                    onChange={e => setLoginPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-dark outline-none font-medium transition-colors text-gray-900 bg-white"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={actionLoading}
                            className="w-full py-4 bg-brand-dark text-white rounded-xl font-bold text-lg hover:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
                        >
                            {actionLoading ? 'Verifying Credentials...' : 'Authenticate'}
                        </button>

                        <div className="text-center pt-2 space-y-4">
                            <p className="text-xs text-gray-400 font-medium">
                                Authorized Personnel Only. <br />
                                Access attempts are logged.
                            </p>
                            {process.env.NODE_ENV === 'development' && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!loginEmail || !loginPassword) {
                                            toast.warning('Input Required', { description: 'Enter email and password to create the superadmin.' });
                                            return;
                                        }
                                        setActionLoading(true);
                                        try {
                                            const createUser = httpsCallable(functions, 'createUser');
                                            await createUser({
                                                email: loginEmail,
                                                password: loginPassword,
                                                displayName: 'Super Admin',
                                                role: 'superadmin'
                                            });
                                            toast.success('System Initialized', { description: 'Superadmin account created. You may now login.' });
                                        } catch (error: any) {
                                            toast.error('Bootstrap Failed', { description: error.message });
                                        } finally {
                                            setActionLoading(false);
                                        }
                                    }}
                                    className="text-xs text-gray-300 hover:text-brand-dark underline decoration-dotted transition-colors"
                                >
                                    Initialize System (Dev Only)
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    // --- GOD MODE DASHBOARD ---
    return (
        <div className="min-h-screen bg-gray-50/50 flex font-sans">
            <Sidebar />
            <div className="flex-1 ml-64 p-8">
                <div className="max-w-6xl mx-auto space-y-8">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-brand-dark flex items-center gap-3">
                                <LayoutDashboard className="w-8 h-8" />
                                DASHBOARD OVERVIEW
                            </h1>
                            <p className="text-gray-500 font-medium">Platform Health & Status</p>
                        </div>
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-gray-200">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-bold text-gray-600">SYSTEM ONLINE</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* STAT CARD: TENANTS */}
                        <div className="bg-white rounded-3xl border border-gray-100 p-8 hover:shadow-lg transition-all relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
                            <div className="relative">
                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                                    <Store className="w-6 h-6" />
                                </div>
                                <h2 className="text-4xl font-black text-brand-dark mb-1">--</h2>
                                <p className="text-gray-400 font-bold uppercase text-xs tracking-wider">Active Tenants</p>
                            </div>
                        </div>

                        {/* STAT CARD: USERS */}
                        <div className="bg-white rounded-3xl border border-gray-100 p-8 hover:shadow-lg transition-all relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
                            <div className="relative">
                                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-4">
                                    <Users className="w-6 h-6" />
                                </div>
                                <h2 className="text-4xl font-black text-brand-dark mb-1">--</h2>
                                <p className="text-gray-400 font-bold uppercase text-xs tracking-wider">Total Identities</p>
                            </div>
                        </div>

                        {/* STAT CARD: HEALTH */}
                        <div className="bg-white rounded-3xl border border-gray-100 p-8 hover:shadow-lg transition-all relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
                            <div className="relative">
                                <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-4">
                                    <Activity className="w-6 h-6" />
                                </div>
                                <h2 className="text-4xl font-black text-brand-dark mb-1">99.9%</h2>
                                <p className="text-gray-400 font-bold uppercase text-xs tracking-wider">System Uptime</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    );
}

