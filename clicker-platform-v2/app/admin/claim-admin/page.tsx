'use client';

import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function ClaimAdminPage() {
    const [user, setUser] = useState<any>(null);
    const [status, setStatus] = useState<'idle' | 'checking' | 'claiming' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                checkExistingStatus(currentUser.uid);
            }
        });
        return () => unsubscribe();
    }, []);

    const checkExistingStatus = async (uid: string) => {
        setStatus('checking');
        try {
            const docRef = doc(db, 'modules/byod_pos/admins', uid);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                setStatus('success');
                setMessage('You are already an admin!');
            } else {
                setStatus('idle');
            }
        } catch (e: any) {
            console.error(e);
            setStatus('error');
            setMessage(e.message);
        }
    };

    const handleClaim = async () => {
        if (!user) return;
        setStatus('claiming');
        try {
            // This works because firestore.rules allows write to 'admins/{id}' if request.auth.uid == id
            await setDoc(doc(db, 'modules/byod_pos/admins', user.uid), {
                email: user.email,
                role: 'admin',
                grantedAt: Date.now()
            });
            setStatus('success');
            setMessage('Successfully granted Admin access!');
            toast.success('Admin access granted');
        } catch (e: any) {
            console.error(e);
            setStatus('error');
            setMessage('Failed: ' + e.message);
            toast.error('Failed to claim admin access');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="max-w-md w-full p-6 text-center space-y-6 bg-white rounded-xl shadow-lg border border-gray-100">
                <div className="flex justify-center">
                    <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center text-brand-primary">
                        <ShieldCheck size={32} />
                    </div>
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold">Claim Admin Access</h1>
                    <p className="text-gray-500">
                        This utility allows you to add yourself to the POS Admin list to resolve permission errors.
                    </p>
                </div>

                {user ? (
                    <div className="bg-white border rounded-lg p-4 text-left text-sm space-y-2">
                        <p><span className="font-semibold">User:</span> {user.email}</p>
                        <p><span className="font-semibold">UID:</span> <span className="font-mono text-xs">{user.uid}</span></p>
                    </div>
                ) : (
                    <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg flex items-center gap-2 text-sm">
                        <AlertTriangle size={16} />
                        Please sign in to continue.
                    </div>
                )}

                <div className="space-y-4">
                    {status === 'success' ? (
                        <div className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 p-3 rounded-md font-medium">
                            {message}
                        </div>
                    ) : status === 'error' ? (
                        <div className="bg-red-50 text-red-700 p-3 rounded-md font-medium">
                            {message}
                        </div>
                    ) : null}

                    <button
                        className={`w-full py-2.5 rounded-lg font-bold text-white transition-all transform active:scale-95 ${!user || status === 'claiming' || status === 'success'
                                ? 'bg-gray-300 cursor-not-allowed'
                                : 'bg-studio-blue hover:bg-studio-blue/85 shadow-md'
                            }`}
                        onClick={handleClaim}
                        disabled={!user || status === 'claiming' || status === 'success'}
                    >
                        {status === 'claiming' ? 'Processing...' : status === 'success' ? 'Access Granted' : 'Grant Admin Access'}
                    </button>

                    {status === 'success' && (
                        <button
                            className="w-full py-2.5 rounded-lg font-bold text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
                            onClick={() => window.location.href = '/admin/pos/cashier'}
                        >
                            Go to Cashier
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
