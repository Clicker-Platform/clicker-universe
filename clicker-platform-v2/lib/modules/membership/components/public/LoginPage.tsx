'use client';

import React, { useState } from 'react';
import { sendSignInLinkToEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
    const [step, setStep] = useState<'INPUT' | 'SENT'>('INPUT');
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSendLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email) {
            setError('Please enter your email address.');
            return;
        }

        setIsLoading(true);

        const actionCodeSettings = {
            // URL you want to redirect back to. The domain (www.example.com) for this
            // URL must be in the authorized domains list in the Firebase Console.
            url: window.location.origin + '/member/login/verify',
            // This must be true.
            handleCodeInApp: true,
        };

        try {
            await sendSignInLinkToEmail(auth, email, actionCodeSettings);
            // The link was successfully sent. Inform the user.
            // Save the email locally so you don't need to ask the user for it again
            // if they open the link on the same device.
            window.localStorage.setItem('emailForSignIn', email);
            setStep('SENT');
        } catch (error: any) {
            console.error("Error sending email link", error);
            setError(error.message || "Failed to send login link. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-8 w-full max-w-md mx-auto">
            {step === 'INPUT' ? (
                <>
                    <div className="text-center mb-8">
                        <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
                            <Mail size={32} />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800 mb-2">Member Login</h1>
                        <p className="text-gray-500">Enter your email to receive a secure login link.</p>
                    </div>

                    <form onSubmit={handleSendLink} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                            <input
                                type="email"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-gray-50 focus:bg-white"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg text-center animate-in fade-in slide-in-from-top-1">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Loader2 className="animate-spin" /> : <>Send Login Link <ArrowRight size={18} /></>}
                        </button>
                    </form>
                </>
            ) : (
                <div className="text-center animate-in fade-in zoom-in">
                    <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
                        <CheckCircle2 size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-3">Check your Email</h2>
                    <p className="text-gray-600 mb-6">
                        We sent a login link to <span className="font-semibold text-gray-800">{email}</span>.
                        <br />Click the link to sign in instantly.
                    </p>

                    <button
                        onClick={() => setStep('INPUT')}
                        className="text-indigo-600 font-medium hover:text-indigo-700 text-sm hover:underline"
                    >
                        Use a different email
                    </button>
                </div>
            )}
        </div>
    );
}
