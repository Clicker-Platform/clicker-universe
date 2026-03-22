'use client';

import { useState, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, verifyBeforeUpdateEmail } from 'firebase/auth';
import { Lock, Mail, Key, AlertTriangle, CheckCircle } from 'lucide-react';
import { SubmitButton } from '@/components/admin/SubmitButton';

interface FormState {
    loading: boolean;
    message: { type: 'success' | 'error' | ''; text: string };
}

const INITIAL_FORM: FormState = { loading: false, message: { type: '', text: '' } };

export function AccountSecurity() {
    // Email form
    const [newEmail, setNewEmail] = useState('');
    const [emailPassword, setEmailPassword] = useState('');
    const [emailState, setEmailState] = useState<FormState>(INITIAL_FORM);

    // Password form
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordState, setPasswordState] = useState<FormState>(INITIAL_FORM);

    const handleUpdateEmail = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user?.email) {
            setEmailState({ loading: false, message: { type: 'error', text: 'User not authenticated.' } });
            return;
        }

        setEmailState({ loading: true, message: { type: '', text: '' } });
        try {
            const credential = EmailAuthProvider.credential(user.email, emailPassword);
            await reauthenticateWithCredential(user, credential);
            await verifyBeforeUpdateEmail(user, newEmail);
            setEmailState({ loading: false, message: { type: 'success', text: 'Verification email sent. Please check your inbox to confirm.' } });
            setNewEmail('');
            setEmailPassword('');
        } catch (error: any) {
            const text =
                error.code === 'auth/wrong-password' ? 'Incorrect password.' :
                error.code === 'auth/email-already-in-use' ? 'Email already in use.' :
                error.code === 'auth/requires-recent-login' ? 'Please log out and log in again.' :
                'Failed to update email. ' + error.message;
            setEmailState({ loading: false, message: { type: 'error', text } });
        }
    }, [newEmail, emailPassword]);

    const handleUpdatePassword = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const user = auth.currentUser;

        if (newPassword !== confirmPassword) {
            setPasswordState({ loading: false, message: { type: 'error', text: 'New passwords do not match.' } });
            return;
        }
        if (newPassword.length < 6) {
            setPasswordState({ loading: false, message: { type: 'error', text: 'Password must be at least 6 characters.' } });
            return;
        }
        if (!user?.email) {
            setPasswordState({ loading: false, message: { type: 'error', text: 'User not authenticated.' } });
            return;
        }

        setPasswordState({ loading: true, message: { type: '', text: '' } });
        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            setPasswordState({ loading: false, message: { type: 'success', text: 'Password updated successfully!' } });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            const text =
                error.code === 'auth/wrong-password' ? 'Incorrect current password.' :
                error.code === 'auth/requires-recent-login' ? 'Please log out and log in again.' :
                'Failed to update password. ' + error.message;
            setPasswordState({ loading: false, message: { type: 'error', text } });
        }
    }, [currentPassword, newPassword, confirmPassword]);

    return (
        <div className="mt-12 pt-12 border-t-2 border-dashed border-gray-200 dark:border-neutral-700">
            <h2 className="text-2xl font-black text-brand-dark dark:text-neutral-100 mb-8 uppercase flex items-center gap-3">
                <Lock className="text-brand-green fill-brand-green" /> Account Security
            </h2>

            <div className="space-y-8">
                {/* Change Email */}
                <div className="bg-white dark:bg-neutral-800 p-8 rounded-2xl border border-gray-200 dark:border-neutral-700 shadow-sm">
                    <h3 className="text-xl font-bold text-brand-dark dark:text-neutral-100 mb-6 flex items-center gap-2">
                        <Mail size={24} /> Change Email
                    </h3>

                    {emailState.message.text && (
                        <div className={`p-4 rounded-xl mb-6 font-bold flex items-center gap-2 ${emailState.message.type === 'error' ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400'}`}>
                            {emailState.message.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                            {emailState.message.text}
                        </div>
                    )}

                    <form onSubmit={handleUpdateEmail} className="space-y-4">
                        <div className="bg-gray-50 dark:bg-neutral-700/50 p-4 rounded-xl mb-4">
                            <p className="text-sm font-bold text-gray-500 dark:text-neutral-400 uppercase mb-1">Current Email</p>
                            <p className="text-lg font-bold text-brand-dark dark:text-neutral-100">{auth.currentUser?.email}</p>
                        </div>

                        <div>
                            <label className="block text-brand-dark dark:text-neutral-200 font-bold mb-2">New Email Address</label>
                            <input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-brand-dark dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500 focus:border-gray-400 dark:focus:border-neutral-400 outline-none font-medium transition-colors"
                                placeholder="name@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-brand-dark dark:text-neutral-200 font-bold mb-2">Current Password (Required)</label>
                            <input
                                type="password"
                                value={emailPassword}
                                onChange={(e) => setEmailPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-brand-dark dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500 focus:border-gray-400 dark:focus:border-neutral-400 outline-none font-medium transition-colors"
                                placeholder="Confirm your password"
                                required
                            />
                        </div>

                        <SubmitButton
                            isLoading={emailState.loading}
                            loadingLabel="Updating Email..."
                            label="Update Email"
                            className="w-full md:w-auto bg-brand-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-green hover:text-brand-dark transition-colors"
                        />
                    </form>
                </div>

                {/* Change Password */}
                <div className="bg-white dark:bg-neutral-800 p-8 rounded-2xl border border-gray-200 dark:border-neutral-700 shadow-sm">
                    <h3 className="text-xl font-bold text-brand-dark dark:text-neutral-100 mb-6 flex items-center gap-2">
                        <Key size={24} /> Change Password
                    </h3>

                    {passwordState.message.text && (
                        <div className={`p-4 rounded-xl mb-6 font-bold flex items-center gap-2 ${passwordState.message.type === 'error' ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400'}`}>
                            {passwordState.message.type === 'error' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                            {passwordState.message.text}
                        </div>
                    )}

                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div>
                            <label className="block text-brand-dark dark:text-neutral-200 font-bold mb-2">Current Password</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-brand-dark dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500 focus:border-gray-400 dark:focus:border-neutral-400 outline-none font-medium transition-colors"
                                placeholder="Enter current password"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-brand-dark dark:text-neutral-200 font-bold mb-2">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-brand-dark dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500 focus:border-gray-400 dark:focus:border-neutral-400 outline-none font-medium transition-colors"
                                placeholder="Enter new password (min. 6 chars)"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-brand-dark dark:text-neutral-200 font-bold mb-2">Confirm New Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-brand-dark dark:text-neutral-100 placeholder-gray-400 dark:placeholder-neutral-500 focus:border-gray-400 dark:focus:border-neutral-400 outline-none font-medium transition-colors"
                                placeholder="Re-enter new password"
                                required
                            />
                        </div>

                        <SubmitButton
                            isLoading={passwordState.loading}
                            loadingLabel="Updating Password..."
                            label="Update Password"
                            className="w-full md:w-auto bg-brand-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-green hover:text-brand-dark transition-colors"
                        />
                    </form>
                </div>
            </div>
        </div>
    );
}
