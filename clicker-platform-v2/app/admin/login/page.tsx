'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import Image from 'next/image';

import { Suspense } from 'react';

function AdminLoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Find the user's site membership
            const { getUserSites } = await import('@/lib/admin-auth');
            const sites = await getUserSites(user.uid, user.email);

            if (sites.length > 0) {
                // Set the __session cookie for middleware to read (Required by Firebase Hosting)
                const targetSite = sites[0];
                document.cookie = `__session=${targetSite.siteId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax; Secure`;

                // Redirect to admin dashboard
                router.push('/admin');
            } else {
                // User has no site membership
                setError('No site membership found. Please contact your administrator.');
                await auth.signOut();
            }

        } catch (err: any) {
            setError('Invalid email or password.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full border border-gray-200">
                <div className="flex justify-center mb-6">
                    <div className="relative w-20 h-20">
                        <Image
                            src="/clicker_brand_logo.png"
                            alt="Clicker Logo"
                            fill
                            className="object-contain"
                        />
                    </div>
                </div>

                <h1 className="text-2xl font-black text-center text-brand-dark mb-6 uppercase">Admin Access</h1>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm font-bold">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-brand-dark font-bold text-sm mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-gray-400 focus:ring-0 outline-none transition-colors"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-brand-dark font-bold text-sm mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-gray-400 focus:ring-0 outline-none transition-colors"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-brand-dark text-brand-green font-black uppercase py-3 rounded-xl border border-gray-200 hover:bg-brand-green hover:text-brand-dark transition-all shadow-sm translate-x-0 hover:translate-x-[2px] hover:translate-y-[2px]"
                    >
                        Enter Dashboard
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function AdminLogin() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-100">Loading...</div>}>
            <AdminLoginForm />
        </Suspense>
    );
}
