'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, auth, emailLinkSettings } from '@/lib/firebase';
import {
    onAuthStateChanged,
    signOut,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink,
} from 'firebase/auth';
import { ShieldAlert, Mail, Loader2 } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import DashboardContent from '@/components/DashboardContent';
import { toast } from 'sonner';

type Step = 'login' | 'check-email';

export default function Home() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState<Step>('login');

    // Login Form State
    const [loginEmail, setLoginEmail] = useState('');
    const [loginError, setLoginError] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Handle email link sign-in callback (when admin clicks link in email)
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const url = window.location.href;
        if (!isSignInWithEmailLink(auth, url)) return;

        // Retrieve the email saved before sending the link
        const savedEmail = window.localStorage.getItem('backyardSignInEmail');
        if (!savedEmail) {
            toast.error('Session expired', { description: 'Please log in again.' });
            return;
        }

        setLoading(true);
        signInWithEmailLink(auth, savedEmail, url)
            .then(() => {
                window.localStorage.removeItem('backyardSignInEmail');
                // Clean up URL
                window.history.replaceState({}, document.title, '/');
                toast.success('Verified!', { description: 'Welcome to God Mode.' });
            })
            .catch(() => {
                toast.error('Verification failed', { description: 'Link may have expired. Please log in again.' });
                setLoading(false);
            });
    }, []);

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
        if (!loginEmail) {
            toast.warning('Email Required', { description: 'Please enter your email address.' });
            return;
        }

        setActionLoading(true);
        setLoginError('');
        try {
            await sendSignInLinkToEmail(auth, loginEmail, emailLinkSettings);
            window.localStorage.setItem('backyardSignInEmail', loginEmail);
            toast.success('Check your email', { description: `A verification link was sent to ${loginEmail}` });
            setStep('check-email');
        } catch (error: any) {
            if (error.code === 'auth/unauthorized-domain') {
                setLoginError('Unauthorized domain. Add this domain to Firebase Auth authorized domains.');
            } else {
                setLoginError(`Error: ${error.code || error.message}`);
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleResend = async () => {
        if (!loginEmail) return;
        setActionLoading(true);
        try {
            await sendSignInLinkToEmail(auth, loginEmail, emailLinkSettings);
            toast.success('Link resent', { description: `Check your inbox at ${loginEmail}` });
        } catch {
            toast.error('Failed to resend', { description: 'Please try again.' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        setStep('login');
        setLoginEmail('');
        toast.info('Signed out');
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="animate-pulse flex flex-col items-center">
                <div className="w-12 h-12 bg-gray-200 rounded-full mb-4"></div>
                <div className="h-4 w-32 bg-gray-200 rounded"></div>
            </div>
        </div>
    );

    // --- CHECK EMAIL SCREEN ---
    if (!user && step === 'check-email') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-6 font-sans">
                <div className="w-full max-w-md bg-white rounded-3xl border-[3px] border-brand-dark shadow-sticker overflow-hidden">
                    <div className="p-8 border-b-[3px] border-brand-dark bg-gray-50/50">
                        <h1 className="text-2xl font-black text-brand-dark flex items-center gap-2">
                            <Mail className="w-8 h-8" />
                            Check Your Email
                        </h1>
                        <p className="text-gray-500 font-medium mt-1">Verification link sent</p>
                    </div>

                    <div className="p-8 space-y-6">
                        <div className="p-4 bg-blue-50 border-2 border-blue-100 rounded-xl text-center space-y-2">
                            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                                <Mail className="w-7 h-7 text-blue-600" />
                            </div>
                            <p className="text-sm font-bold text-gray-700">
                                We sent a verification link to:
                            </p>
                            <p className="text-blue-700 font-black text-sm break-all">{loginEmail}</p>
                            <p className="text-xs text-gray-500 font-medium">
                                Click the link in your email to complete sign-in. The link expires in 10 minutes.
                            </p>
                        </div>

                        <button
                            onClick={handleResend}
                            disabled={actionLoading}
                            className="w-full py-3 border-2 border-brand-dark text-brand-dark rounded-lg font-bold hover:bg-gray-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            {actionLoading ? 'Sending...' : 'Resend Link'}
                        </button>

                        <button
                            onClick={() => { setStep('login'); setLoginError(''); }}
                            className="w-full py-3 text-gray-400 rounded-lg font-medium hover:text-gray-600 transition-colors text-sm"
                        >
                            Back to login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- LOGIN SCREEN ---
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-6 font-sans">
                <div className="w-full max-w-md bg-white rounded-3xl border-[3px] border-brand-dark shadow-sticker overflow-hidden">
                    <div className="p-8 border-b-[3px] border-brand-dark bg-gray-50/50">
                        <h1 className="text-2xl font-black text-brand-dark flex items-center gap-2">
                            <ShieldAlert className="w-8 h-8" />
                            Admin Login
                        </h1>
                        <p className="text-gray-500 font-medium mt-1">Sign in to manage your platform</p>
                    </div>

                    {/* LOGIN FORM */}
                    <form onSubmit={handleLogin} className="p-8 space-y-6">
                        {loginError && (
                            <div className="p-4 bg-red-50 text-red-600 text-sm font-bold border-2 border-red-100 rounded-lg flex items-center gap-2">
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
                                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-brand-dark outline-none font-medium transition-colors text-gray-900 bg-white"
                                placeholder="admin@clicker.com"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={actionLoading}
                            className="w-full py-4 bg-brand-dark text-white rounded-lg font-bold text-lg hover:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                            {actionLoading ? 'Verifying...' : 'Sign In'}
                        </button>

                        <div className="text-center pt-2">
                            <p className="text-xs text-gray-400 font-medium">
                                Clicker Platform Admin
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    // --- DASHBOARD ---
    return (
        <div className="min-h-screen bg-gray-50/50 flex font-sans">
            <Sidebar />
            <div className="flex-1 ml-64 p-8">
                <div className="max-w-6xl mx-auto">
                    <DashboardContent />
                </div>
            </div>
        </div>
    );
}
