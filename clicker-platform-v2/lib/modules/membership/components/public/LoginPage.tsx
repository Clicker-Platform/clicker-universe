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
        <div className="min-h-screen flex items-center justify-center p-6 bg-brand-green">
            <div className="w-full max-w-md bg-white p-8 md:p-12 rounded-[32px] border-[3px] border-brand-dark shadow-sticker relative flex flex-col items-center">

                {step === 'INPUT' ? (
                    <div className="w-full">
                        <div className="text-center mb-10">
                            <div className="bg-brand-green w-20 h-20 rounded-3xl border-[3px] border-brand-dark shadow-sticker flex items-center justify-center mx-auto mb-10 transform -rotate-3">
                                <Mail size={32} strokeWidth={2.5} className="text-brand-dark" />
                            </div>
                            <h1 className="text-3xl font-black text-brand-dark mb-3 uppercase tracking-tight">Member Login</h1>
                            <p className="text-brand-dark/70 text-base font-bold leading-tight max-w-[280px] mx-auto">
                                Enter your email to receive a secure login link.
                            </p>
                        </div>

                        <form onSubmit={handleSendLink} className="space-y-6">
                            <div>
                                <label className="block text-brand-dark text-xs font-black mb-2 ml-1 uppercase tracking-widest">Email Address</label>
                                <input
                                    type="email"
                                    className="w-full px-5 py-4 rounded-2xl border-[3px] border-brand-dark focus:ring-4 focus:ring-brand-green/30 outline-none transition-all bg-white text-brand-dark placeholder:text-brand-dark/30 font-bold"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            {error && (
                                <div className="bg-red-50 text-red-600 text-xs p-4 rounded-xl text-center font-black border-[2px] border-red-200 animate-in fade-in slide-in-from-top-1">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-brand-dark hover:bg-brand-green hover:text-brand-dark text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 border-[3px] border-brand-dark shadow-sticker hover:shadow-sticker-hover active:translate-y-1 active:shadow-none disabled:opacity-70 disabled:cursor-not-allowed text-lg uppercase tracking-wider"
                            >
                                {isLoading ? <Loader2 className="animate-spin" size={24} /> : <>Send Link <ArrowRight size={22} strokeWidth={3} /></>}
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="text-center animate-in fade-in zoom-in duration-500 w-full py-4">
                        <div className="bg-brand-green w-24 h-24 rounded-full border-[3px] border-brand-dark shadow-sticker flex items-center justify-center mx-auto mb-10 text-brand-dark transform rotate-6">
                            <CheckCircle2 size={48} strokeWidth={2.5} />
                        </div>
                        <h2 className="text-3xl font-black text-brand-dark mb-4 uppercase tracking-tight">Check Email</h2>
                        <p className="text-brand-dark/70 text-base font-bold mb-10 leading-relaxed">
                            We sent a login link to <br />
                            <span className="font-black text-brand-dark border-b-4 border-brand-green px-1">{email}</span>
                            <br /><span className="text-xs mt-4 block opacity-60 uppercase tracking-widest">Click the link to sign in instantly.</span>
                        </p>

                        <button
                            onClick={() => setStep('INPUT')}
                            className="w-full py-4 rounded-2xl border-[3px] border-brand-dark text-brand-dark font-black text-sm hover:bg-brand-green transition-all shadow-sticker hover:shadow-sticker-hover active:translate-y-0.5 active:shadow-none uppercase tracking-widest"
                        >
                            Back to Start
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
