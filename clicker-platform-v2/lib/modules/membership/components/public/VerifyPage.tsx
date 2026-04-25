'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isSignInWithEmailLink, signInWithEmailLink, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { logger } from '@/lib/logger';

export default function VerifyPage() {
    const router = useRouter();
    const [status, setStatus] = useState<'VERIFYING' | 'SUCCESS' | 'ERROR' | 'PROMPT_EMAIL'>('VERIFYING');
    const [error, setError] = useState('');
    const [email, setEmail] = useState('');
    const [user, setUser] = useState<User | null>(null);
    const hasAttempted = React.useRef(false);

    useEffect(() => {
        if (hasAttempted.current) return;
        hasAttempted.current = true;

        // 1. Check if it's a valid email link
        if (!isSignInWithEmailLink(auth, window.location.href)) {
            setStatus('ERROR');
            setError('Invalid or expired login link.');
            return;
        }

        // 2. Get email from storage
        let storedEmail = window.localStorage.getItem('emailForSignIn');

        if (!storedEmail) {
            // User opened link on different device/browser
            setStatus('PROMPT_EMAIL');
        } else {
            verifyLogin(storedEmail);
        }
    }, []);

    const verifyLogin = async (emailToVerify: string) => {
        setStatus('VERIFYING');
        try {
            const result = await signInWithEmailLink(auth, emailToVerify, window.location.href);
            window.localStorage.removeItem('emailForSignIn'); // Cleanup
            setUser(result.user);
            setStatus('SUCCESS');

            // Allow a brief moment for user to see success state before redirect
            setTimeout(() => {
                // Forward to dashboard. 
                // Note: Dashboard currently needs updates to handle Auth UID logic. 
                // For now, we just go to root of dashboard.
                router.replace('/member/dashboard');
            }, 1500);

        } catch (error: any) {
            logger.error('membership.verify.link.failed', { siteId: 'platform', error });
            setStatus('ERROR');
            setError(error.message || "Could not verify login. The link may be expired.");
        }
    };

    const handleEmailSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email) {
            verifyLogin(email);
        }
    };

    if (status === 'VERIFYING') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
                <Loader2 className="animate-spin h-10 w-10 text-indigo-600 mb-4" />
                <h2 className="text-xl font-semibold text-gray-800">Verifying your login...</h2>
                <p className="text-gray-500 text-sm mt-2">Please wait a moment.</p>
            </div>
        );
    }

    if (status === 'PROMPT_EMAIL') {
        return (
            <div className="flex flex-col items-center justify-center p-8 max-w-md mx-auto">
                <div className="bg-yellow-100 p-4 rounded-full text-yellow-600 mb-6">
                    <AlertTriangle size={36} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Confirm your Email</h2>
                <p className="text-center text-gray-600 mb-6">
                    To complete your login, please confirm the email address this link was sent to.
                </p>

                <form onSubmit={handleEmailSubmit} className="w-full">
                    <input
                        type="email"
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 mb-4"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                    <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg">
                        Verify & Login
                    </button>
                </form>
            </div>
        );
    }

    if (status === 'ERROR') {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
                <div className="bg-red-100 p-4 rounded-full text-red-600 mb-6">
                    <AlertTriangle size={36} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Login Failed</h2>
                <p className="text-gray-600 mb-6">{error}</p>
                <button
                    onClick={() => router.push('/member/login')}
                    className="flex items-center gap-2 text-indigo-600 font-bold hover:underline"
                >
                    Back to Login <ArrowRight size={16} />
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center animate-in zoom-in duration-300">
            <div className="bg-green-100 p-4 rounded-full text-green-600 mb-6">
                <CheckCircle2 size={48} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome Back!</h2>
            <p className="text-gray-600 mb-1">
                Successfully signed in as <span className="font-semibold">{user?.email}</span>
            </p>
            <p className="text-indigo-500 text-sm mt-4 font-medium flex items-center gap-2">
                Redirecting to dashboard... <Loader2 className="animate-spin h-3 w-3" />
            </p>
        </div>
    );
}
